import { describe, it, expect } from 'vitest';

/**
 * Calculate relative luminance and WCAG 2.1 contrast ratio
 */
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function srgbToLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('The Drafting Table: Automated WCAG 2.1 Contrast Verification', () => {
  const tokens = {
    surfacePaper: '#F6F5F1',
    surfaceRaised: '#FFFFFF',
    ink: '#26241F',
    inkMuted: '#5C594F',
    inkWhite: '#FFFFFF',
    blue: '#2B5C8F',
    moss: '#2B5C8F',
    ochre: '#9E5826',
    brick: '#B23B3B',
    brickSubtle: '#FDF2F2',
  };

  it('verifies primary ink text achieves WCAG AAA (>= 7:1) on paper surface', () => {
    const ratio = getContrastRatio(tokens.ink, tokens.surfacePaper);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    // Specifically ~13.9:1
    expect(ratio).toBeGreaterThan(13.0);
  });

  it('verifies secondary muted ink text achieves WCAG AA (>= 4.5:1) on paper surface', () => {
    const ratio = getContrastRatio(tokens.inkMuted, tokens.surfacePaper);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Specifically ~6.2:1
    expect(ratio).toBeGreaterThan(5.8);
  });

  it('verifies primary action blue button has >= 4.5:1 contrast with white label text', () => {
    const ratio = getContrastRatio(tokens.inkWhite, tokens.blue);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeGreaterThan(5.0);
  });

  it('verifies primary ink text on pure white raised card achieves WCAG AAA (>= 7:1)', () => {
    const ratio = getContrastRatio(tokens.ink, tokens.surfaceRaised);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeGreaterThan(14.0);
  });

  it('verifies AI ochre accent achieves WCAG AA (>= 4.5:1) for accessible text on paper', () => {
    const ratio = getContrastRatio(tokens.ochre, tokens.surfacePaper);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('verifies brick danger text achieves WCAG AA (>= 4.5:1) against light alert surfaces', () => {
    const ratio = getContrastRatio(tokens.brick, tokens.brickSubtle);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
