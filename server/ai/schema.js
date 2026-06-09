import { z } from 'zod';

export const DiagramSchema = z.object({
  type: z.enum(['architecture', 'flowchart', 'erd', 'sequence', 'mindmap', 'unknown']),
  confidence: z.number().min(0).max(1),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      confidence: z.number().min(0).max(1),
      properties: z.record(z.any()).optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().optional(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
      bidirectional: z.boolean().optional(),
      style: z.enum(['solid', 'dashed', 'dotted']).optional(),
    })
  ),
  ambiguities: z
    .array(
      z.object({
        nodeId: z.string(),
        question: z.string(),
        options: z.array(z.string()),
      })
    )
    .optional()
    .default([]),
  layoutHint: z.string().optional(),
});

export const AskResponseSchema = z.object({
  answer: z.string(),
  suggestions: z
    .array(
      z.object({
        type: z.enum(['add_node', 'add_edge', 'modify_label', 'add_group']),
        description: z.string(),
        autoApply: z.boolean().optional(),
        shape: z.record(z.any()).optional(),
      })
    )
    .optional()
    .default([]),
});

export function parseDiagramJson(text) {
  const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const raw = JSON.parse(jsonStr);
  return DiagramSchema.parse(raw);
}
