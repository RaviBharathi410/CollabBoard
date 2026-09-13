"""
generate_nlp_diagrams.py
Generates (prompt, diagram_json) pairs for fine-tuning flan-T5.

Output schema matches server/ai/schema.js DiagramSchema exactly:
  { type, confidence, nodes[], edges[], layoutHint, ambiguities? }

Usage:
  python ml/scripts/generate_nlp_diagrams.py \
      --output_dir ml/datasets/nlp_diagrams \
      --total_samples 20000 \
      --seed_dir ml/datasets/nlp_diagrams/seed
"""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Vocabulary banks
# ---------------------------------------------------------------------------

DIAGRAM_TYPES = ["architecture", "flowchart", "erd", "sequence", "mindmap"]

# Architecture nodes: (label, shape_type)
ARCH_NODES = [
    ("User", "rectangle"), ("Web App", "rectangle"), ("Mobile App", "rectangle"),
    ("API Gateway", "rectangle"), ("Load Balancer", "rectangle"), ("CDN", "cloud"),
    ("Auth Service", "rectangle"), ("User Service", "rectangle"),
    ("Payment Service", "rectangle"), ("Notification Service", "rectangle"),
    ("Email Service", "rectangle"), ("Worker Service", "rectangle"),
    ("Scheduler", "rectangle"), ("Admin Portal", "rectangle"),
    ("PostgreSQL", "database"), ("MySQL", "database"), ("MongoDB", "database"),
    ("Redis Cache", "cylinder"), ("Memcached", "cylinder"),
    ("RabbitMQ", "cylinder"), ("Kafka", "cylinder"), ("SQS", "cylinder"),
    ("S3 Bucket", "cylinder"), ("Blob Storage", "cylinder"),
    ("Elasticsearch", "database"), ("ClickHouse", "database"),
    ("Stripe API", "cloud"), ("SendGrid", "cloud"), ("Twilio", "cloud"),
]

ARCH_PROMPT_TEMPLATES = [
    "Create a system architecture with {nodes}",
    "Design a microservices diagram that includes {nodes}",
    "Draw an architecture for an app with {nodes}",
    "Build a backend architecture: {nodes}",
    "Sketch a system with {nodes}",
    "I need an architecture diagram — {nodes}",
    "hey can you put together a system diagram with {nodes}",
    "map out a cloud architecture: {nodes}",
    "diagram showing {nodes} connected together",
    "Set up architecture for: {nodes}",
    "can you draw something with {nodes}",
    "I'm thinking of a system that has {nodes}",
    "quick diagram — {nodes}",
    "architecture for {nodes} please",
]

# Flowchart steps: (label, shape_type)
FLOW_STEPS = [
    ("Start", "circle"), ("End", "circle"),
    ("Receive Request", "rectangle"), ("Validate Input", "diamond"),
    ("Check Auth", "diamond"), ("Authenticate User", "rectangle"),
    ("Process Payment", "rectangle"), ("Send Confirmation", "rectangle"),
    ("Log Error", "rectangle"), ("Return Error", "rectangle"),
    ("Fetch Data", "rectangle"), ("Parse Response", "rectangle"),
    ("Cache Result", "rectangle"), ("Return Success", "rectangle"),
    ("Notify User", "rectangle"), ("Update Database", "rectangle"),
    ("Retry?", "diamond"), ("Max Retries?", "diamond"),
    ("Format Response", "rectangle"), ("Queue Job", "rectangle"),
]

FLOW_PROMPT_TEMPLATES = [
    "Create a flowchart for: {steps}",
    "Draw a process flow: {steps}",
    "Flowchart showing {steps}",
    "Map out the steps: {steps}",
    "I need a flow diagram — {steps}",
    "can you sketch the flow: {steps}",
    "process diagram with these steps: {steps}",
    "draw the happy path and error path for {steps}",
    "sequence of steps: {steps}",
]

