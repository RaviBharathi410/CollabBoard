import { describe, it, expect } from 'vitest';
import { detectDiagramFormat, analyzeSvgContent, isRasterImageBuffer } from '../formatRouter.js';

describe('formatRouter', () => {
  describe('isRasterImageBuffer', () => {
    it('detects PNG magic bytes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      expect(isRasterImageBuffer(pngHeader)).toBe(true);
    });

    it('detects JPEG magic bytes', () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      expect(isRasterImageBuffer(jpegHeader)).toBe(true);
    });

    it('detects WEBP magic bytes', () => {
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(isRasterImageBuffer(webpHeader)).toBe(true);
    });

    it('returns false for text / non-image buffers', () => {
      const textBuf = Buffer.from('<xml><data>test</data></xml>');
      expect(isRasterImageBuffer(textBuf)).toBe(false);
    });
  });

  describe('analyzeSvgContent', () => {
    it('identifies vector SVG containing rect and text', () => {
      const svg = '<svg><rect x="10" y="10" width="100" height="50"/><text x="20" y="30">Service</text></svg>';
      const result = analyzeSvgContent(svg);
      expect(result.isVector).toBe(true);
      expect(result.hasRasterFallback).toBe(false);
    });

    it('triggers raster fallback when SVG only contains <image> and no shapes', () => {
      const svg = '<svg><image href="data:image/png;base64,iVBORw0KGgo..." width="500" height="300"/></svg>';
      const result = analyzeSvgContent(svg);
      expect(result.isVector).toBe(false);
      expect(result.hasRasterFallback).toBe(true);
    });
  });

  describe('detectDiagramFormat', () => {
    it('detects draw.io from raw mxGraphModel XML even if named diagram.txt', () => {
      const xml = `
        <mxfile host="app.diagrams.net">
          <diagram id="p1" name="Page-1">
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Auth" vertex="1" parent="1"/>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>
      `;
      const detected = detectDiagramFormat('diagram.txt', xml);
      expect(detected.format).toBe('drawio');
      expect(detected.isStructured).toBe(true);
    });

    it('detects Mermaid diagram syntax', () => {
      const mermaid = `
        graph TD
          A[Client] -->|HTTPS| B(Gateway)
          B --> C[(Postgres)]
      `;
      const detected = detectDiagramFormat('architecture.mmd', mermaid);
      expect(detected.format).toBe('mermaid');
      expect(detected.isStructured).toBe(true);
    });

    it('detects vector SVG format', () => {
      const svg = '<svg width="400" height="200"><rect x="10" y="10" width="80" height="40"/><text x="20" y="30">API</text></svg>';
      const detected = detectDiagramFormat('export.svg', svg);
      expect(detected.format).toBe('svg');
      expect(detected.isStructured).toBe(true);
    });

    it('routes flattened raster SVG to raster_image pipeline (SVG fallback rule)', () => {
      const svgWithImage = '<svg><image href="data:image/png;base64,iVBORw..." width="800" height="600"/></svg>';
      const detected = detectDiagramFormat('whiteboard_export.svg', svgWithImage);
      expect(detected.format).toBe('raster_image');
      expect(detected.isStructured).toBe(false);
      expect(detected.reason).toContain('falling back to image vision pipeline');
    });

    it('detects raster PNG even if extension is missing or misleading', () => {
      const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00]);
      const detected = detectDiagramFormat('sketch.txt', pngBuf);
      expect(detected.format).toBe('raster_image');
      expect(detected.mimeType).toBe('image/png');
      expect(detected.isStructured).toBe(false);
    });
  });
});
