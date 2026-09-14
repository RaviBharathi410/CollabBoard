import { z } from 'zod';

export const DiagramSchema = z.object({
  type: z.enum(['architecture', 'flowchart', 'erd', 'sequence', 'mindmap', 'class_diagram', 'unknown']),
  confidence: z.number().min(0).max(1),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      confidence: z.number().min(0).max(1),
      properties: z.record(z.any()).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
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
      points: z.array(z.array(z.number())).optional(),
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

  // Normalize node coordinates from 0-1000 grid to 1200x800 canvas scale if normalized
  if (Array.isArray(raw.nodes)) {
    const hasNormalizedCoords = raw.nodes.some(n => typeof n.x === 'number' && typeof n.y === 'number');
    if (hasNormalizedCoords) {
      const maxCoord = Math.max(...raw.nodes.flatMap(n => [n.x || 0, n.y || 0]));
      // If coordinates are in 0-1000 space, scale to comfortable whiteboard canvas size (1200x800)
      const scaleX = (maxCoord <= 1050 && maxCoord > 0) ? 1.25 : 1.0;
      const scaleY = (maxCoord <= 1050 && maxCoord > 0) ? 0.95 : 1.0;
      raw.nodes = raw.nodes.map(n => ({
        ...n,
        x: typeof n.x === 'number' ? Math.round(n.x * scaleX) : undefined,
        y: typeof n.y === 'number' ? Math.round(n.y * scaleY) : undefined,
        width: typeof n.width === 'number' ? Math.round(n.width * scaleX) : undefined,
        height: typeof n.height === 'number' ? Math.round(n.height * scaleY) : undefined,
      }));
    }
  }

  return DiagramSchema.parse(raw);
}