# ERD entities: (label, shape_type)
ERD_ENTITIES = [
    ("User", "rectangle"), ("Order", "rectangle"), ("Product", "rectangle"),
    ("Category", "rectangle"), ("Review", "rectangle"), ("Address", "rectangle"),
    ("Payment", "rectangle"), ("Session", "rectangle"), ("Tag", "rectangle"),
    ("Inventory", "rectangle"), ("Project", "rectangle"), ("Task", "rectangle"),
    ("Comment", "rectangle"), ("Author", "rectangle"), ("Post", "rectangle"),
    ("Customer", "rectangle"), ("Ticket", "rectangle"), ("Agent", "rectangle"),
    ("Patient", "rectangle"), ("Doctor", "rectangle"), ("Appointment", "rectangle"),
    ("Student", "rectangle"), ("Course", "rectangle"), ("Instructor", "rectangle"),
    ("Warehouse", "rectangle"), ("Supplier", "rectangle"),
]

ERD_PROMPT_TEMPLATES = [
    "Create an ERD for a {domain} application with {entities}",
    "Draw an entity relationship diagram with {entities}",
    "Database schema for {entities}",
    "ERD showing {entities} and their relationships",
    "I need a data model for {entities}",
    "schema diagram: {entities}",
    "design a database with {entities}",
    "ERD diagram for a {domain} with {entities}",
    "ERD diagram for a {domain} tool with {entities}",
    "database schema for a {domain}: {entities}",
    "data model for {domain}: {entities}",
    "relational schema for {domain} with {entities}",
    "ERD with {entities}",
    "database tables for {entities}",
]

ERD_DOMAINS = ["e-commerce", "SaaS", "marketplace", "booking", "social media", "CMS", "fintech", "project management", "healthcare", "education", "inventory"]

# Sequence actors
SEQ_ACTORS = ["Client", "Browser", "Mobile App", "API Gateway", "Auth Service",
               "User Service", "Database", "Cache", "Queue", "Email Service",
               "Payment Gateway", "Third-party API"]

SEQ_PROMPT_TEMPLATES = [
    "Sequence diagram for {flow_name}: {actors}",
    "Draw a sequence for {flow_name} between {actors}",
    "Show the {flow_name} flow with {actors}",
    "how does {flow_name} work? actors: {actors}",
    "I need a sequence for {flow_name} — {actors}",
]

SEQ_FLOWS = ["user login", "payment processing", "file upload", "password reset",
             "OAuth2 authorization", "two-factor authentication", "order checkout",
             "API key validation", "webhook delivery", "token refresh"]

# Mindmap topics
MIND_TOPICS = [
    ("Product Roadmap", ["MVP Features", "Q3 Goals", "User Research", "Technical Debt", "Metrics"]),
    ("Software Architecture", ["Frontend", "Backend", "Database", "Infrastructure", "Security"]),
    ("Marketing Strategy", ["SEO", "Social Media", "Content", "Paid Ads", "Email"]),
    ("Team Onboarding", ["Access Setup", "Codebase Tour", "First Task", "Meetings", "Docs"]),
    ("API Design", ["Authentication", "Endpoints", "Versioning", "Rate Limiting", "Docs"]),
    ("Mobile App Launch", ["Design", "Development", "Marketing", "QA Testing", "App Store Approval"]),
    ("Event Planning", ["Venue Selection", "Catering", "Invitations", "Speaker Lineup", "Budget"]),
    ("Software Testing", ["Unit Tests", "Integration Tests", "End-to-End Tests", "Performance", "Security"]),
    ("Customer Journey", ["Discovery", "Evaluation", "Onboarding", "Retention", "Advocacy"]),
    ("Startup Ideation", ["Problem Statement", "Target Audience", "Solution", "Revenue Model", "Competitor Analysis"]),
    ("Career Growth", ["Technical Skills", "Communication", "Leadership", "Mentorship", "Certifications"]),
    ("DevOps Strategy", ["CI/CD Pipelines", "Container Orchestration", "Monitoring", "Automated Testing", "Cloud Infrastructure"]),
    ("Content Creation", ["Topic Research", "Drafting", "Editing", "Graphics", "Distribution Channels"]),
    ("Data Engineering Pipeline", ["Ingestion", "Cleaning", "Transformation", "Warehousing", "BI Dashboards"]),
    ("Cybersecurity Framework", ["Identity Management", "Threat Detection", "Incident Response", "Vulnerability Scanning", "Compliance"]),
    ("E-commerce Expansion", ["Payment Gateways", "Global Logistics", "Localization", "Customer Support", "Inventory Sync"]),
    ("Design System", ["Typography", "Color Tokens", "Component Library", "Accessibility Guidelines", "Figma Kit"]),
    ("Cloud Migration", ["Assessment", "Architecture Planning", "Data Transfer", "Testing", "Cutover"]),
    ("Performance Optimization", ["Database Indexing", "Caching", "Asset Bundling", "Lazy Loading", "CDN Configuration"]),
    ("Microservices Refactoring", ["Domain Boundaries", "Event Sourcing", "Service Mesh", "Distributed Tracing", "API Gateway"]),
]

