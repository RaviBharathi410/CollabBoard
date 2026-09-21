/**
 * UMLClassNode.test.js
 * Unit tests for UML class content parsing, line wrap estimation, and zero text leakage sizing.
 */

import { describe, it, expect } from 'vitest';
import { parseUmlClassContent, estimateWrappedLines } from './UMLClassNode.jsx';

describe('UMLClassNode', () => {
  describe('estimateWrappedLines', () => {
    it('returns 1 for lines shorter than charsPerLine', () => {
      const lines = ['+ render()', '+ close()'];
      expect(estimateWrappedLines(lines, 25)).toBe(2);
    });

    it('accurately counts wrapped lines for long signatures like +area(...)', () => {
      const method = '+area(in radius : float) : double'; // 33 characters
      // With maxChars = 20, words will wrap into 2 lines
      const wrappedCount = estimateWrappedLines([method], 20);
      expect(wrappedCount).toBe(2);
    });

    it('handles multiple methods with wrapping', () => {
      const methods = [
        '+ area(in radius : float) : double', // wraps (2 lines)
        '+ circum()', // 1 line
        '+ setRadius()', // 1 line
      ];
      const count = estimateWrappedLines(methods, 20);
      expect(count).toBe(4);
    });

    it('returns 1 as minimum for empty array', () => {
      expect(estimateWrappedLines([], 20)).toBe(1);
    });
  });

  describe('parseUmlClassContent', () => {
    it('parses structured fields and methods when provided directly', () => {
      const shape = {
        name: 'Window',
        stereotype: '<<entity>>',
        attributes: ['- width: Int', '- height: Int'],
        methods: ['+ open()', '+ close()'],
      };
      const parsed = parseUmlClassContent(shape);
      expect(parsed.name).toBe('Window');
      expect(parsed.stereotype).toBe('<<entity>>');
      expect(parsed.attributes).toHaveLength(2);
      expect(parsed.methods).toHaveLength(2);
    });

    it('intelligently separates raw multiline text into stereotype, name, attrs, and methods', () => {
      const shape = {
        text: '<<control>>\nDrawingContext\n- canvas: Handle\n+ clearScreen()\n+ getHorizontalSize()',
      };
      const parsed = parseUmlClassContent(shape);
      expect(parsed.stereotype).toBe('<<control>>');
      expect(parsed.name).toBe('DrawingContext');
      expect(parsed.attributes).toContain('- canvas: Handle');
      expect(parsed.methods).toContain('+ clearScreen()');
      expect(parsed.methods).toContain('+ getHorizontalSize()');
    });

    it('handles Circle_ from ArgoUML with float attributes and area methods', () => {
      const shape = {
        name: 'Circle_',
        attributes: ['-radius : float', '-center : unsigned int', '-center : unsigned int', 'Ioat'],
        methods: ['+area(in radius : float) : double', '+circum()', '+setRadius()'],
      };
      const parsed = parseUmlClassContent(shape);
      expect(parsed.name).toBe('Circle_');
      expect(parsed.attributes).toHaveLength(4);
      expect(parsed.methods).toHaveLength(3);
    });
  });
});
