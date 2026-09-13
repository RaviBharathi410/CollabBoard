"""
eval_nlp_model.py
Evaluates fine-tuned Flan-T5 model on held-out and messy human conversational prompts.

Usage:
  python ml/scripts/eval_nlp_model.py --model_dir ml/exports/nlp_model
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
except ImportError as e:
    sys.exit(f"[ERROR] Missing dependency: {e}")

INPUT_PREFIX = "Diagram: "

# Original 15 diverse held-out prompts
ORIGINAL_15_PROMPTS = [
    # 1. Colloquial / messy architecture
    {
        "prompt": "hey can you sketch out something like an auth flow with a token store",
        "expected_keywords": ["auth", "token"],
        "category": "colloquial",
    },
    {
        "prompt": "draw me a backend with api gateway, auth service, and postgres database",
        "expected_keywords": ["gateway", "auth", "postgres"],
        "category": "architecture",
    },
    {
        "prompt": "quick diagram of a payment webhook pipeline that hits stripe, saves to db and sends an sqs message",
        "expected_keywords": ["payment", "stripe", "db", "sqs"],
        "category": "colloquial",
    },
    {
        "prompt": "can you map out an e-commerce system with web app, cart service, order service, and mysql",
        "expected_keywords": ["web", "cart", "order", "mysql"],
        "category": "architecture",
    },
    {
        "prompt": "I need a caching architecture with cloudflare cdn, fastify server, redis, and mongodb",
        "expected_keywords": ["cdn", "redis", "mongodb"],
        "category": "architecture",
    },
    # 2. Event-driven & queues
    {
        "prompt": "microservices architecture with api gateway, inventory service, notification service, and kafka topic",
        "expected_keywords": ["gateway", "inventory", "notification", "kafka"],
        "category": "architecture",
    },
    {
        "prompt": "sketch a logging pipeline: fluentbit collectors push to kafka, logstash processes, elasticsearch stores",
        "expected_keywords": ["kafka", "elasticsearch"],
        "category": "architecture",
    },
    # 3. Flowcharts & user flows
    {
        "prompt": "flowchart for user password reset: user enters email, system checks db, sends reset link, user updates password",
        "expected_keywords": ["email", "password", "reset"],
        "category": "flowchart",
    },
    {
        "prompt": "create a flowchart for document approval: author submits, manager reviews, if approved publish else reject",
        "expected_keywords": ["submit", "review", "approve"],
        "category": "flowchart",
    },
    # 4. ERD / Data models
    {
        "prompt": "ERD diagram for a project management tool: Users have Projects, Projects have Tasks, Tasks have Comments",
        "expected_keywords": ["user", "project", "task"],
        "category": "erd",
    },
    {
        "prompt": "database schema for a blog: authors, posts, categories, and tags",
        "expected_keywords": ["author", "post", "category", "tag"],
        "category": "erd",
    },
    # 5. Sequence diagrams
    {
        "prompt": "sequence diagram for user login: client sends credentials to auth service, auth validates with db, returns jwt token",
        "expected_keywords": ["client", "auth", "db", "token"],
        "category": "sequence",
    },
    # 6. Mindmaps
    {
        "prompt": "mindmap for a mobile app launch: design, development, marketing, qa testing, app store approval",
        "expected_keywords": ["design", "development", "marketing"],
        "category": "mindmap",
    },
    # 7. Ultra-short / colloquial prompts
    {
        "prompt": "simple setup with client, load balancer, and two web servers",
        "expected_keywords": ["client", "balancer", "server"],
        "category": "colloquial",
    },
    {
        "prompt": "draw a search service with elasticsearch and redis cache",
        "expected_keywords": ["search", "elasticsearch", "redis"],
        "category": "architecture",
    },
]

# Expanded 30-prompt evaluation set (5 per category across 6 categories)
EXPANDED_30_PROMPTS = [
    # Architecture (5)
    {
        "prompt": "draw me a backend with api gateway, auth service, and postgres database",
        "expected_keywords": ["gateway", "auth", "postgres"],
        "category": "architecture",
    },
    {
        "prompt": "can you map out an e-commerce system with web app, cart service, order service, and mysql",
        "expected_keywords": ["web", "cart", "order", "mysql"],
        "category": "architecture",
    },
    {
        "prompt": "I need a caching architecture with cloudflare cdn, fastify server, redis, and mongodb",
        "expected_keywords": ["cdn", "redis", "mongodb"],
        "category": "architecture",
    },
    {
        "prompt": "microservices architecture with api gateway, inventory service, notification service, and kafka topic",
        "expected_keywords": ["gateway", "inventory", "notification", "kafka"],
        "category": "architecture",
    },
    {
        "prompt": "sketch a logging pipeline: fluentbit collectors push to kafka, logstash processes, elasticsearch stores",
        "expected_keywords": ["kafka", "elasticsearch"],
        "category": "architecture",
    },
    # Flowchart (5)
    {
        "prompt": "flowchart for user password reset: user enters email, system checks db, sends reset link, user updates password",
        "expected_keywords": ["email", "password", "reset"],
        "category": "flowchart",
    },
    {
        "prompt": "create a flowchart for document approval: author submits, manager reviews, if approved publish else reject",
        "expected_keywords": ["submit", "review", "approve"],
        "category": "flowchart",
    },
    {
        "prompt": "checkout process flowchart: select items -> enter shipping -> pay by card -> send email confirmation -> update stock",
        "expected_keywords": ["shipping", "card", "email", "stock"],
        "category": "flowchart",
    },
    {
        "prompt": "user onboarding flow: sign up with email -> verify email -> fill profile -> select interests -> take product tour -> dashboard",
        "expected_keywords": ["email", "profile", "tour", "dashboard"],
        "category": "flowchart",
    },
    {
        "prompt": "order fulfillment process: order received -> check inventory (if out of stock notify buyer) -> pack items -> ship -> delivered",
        "expected_keywords": ["order", "inventory", "pack", "ship"],
        "category": "flowchart",
    },
    # ERD (5)
    {
        "prompt": "ERD diagram for a project management tool: Users have Projects, Projects have Tasks, Tasks have Comments",
        "expected_keywords": ["user", "project", "task", "comment"],
        "category": "erd",
    },
    {
        "prompt": "database schema for a blog: authors, posts, categories, and tags",
        "expected_keywords": ["author", "post", "category", "tag"],
        "category": "erd",
    },
    {
        "prompt": "data model for online university: students, courses, enrollments, instructors",
        "expected_keywords": ["student", "course", "enrollment", "instructor"],
        "category": "erd",
    },
    {
        "prompt": "relational schema for online store with customers, orders, order items, products",
        "expected_keywords": ["customer", "order", "item", "product"],
        "category": "erd",
    },
    {
        "prompt": "ERD for clinic management: patients, doctors, appointments, medical records",
        "expected_keywords": ["patient", "doctor", "appointment", "record"],
        "category": "erd",
    },
    # Sequence (5)
    {
        "prompt": "sequence diagram for user login: client sends credentials to auth service, auth validates with db, returns jwt token",
        "expected_keywords": ["client", "auth", "db", "token"],
        "category": "sequence",
    },
    {
        "prompt": "show sequence for payment checkout: customer -> checkout service -> stripe gateway -> banking api -> receipt email",
        "expected_keywords": ["customer", "checkout", "stripe", "banking", "receipt"],
        "category": "sequence",
    },
    {
        "prompt": "token refresh sequence: client -> api gateway -> auth service -> database lookup -> return new token",
        "expected_keywords": ["client", "gateway", "auth", "token"],
        "category": "sequence",
    },
    {
        "prompt": "file upload sequence: mobile app -> upload service -> s3 storage -> metadata written to postgres -> thumbnail worker",
        "expected_keywords": ["upload", "storage", "postgres", "thumbnail"],
        "category": "sequence",
    },
    {
        "prompt": "oauth2 authorization code grant: user browser -> auth server -> redirect with code -> backend exchanges token -> session ready",
        "expected_keywords": ["browser", "auth", "token", "session"],
        "category": "sequence",
    },
    # Mindmap (5)
    {
        "prompt": "mindmap for a mobile app launch: design, development, marketing, qa testing, app store approval",
        "expected_keywords": ["design", "development", "marketing", "testing"],
        "category": "mindmap",
    },
    {
        "prompt": "concept map: event planning with venue selection, catering, invitations, speaker lineup, and budget",
        "expected_keywords": ["venue", "catering", "invitation", "budget"],
        "category": "mindmap",
    },
    {
        "prompt": "mind map for software testing: unit tests, integration tests, end-to-end tests, performance, security",
        "expected_keywords": ["unit", "integration", "performance", "security"],
        "category": "mindmap",
    },
    {
        "prompt": "brainstorm diagram for customer journey: discovery, evaluation, onboarding, retention, advocacy",
        "expected_keywords": ["discovery", "evaluation", "onboarding", "retention"],
        "category": "mindmap",
    },
    {
        "prompt": "mindmap for startup ideation: problem statement, target audience, solution, revenue model, competitor analysis",
        "expected_keywords": ["problem", "audience", "solution", "revenue"],
        "category": "mindmap",
    },
    # Colloquial (5)
    {
        "prompt": "hey can you sketch out something like an auth flow with a token store",
        "expected_keywords": ["auth", "token"],
        "category": "colloquial",
    },
    {
        "prompt": "quick diagram of a payment webhook pipeline that hits stripe, saves to db and sends an sqs message",
        "expected_keywords": ["payment", "stripe", "db", "sqs"],
        "category": "colloquial",
    },
    {
        "prompt": "simple setup with client, load balancer, and two web servers",
        "expected_keywords": ["client", "balancer", "server"],
        "category": "colloquial",
    },
    {
        "prompt": "can you draw something with redis cache, node server, and postgres db please",
        "expected_keywords": ["redis", "node", "postgres"],
        "category": "colloquial",
    },
    {
        "prompt": "sketch a quick pipeline: react app talks to fastapi backend which dumps raw logs into clickhouse",
        "expected_keywords": ["react", "fastapi", "clickhouse"],
        "category": "colloquial",
    },
]

# Dedicated 15 ERD-only prompt benchmark
ERD_15_PROMPTS = [
    {"prompt": "database schema for a blog: authors, posts, categories, and tags", "expected_keywords": ["author", "post", "category", "tag"], "category": "erd"},
    {"prompt": "ERD diagram for a project management tool: Users have Projects, Projects have Tasks, Tasks have Comments", "expected_keywords": ["user", "project", "task", "comment"], "category": "erd"},
    {"prompt": "data model for online university: students, courses, enrollments, instructors", "expected_keywords": ["student", "course", "enrollment", "instructor"], "category": "erd"},
    {"prompt": "relational schema for online store with customers, orders, order items, products", "expected_keywords": ["customer", "order", "item", "product"], "category": "erd"},
    {"prompt": "ERD for clinic management: patients, doctors, appointments, medical records", "expected_keywords": ["patient", "doctor", "appointment", "record"], "category": "erd"},
    {"prompt": "database schema for food delivery app: customers, restaurants, menu items, orders, delivery drivers", "expected_keywords": ["customer", "restaurant", "menu", "order", "driver"], "category": "erd"},
    {"prompt": "data model for social media: users, followers, posts, likes, comments", "expected_keywords": ["user", "follower", "post", "like", "comment"], "category": "erd"},
    {"prompt": "ERD for ride sharing: riders, drivers, vehicles, rides, payments, ratings", "expected_keywords": ["rider", "driver", "vehicle", "ride", "payment"], "category": "erd"},
    {"prompt": "database design for streaming platform: subscribers, subscription plans, movies, genres, watch history", "expected_keywords": ["subscriber", "plan", "movie", "genre"], "category": "erd"},
    {"prompt": "schema for airline flight booking: passengers, flights, airports, bookings, seats, tickets", "expected_keywords": ["passenger", "flight", "airport", "booking"], "category": "erd"},
    {"prompt": "relational schema for real estate portal: agents, properties, owners, client inquiries, viewing appointments", "expected_keywords": ["agent", "property", "owner", "inquiry"], "category": "erd"},
    {"prompt": "ERD for banking core: accounts, customers, transactions, branches, cards", "expected_keywords": ["account", "customer", "transaction", "branch", "card"], "category": "erd"},
    {"prompt": "database schema for music app: artists, albums, tracks, playlists, users", "expected_keywords": ["artist", "album", "track", "playlist", "user"], "category": "erd"},
    {"prompt": "schema diagram for inventory system: warehouses, products, stock levels, suppliers", "expected_keywords": ["warehouse", "product", "stock", "supplier"], "category": "erd"},
    {"prompt": "ERD for helpdesk tool: tickets, agents, customers, messages, departments", "expected_keywords": ["ticket", "agent", "customer", "message", "department"], "category": "erd"},
]

HELD_OUT_PROMPTS = ORIGINAL_15_PROMPTS


def repair_and_parse_diagram(raw: str) -> dict:
    raw = raw.strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    s = raw
    if not s.startswith("{"):
        s = "{" + s
    if not s.endswith("}"):
        s = s + "}"

    try:
        data = json.loads(s)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    def fix_object_array(match):
        arr_content = match.group(1).strip()
        if not arr_content:
            return "[]"
        if arr_content.startswith("{"):
            return "[" + arr_content + "]"
        items = re.split(r'(?="id"\s*:)', arr_content)
        fixed_items = []
        for it in items:
            it = it.strip().rstrip(",")
            if it:
                if not it.startswith("{"):
                    it = "{" + it
                if not it.endswith("}"):
                    it = it + "}"
                fixed_items.append(it)
        return "[" + ", ".join(fixed_items) + "]"

    s = re.sub(r'"nodes"\s*:\s*\[([\s\S]*?)\]', lambda m: '"nodes": ' + fix_object_array(m), s)
    s = re.sub(r'"edges"\s*:\s*\[([\s\S]*?)\]', lambda m: '"edges": ' + fix_object_array(m), s)

    return json.loads(s)


def sanitize_and_heal_graph(diagram: dict) -> tuple[dict, dict]:
    """
    Defensive structured-output validation and repair.
    - Prunes phantom edges pointing to non-existent nodes.
    - Stitches orphan nodes so every extracted node participates in the diagram.
    Returns (repaired_diagram, healing_telemetry).
    """
    nodes = diagram.get("nodes", [])
    edges = diagram.get("edges", [])
    node_ids = [n.get("id") for n in nodes if isinstance(n, dict) and "id" in n]
    node_id_set = set(node_ids)

    pruned_edges = []
    valid_edges = []

    # 1. Prune phantom edges referencing non-existent IDs
    for e in edges:
        if not isinstance(e, dict):
            continue
        src = e.get("source") or e.get("from")
        tgt = e.get("target") or e.get("to")
        if src in node_id_set and tgt in node_id_set:
            valid_edges.append(e)
        else:
            pruned_edges.append(f"{src}->{tgt}")

    # 2. Check connectivity and stitch orphan nodes
    connected_nodes = set()
    for e in valid_edges:
        s = e.get("source") or e.get("from")
        t = e.get("target") or e.get("to")
        connected_nodes.add(s)
        connected_nodes.add(t)

    orphans = [nid for nid in node_ids if nid not in connected_nodes]
    healed_edges = []

    if orphans and len(node_ids) > 1:
        diag_type = str(diagram.get("type", "")).lower()
        if diag_type == "mindmap" and "n1" in node_id_set:
            for o in orphans:
                if o != "n1":
                    eid = f"e{len(valid_edges) + len(healed_edges) + 1}"
                    new_edge = {"id": eid, "source": "n1", "target": o, "label": "", "style": "solid"}
                    healed_edges.append(new_edge)
        else:
            for o in orphans:
                idx = node_ids.index(o)
                anchor = node_ids[idx - 1] if idx > 0 else (node_ids[1] if len(node_ids) > 1 else None)
                if anchor and anchor != o:
                    eid = f"e{len(valid_edges) + len(healed_edges) + 1}"
                    new_edge = {"id": eid, "source": anchor, "target": o, "label": "", "style": "solid"}
                    healed_edges.append(new_edge)

    repaired = dict(diagram)
    repaired["edges"] = valid_edges + healed_edges

    healing_applied = (len(pruned_edges) > 0) or (len(healed_edges) > 0)
    telemetry = {
        "healing_applied": healing_applied,
        "phantom_edges_pruned": pruned_edges,
        "orphan_nodes_healed": [e["target"] for e in healed_edges],
    }
    return repaired, telemetry


def evaluate(model_dir: str, prompt_list: list = None, device_str: str = None):
    model_path = Path(model_dir)
    if not model_path.exists():
        sys.exit(f"[ERROR] Model directory not found: {model_dir}")

    if device_str:
        device = device_str
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[INFO] Loading model from {model_path} on {device}...")
    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForSeq2SeqLM.from_pretrained(str(model_path)).to(device)
    model.eval()

    prompts_to_test = prompt_list if prompt_list is not None else HELD_OUT_PROMPTS
    print(f"[INFO] Running evaluation on {len(prompts_to_test)} prompts...\n")

    results = []
    valid_json_count = 0
    raw_connected_count = 0
    healed_connected_count = 0
    healing_applied_count = 0
    keyword_hit_count = 0

    category_stats = {}

    for i, test_case in enumerate(prompts_to_test, 1):
        cat = test_case["category"]
        if cat not in category_stats:
            category_stats[cat] = {
                "total": 0, "json": 0, "raw_connected": 0, "healed_connected": 0, "healed_count": 0
            }
        category_stats[cat]["total"] += 1

        prompt = test_case["prompt"]
        formatted_input = INPUT_PREFIX + prompt
        inputs = tokenizer(formatted_input, return_tensors="pt", max_length=256, truncation=True).to(device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                num_beams=2,
                early_stopping=True,
                return_dict_in_generate=True,
                output_scores=True,
            )

        output_ids = outputs.sequences
        raw_output = tokenizer.decode(output_ids[0], skip_special_tokens=True)

        computed_conf = 0.85
        if hasattr(model, "compute_transition_scores") and hasattr(outputs, "scores") and outputs.scores:
            try:
                trans_scores = model.compute_transition_scores(
                    sequences=outputs.sequences,
                    scores=outputs.scores,
                    beam_indices=getattr(outputs, "beam_indices", None),
                    normalize_logits=True,
                )
                valid_scores = trans_scores[~torch.isnan(trans_scores) & ~torch.isinf(trans_scores)]
                if len(valid_scores) > 0:
                    computed_conf = round(float(torch.exp(valid_scores.mean()).item()), 4)
            except Exception:
                pass

        parsed = None
        is_json = False
        raw_is_connected = False
        healed_is_connected = False
        healing_applied = False
        pruned_edges = []
        healed_orphans = []

        try:
            parsed = repair_and_parse_diagram(raw_output)
            if isinstance(parsed, dict) and "nodes" in parsed and len(parsed["nodes"]) > 0:
                is_json = True
                valid_json_count += 1
                category_stats[cat]["json"] += 1
        except Exception:
            pass

        node_labels = []
        edge_count = 0
        if is_json and isinstance(parsed, dict):
            nodes = parsed.get("nodes", [])
            edges = parsed.get("edges", [])
            edge_count = len(edges)
            node_ids = {n.get("id") for n in nodes if isinstance(n, dict)}
            node_labels = [n.get("label", "") for n in nodes if isinstance(n, dict)]

            # 1. Evaluate RAW model graph validity (pre-repair)
            bad_edges = []
            connected_raw = set()
            for e in edges:
                if not isinstance(e, dict):
                    bad_edges.append(e)
                    continue
                s = e.get("source") or e.get("from")
                t = e.get("target") or e.get("to")
                if s not in node_ids or t not in node_ids:
                    bad_edges.append(f"{s}->{t}")
                if s in node_ids: connected_raw.add(s)
                if t in node_ids: connected_raw.add(t)

            orphan_count = len(node_ids - connected_raw) if len(node_ids) > 1 else 0
            if len(bad_edges) == 0 and orphan_count == 0 and (len(edges) > 0 or len(nodes) == 1):
                raw_is_connected = True
                raw_connected_count += 1
                category_stats[cat]["raw_connected"] += 1

            # 2. Defensive Structured-Output Validation and Repair (healing)
            repaired_diagram, tele = sanitize_and_heal_graph(parsed)
            healing_applied = tele["healing_applied"]
            pruned_edges = tele["phantom_edges_pruned"]
            healed_orphans = tele["orphan_nodes_healed"]

            if healing_applied:
                healing_applied_count += 1
                category_stats[cat]["healed_count"] += 1

            # Check healed graph validity
            healed_edges = repaired_diagram.get("edges", [])
            healed_bad = [e for e in healed_edges if (e.get("source") not in node_ids or e.get("target") not in node_ids)]
            healed_conn = {e.get("source") for e in healed_edges} | {e.get("target") for e in healed_edges}
            if len(healed_bad) == 0 and len(node_ids - healed_conn) == 0:
                healed_is_connected = True
                healed_connected_count += 1
                category_stats[cat]["healed_connected"] += 1

            # Keyword matching
            combined_text = " ".join(node_labels).lower()
            expected = test_case.get("expected_keywords", [])
            if expected:
                hits = sum(1 for kw in expected if kw.lower() in combined_text)
                keyword_ratio = hits / len(expected)
                if keyword_ratio >= 0.4:
                    keyword_hit_count += 1

        results.append({
            "idx": i,
            "prompt": prompt,
            "category": cat,
            "is_json": is_json,
            "confidence": computed_conf if is_json else None,
            "raw_is_connected": raw_is_connected,
            "healed_is_connected": healed_is_connected,
            "healing_applied": healing_applied,
            "pruned_edges": pruned_edges,
            "healed_orphans": healed_orphans,
            "node_count": len(node_labels),
            "edge_count": edge_count,
            "nodes": node_labels,
        })

    # Summary table
    total = len(prompts_to_test)
    json_rate = (valid_json_count / total) * 100
    raw_graph_rate = (raw_connected_count / total) * 100
    healed_graph_rate = (healed_connected_count / total) * 100
    healing_rate = (healing_applied_count / total) * 100
    keyword_rate = (keyword_hit_count / total) * 100

    print("=" * 102)
    print(f"{'#':<3} | {'Category':<12} | {'JSON?':<6} | {'Raw Conn?':<10} | {'Healed?':<8} | {'Conf':<7} | {'Nodes':<5} | {'Edges':<5} | {'Prompt':<26}")
    print("-" * 102)
    for r in results:
        json_mark = "YES" if r["is_json"] else "NO"
        raw_mark = "YES" if r["raw_is_connected"] else "NO"
        healed_mark = "HEALED" if r["healing_applied"] else ("OK" if r["raw_is_connected"] else "-")
        conf_str = f"{r['confidence']:.4f}" if r["confidence"] is not None else "  -   "
        prompt_trunc = r["prompt"][:24] + ".." if len(r["prompt"]) > 26 else r["prompt"]
        print(f"{r['idx']:<3} | {r['category']:<12} | {json_mark:<6} | {raw_mark:<10} | {healed_mark:<8} | {conf_str:<7} | {r['node_count']:<5} | {r['edge_count']:<5} | {prompt_trunc:<26}")
        if r["pruned_edges"] or r["healed_orphans"]:
            details = []
            if r["pruned_edges"]: details.append(f"pruned: {r['pruned_edges']}")
            if r["healed_orphans"]: details.append(f"stitched orphans: {r['healed_orphans']}")
            print(f"    --> [Repair action] {'; '.join(details)}")
    print("=" * 102)

    print("\n--- PER-CATEGORY BREAKDOWN ---")
    print(f"{'Category':<14} | {'Total':<6} | {'JSON':<6} | {'Raw Connected':<14} | {'Post-Repair Conn':<18} | {'Healing Needed':<15}")
    print("-" * 85)
    for cat, stats in category_stats.items():
        print(f"{cat:<14} | {stats['total']:<6} | {stats['json']:<6} | {stats['raw_connected']:<14} | {stats['healed_connected']:<18} | {stats['healed_count']:<15}")
    print("-" * 85)

    # Confidence vs Quality Analysis
    clean_confs = [r["confidence"] for r in results if r["is_json"] and not r["healing_applied"] and r["confidence"] is not None]
    healed_confs = [r["confidence"] for r in results if r["is_json"] and r["healing_applied"] and r["confidence"] is not None]

    avg_clean = sum(clean_confs) / len(clean_confs) if clean_confs else 0.0
    avg_healed = sum(healed_confs) / len(healed_confs) if healed_confs else 0.0
    all_confs = clean_confs + healed_confs
    avg_all = sum(all_confs) / len(all_confs) if all_confs else 0.0

    print("\n--- EVALUATION SCORECARD ---")
    print(f"Total Held-Out Prompts:             {total}")
    print(f"Valid JSON Output Rate:             {json_rate:.1f}% ({valid_json_count}/{total})")
    print(f"Raw Model Connected Graph Rate:     {raw_graph_rate:.1f}% ({raw_connected_count}/{total})  [strictly raw model output]")
    print(f"Post-Repair Connected Graph Rate:   {healed_graph_rate:.1f}% ({healed_connected_count}/{total})  [after defensive validation]")
    print(f"Repair / Healing Trigger Rate:      {healing_rate:.1f}% ({healing_applied_count}/{total})  [required defensive repair]")
    print(f"Semantic Keyword Match Rate:        {keyword_rate:.1f}% ({keyword_hit_count}/{total})")
    print("-" * 50)
    print("--- COMPUTED CONFIDENCE & QUALITY CORRELATION ---")
    print(f"Overall Average Computed Confidence: {avg_all:.4f} (range: {min(all_confs):.4f} - {max(all_confs):.4f})" if all_confs else "N/A")
    print(f"Clean Output Confidence (no repair):  {avg_clean:.4f} (n={len(clean_confs)})")
    print(f"Healed Output Confidence (needed fix):{avg_healed:.4f} (n={len(healed_confs)})")
    diff = avg_clean - avg_healed
    print(f"Confidence Gap (Clean vs. Healed):    {diff:+.4f}")
    if diff > 0.005:
        print("--> Correlation observed: Model is measurably more confident on structurally sound generations.")
    elif diff < -0.005:
        print("--> Note: Model is slightly more confident on healed cases (phantom edges generated with high local confidence).")
    else:
        print("--> Note: Confidence is approximately equal across clean and healed outputs (phantom edge is an uncalibrated extrapolation).")
    print("-" * 50)
    print("----------------------------\n")

    return {
        "total": total,
        "json_rate": json_rate,
        "raw_graph_rate": raw_graph_rate,
        "healed_graph_rate": healed_graph_rate,
        "healing_rate": healing_rate,
        "keyword_rate": keyword_rate,
        "results": results,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate fine-tuned NLP model")
    parser.add_argument("--model_dir", default="ml/exports/nlp_model", help="Path to model directory")
    parser.add_argument("--eval_set", choices=["original15", "expanded30", "erd15", "all"], default="expanded30",
                        help="Which prompt set to evaluate against")
    parser.add_argument("--device", choices=["cuda", "cpu"], default=None,
                        help="Explicit device to run evaluation on (default: auto)")
    args = parser.parse_args()

    if args.eval_set == "original15":
        evaluate(args.model_dir, ORIGINAL_15_PROMPTS, device_str=args.device)
    elif args.eval_set == "expanded30":
        evaluate(args.model_dir, EXPANDED_30_PROMPTS, device_str=args.device)
    elif args.eval_set == "erd15":
        print("=== EVALUATION: 15 ERD-ONLY PROMPTS ===")
        evaluate(args.model_dir, ERD_15_PROMPTS, device_str=args.device)
    else:
        print("=== EVALUATION SET 1: EXPANDED 30 PROMPTS ===")
        evaluate(args.model_dir, EXPANDED_30_PROMPTS, device_str=args.device)
        print("\n=== EVALUATION SET 2: DEDICATED 15 ERD PROMPTS ===")
        evaluate(args.model_dir, ERD_15_PROMPTS, device_str=args.device)