MIND_PROMPT_TEMPLATES = [
    "Mind map for {topic}",
    "Draw a mindmap about {topic}",
    "brainstorm diagram for {topic}",
    "concept map: {topic} with {subtopics}",
    "organize ideas for {topic}",
    "mindmap for {topic}: {subtopics}",
    "mind map for {topic} — {subtopics}",
    "draw a mindmap for {topic} with {subtopics}",
    "create a mindmap for {topic}: {subtopics}",
    "concept map: {topic} with {subtopics}",
    "mindmap: {topic} including {subtopics}",
    "mindmap for {topic} with {subtopics}",
]

# Connector phrases for prompts (add variety)
CONNECTORS = [
    "connected to", "talking to", "calling", "which calls", "→", "→ then →",
    "that communicates with", "backed by", "in front of", "sitting behind",
]


# ---------------------------------------------------------------------------
# Diagram builders
# ---------------------------------------------------------------------------

def _make_id(prefix: str, idx: int) -> str:
    return f"{prefix}{idx + 1}"


def _make_edge(src: str, tgt: str, idx: int, style: str = "solid") -> dict:
    return {"id": f"e{idx + 1}", "source": src, "target": tgt, "label": "", "style": style}


def build_architecture(rng: random.Random) -> tuple[str, dict]:
    node_count = rng.randint(3, 8)
    selected = rng.sample(ARCH_NODES, node_count)

    nodes = []
    for i, (label, shape) in enumerate(selected):
        nodes.append({
            "id": _make_id("n", i),
            "type": shape,
            "label": label,
            "confidence": round(rng.uniform(0.88, 0.99), 2),
        })

    # Build a simple chain + a few cross-links
    edges = []
    for i in range(len(nodes) - 1):
        edges.append(_make_edge(nodes[i]["id"], nodes[i + 1]["id"], i))
    # 1-2 extra cross-links
    for _ in range(rng.randint(0, 2)):
        if len(nodes) >= 3:
            a, b = rng.sample(range(len(nodes)), 2)
            if a != b and not any(
                e["source"] == nodes[a]["id"] and e["target"] == nodes[b]["id"]
                for e in edges
            ):
                edges.append(_make_edge(nodes[a]["id"], nodes[b]["id"], len(edges)))

    labels = [n["label"] for n in nodes]
    # Build prompt with varied phrasing
    # Use connector words between some pairs
    if len(labels) <= 4:
        connector = rng.choice(CONNECTORS)
        mid = len(labels) // 2
        left = ", ".join(labels[:mid]) if mid > 1 else labels[0]
        right = ", ".join(labels[mid:]) if len(labels[mid:]) > 1 else labels[mid]
        nodes_str = f"{left} {connector} {right}"
    else:
        nodes_str = ", ".join(labels[:-1]) + f", and {labels[-1]}"

    template = rng.choice(ARCH_PROMPT_TEMPLATES)
    prompt = template.format(nodes=nodes_str)

    diagram = {
        "type": "architecture",
        "confidence": 0.92,
        "nodes": nodes,
        "edges": edges,
        "layoutHint": rng.choice(["hierarchical", "layered"]),
        "ambiguities": [],
    }
    return prompt, diagram


def build_flowchart(rng: random.Random) -> tuple[str, dict]:
    core_steps = rng.sample(FLOW_STEPS[2:], rng.randint(3, 6))
    # Always start with Start and end with End or a terminal
    steps = [FLOW_STEPS[0]] + core_steps + [FLOW_STEPS[1]]

    nodes = []
    for i, (label, shape) in enumerate(steps):
        nodes.append({
            "id": _make_id("n", i),
            "type": shape,
            "label": label,
            "confidence": round(rng.uniform(0.87, 0.99), 2),
        })

    edges = []
    for i in range(len(nodes) - 1):
        # Diamond nodes get dashed "no" branch sometimes
        style = "dashed" if nodes[i]["type"] == "diamond" and rng.random() < 0.3 else "solid"
        edges.append(_make_edge(nodes[i]["id"], nodes[i + 1]["id"], i, style))

    step_labels = [s[0] for s in steps]
    steps_str = " → ".join(step_labels)
    template = rng.choice(FLOW_PROMPT_TEMPLATES)
    prompt = template.format(steps=steps_str)

    diagram = {
        "type": "flowchart",
        "confidence": 0.90,
        "nodes": nodes,
        "edges": edges,
        "layoutHint": "hierarchical",
        "ambiguities": [],
    }
    return prompt, diagram


def build_erd(rng: random.Random) -> tuple[str, dict]:
    entity_count = rng.randint(3, 6)
    selected = rng.sample(ERD_ENTITIES, entity_count)

    nodes = []
    for i, (label, shape) in enumerate(selected):
        nodes.append({
            "id": _make_id("n", i),
            "type": shape,
            "label": label,
            "confidence": round(rng.uniform(0.88, 0.99), 2),
        })

    edges = []
    for i in range(len(nodes) - 1):
        style = rng.choice(["solid", "dashed"])
        edges.append(_make_edge(nodes[i]["id"], nodes[i + 1]["id"], i, style))

    # Add cross-relationship between existing entities
    if len(nodes) >= 4 and rng.random() < 0.6:
        a, b = rng.sample(range(len(nodes)), 2)
        if a != b and not any(
            e["source"] == nodes[a]["id"] and e["target"] == nodes[b]["id"]
            for e in edges
        ):
            edges.append(_make_edge(nodes[a]["id"], nodes[b]["id"], len(edges), "solid"))

    entity_labels = [n["label"] for n in nodes]
    entities_str = ", ".join(entity_labels[:-1]) + f", and {entity_labels[-1]}"
    domain = rng.choice(ERD_DOMAINS)
    template = rng.choice(ERD_PROMPT_TEMPLATES)
    prompt = template.format(domain=domain, entities=entities_str)

    diagram = {
        "type": "erd",
        "confidence": 0.91,
        "nodes": nodes,
        "edges": edges,
        "layoutHint": "layered",
        "ambiguities": [],
    }
    return prompt, diagram


def build_sequence(rng: random.Random) -> tuple[str, dict]:
    actor_count = rng.randint(3, 5)
    actors = rng.sample(SEQ_ACTORS, actor_count)
    flow_name = rng.choice(SEQ_FLOWS)

    nodes = [
        {"id": _make_id("n", i), "type": "actor", "label": a,
         "confidence": round(rng.uniform(0.87, 0.99), 2)}
        for i, a in enumerate(actors)
    ]

    edges = []
    # Sequence: chain with return arrows
    for i in range(len(nodes) - 1):
        edges.append(_make_edge(nodes[i]["id"], nodes[i + 1]["id"], len(edges)))
        if rng.random() < 0.6:
            edges.append(_make_edge(nodes[i + 1]["id"], nodes[i]["id"], len(edges), "dashed"))

    actors_str = " → ".join(actors)
    template = rng.choice(SEQ_PROMPT_TEMPLATES)
    prompt = template.format(flow_name=flow_name, actors=actors_str)

    diagram = {
        "type": "sequence",
        "confidence": 0.89,
        "nodes": nodes,
        "edges": edges,
        "layoutHint": "layered",
        "ambiguities": [],
    }
    return prompt, diagram


def build_mindmap(rng: random.Random) -> tuple[str, dict]:
    topic_label, subtopics_all = rng.choice(MIND_TOPICS)
    subtopics = rng.sample(subtopics_all, min(len(subtopics_all), rng.randint(3, 5)))

    # Root node + subtopic nodes
    nodes = [{"id": "n1", "type": "rectangle", "label": topic_label,
               "confidence": 0.95}]
    edges = []
    for i, sub in enumerate(subtopics):
        nid = _make_id("n", i + 1)
        nodes.append({"id": nid, "type": "rectangle", "label": sub,
                      "confidence": round(rng.uniform(0.87, 0.98), 2)})
        edges.append(_make_edge("n1", nid, i))

    subtopics_str = ", ".join(subtopics)
    template = rng.choice(MIND_PROMPT_TEMPLATES)
    prompt = template.format(topic=topic_label, subtopics=subtopics_str)

    diagram = {
        "type": "mindmap",
        "confidence": 0.93,
        "nodes": nodes,
        "edges": edges,
        "layoutHint": "radial",
        "ambiguities": [],
    }
    return prompt, diagram


BUILDERS = {
    "architecture": build_architecture,
    "flowchart": build_flowchart,
    "erd": build_erd,
    "sequence": build_sequence,
    "mindmap": build_mindmap,
}

DIAG_TYPE_WEIGHTS = [0.35, 0.25, 0.15, 0.15, 0.10]  # arch, flow, erd, seq, mind


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def load_seed_examples(seed_dir: Path) -> list[dict]:
    """Load hand-written examples from seed/seed.jsonl."""
    seed_file = seed_dir / "seed.jsonl"
    if not seed_file.exists():
        print(f"[INFO] No seed file found at {seed_file} — using synthetic data only.")
        return []
    examples = []
    with seed_file.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            try:
                obj = json.loads(line)
                if "prompt" not in obj or "diagram" not in obj:
                    print(f"[WARN] seed.jsonl line {lineno}: missing 'prompt' or 'diagram' key — skipped")
                    continue
                examples.append(obj)
            except json.JSONDecodeError as e:
                print(f"[WARN] seed.jsonl line {lineno}: JSON error — {e}")
    print(f"[INFO] Loaded {len(examples)} seed examples from {seed_file}")
    return examples


def generate_dataset(total_samples: int, seed: int, seed_examples: list[dict]) -> list[dict]:
    rng = random.Random(seed)
    dataset: list[dict] = []

    # Weave in seed examples at ~10:1 ratio
    synthetic_target = total_samples
    if seed_examples:
        repeats = math.ceil(total_samples / (10 * len(seed_examples)))
        seed_pool = seed_examples * repeats
        rng.shuffle(seed_pool)
        # We'll interleave: every 10 synthetic, insert 1 seed
        insert_at = set(range(9, total_samples + len(seed_pool), 10))
    else:
        seed_pool = []
        insert_at = set()

    seed_idx = 0
    synthetic_count = 0

    while synthetic_count < synthetic_target:
        if seed_idx < len(seed_pool) and len(dataset) in insert_at:
            dataset.append(seed_pool[seed_idx])
            seed_idx += 1
            continue

        diagram_type = rng.choices(DIAGRAM_TYPES, weights=DIAG_TYPE_WEIGHTS)[0]
        builder = BUILDERS[diagram_type]
        try:
            prompt, diagram = builder(rng)
            dataset.append({"prompt": prompt, "diagram": diagram})
        except Exception as e:
            print(f"[WARN] Builder {diagram_type} failed: {e}")
        synthetic_count += 1

    rng.shuffle(dataset)
    return dataset


def write_splits(dataset: list[dict], output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    n = len(dataset)
    n_train = int(n * 0.85)
    n_val = int(n * 0.10)

    splits = {
        "train": dataset[:n_train],
        "val": dataset[n_train: n_train + n_val],
        "test": dataset[n_train + n_val:],
    }

    for split_name, records in splits.items():
        out_path = output_dir / f"{split_name}.jsonl"
        with out_path.open("w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"[INFO] Wrote {len(records):,} examples -> {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate NLP->Diagram training data")
    parser.add_argument("--output_dir", default="ml/datasets/nlp_diagrams",
                        help="Directory to write train/val/test JSONL files")
    parser.add_argument("--seed_dir", default="ml/datasets/nlp_diagrams/seed",
                        help="Directory containing hand-written seed.jsonl examples")
    parser.add_argument("--total_samples", type=int, default=20000,
                        help="Total number of examples (synthetic + seed)")
    parser.add_argument("--random_seed", type=int, default=42)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    seed_dir = Path(args.seed_dir)

    print(f"[INFO] Generating {args.total_samples:,} NLP->Diagram training pairs ...")
    seed_examples = load_seed_examples(seed_dir)
    dataset = generate_dataset(args.total_samples, args.random_seed, seed_examples)
    write_splits(dataset, output_dir)
    print("[INFO] Done OK")


if __name__ == "__main__":
    main()
