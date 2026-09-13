import path from 'path';

/**
 * Format Router: Identifies uploaded diagram format using extension + magic bytes / content sniffing.
 * Never trusts file extension alone.
 * 
 * Supported formats:
 * - 'drawio': mxGraph XML (plain or deflated)
 * - 'mermaid': Mermaid syntax (graph, flowchart, sequence, etc.)
 * - 'svg': Vector SVG with real geometric shapes
 * - 'raster_image': PNG, JPEG, WEBP or raster-wrapped SVG (falls back to vision pipeline)
 * - 'unknown': Unrecognized format
 */

const MAGIC_BYTES = {
  PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  JPEG: [0xFF, 0xD8, 0xFF],
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46], // "RIFF"
  WEBP_MARKER: [0x57, 0x45, 0x42, 0x50], // "WEBP" at offset 8
};

function matchesBytes(buffer, pattern, offset = 0) {
  if (!buffer || buffer.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (buffer[offset + i] !== pattern[i]) return false;
  }
  return true;
}

export function isRasterImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  if (matchesBytes(buffer, MAGIC_BYTES.PNG)) return true;
  if (matchesBytes(buffer, MAGIC_BYTES.JPEG)) return true;
  if (matchesBytes(buffer, MAGIC_BYTES.WEBP_RIFF) && matchesBytes(buffer, MAGIC_BYTES.WEBP_MARKER, 8)) return true;
  return false;
}

/**
 * Checks whether an SVG string contains meaningful vector shapes,
 * or if it is merely a container wrapping a raster <image>.
 */
export function analyzeSvgContent(svgString) {
  if (!svgString || typeof svgString !== 'string') return { isVector: false, hasRasterFallback: true };

  // Check for vector shape tags
  const hasShapes = /<(rect|circle|ellipse|polygon|polyline|path)[\s>]/i.test(svgString);
  const hasText = /<text[\s>]/i.test(svgString);
  const hasImage = /<image[\s>]/i.test(svgString);

  // If it has NO real vector shapes and ONLY an <image> tag, fallback to raster image
  if (!hasShapes && !hasText && hasImage) {
    return { isVector: false, hasRasterFallback: true };
  }

  // If it has shapes or text, it is a vector SVG
  if (hasShapes || hasText) {
    return { isVector: true, hasRasterFallback: false };
  }

  return { isVector: false, hasRasterFallback: false };
}

/**
 * Sniffs the diagram format given a filename/extension and input data (Buffer or string).
 * 
 * @param {string} filename - Optional file name for extension hint
 * @param {Buffer|string} input - File content buffer or string
 * @returns {{
 *   format: 'drawio' | 'mermaid' | 'svg' | 'raster_image' | 'unknown',
 *   mimeType: string,
 *   isStructured: boolean,
 *   text: string | null,
 *   buffer: Buffer | null,
 *   reason: string
 * }}
 */
export function detectDiagramFormat(filename = '', input) {
  const ext = (path.extname(filename || '') || '').toLowerCase().replace(/^\./, '');

  let buffer = null;
  let text = null;

  if (Buffer.isBuffer(input)) {
    buffer = input;
    // Attempt text decode for text sniffing
    try {
      text = buffer.toString('utf8');
    } catch {
      text = null;
    }
  } else if (typeof input === 'string') {
    text = input;
    buffer = Buffer.from(input, 'utf8');
  } else {
    return {
      format: 'unknown',
      mimeType: 'application/octet-stream',
      isStructured: false,
      text: null,
      buffer: null,
      reason: 'Invalid input payload: expected Buffer or string',
    };
  }

  // 1. Magic bytes check for raster images
  if (buffer && isRasterImageBuffer(buffer)) {
    let mime = 'image/png';
    if (matchesBytes(buffer, MAGIC_BYTES.JPEG)) mime = 'image/jpeg';
    else if (matchesBytes(buffer, MAGIC_BYTES.WEBP_RIFF)) mime = 'image/webp';

    return {
      format: 'raster_image',
      mimeType: mime,
      isStructured: false,
      text: null,
      buffer,
      reason: 'Detected raster image via magic bytes header',
    };
  }

  if (!text) {
    return {
      format: 'unknown',
      mimeType: 'application/octet-stream',
      isStructured: false,
      text: null,
      buffer,
      reason: 'Payload is binary and does not match known raster image magic bytes',
    };
  }

  const trimmedText = text.trim();

  // 2. Draw.io / mxGraph XML Detection
  // Check for common mxGraph signatures: <mxfile, <mxGraphModel, <root>, <diagram, <mxCell
  const isDrawioXml =
    /<(mxfile|mxGraphModel|diagram|mxCell)[\s>]/i.test(trimmedText) ||
    (trimmedText.startsWith('<?xml') && /<(mxfile|mxGraphModel|diagram|mxCell)[\s>]/i.test(trimmedText));

  if (isDrawioXml || ext === 'drawio') {
    return {
      format: 'drawio',
      mimeType: 'application/xml',
      isStructured: true,
      text: trimmedText,
      buffer,
      reason: 'Detected draw.io / mxGraph XML structure',
    };
  }

  // 3. SVG Detection
  const isSvg = /<svg[\s>]/i.test(trimmedText);
  if (isSvg || ext === 'svg') {
    const analysis = analyzeSvgContent(trimmedText);
    if (analysis.hasRasterFallback) {
      return {
        format: 'raster_image',
        mimeType: 'image/svg+xml',
        isStructured: false,
        text: trimmedText,
        buffer,
        reason: 'SVG contains only embedded raster image tags without geometric vector shapes; falling back to image vision pipeline',
      };
    }
    if (analysis.isVector) {
      return {
        format: 'svg',
        mimeType: 'image/svg+xml',
        isStructured: true,
        text: trimmedText,
        buffer,
        reason: 'Detected vector SVG with geometric elements',
      };
    }
  }

  // 4. Mermaid Detection
  // Mermaid starts with or contains graph declarations or node/arrow chains
  const isMermaid =
    /^\s*(graph\s+(TD|TB|BT|RL|LR)|flowchart\s+(TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram)/i.test(
      trimmedText
    ) ||
    (/\b(graph|flowchart)\s+[A-Z]{2}\b/i.test(trimmedText) && /-->|---|-.->|==>/.test(trimmedText)) ||
    ext === 'mmd' ||
    ext === 'mermaid';

  if (isMermaid) {
    return {
      format: 'mermaid',
      mimeType: 'text/vnd.mermaid',
      isStructured: true,
      text: trimmedText,
      buffer,
      reason: 'Detected Mermaid diagram syntax',
    };
  }

  // 5. Fallback for image extensions when magic bytes didn't trigger (e.g. data URI or corrupted header)
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return {
      format: 'raster_image',
      mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
      isStructured: false,
      text: null,
      buffer,
      reason: 'File extension indicates raster image',
    };
  }

  return {
    format: 'unknown',
    mimeType: 'application/octet-stream',
    isStructured: false,
    text: trimmedText,
    buffer,
    reason: 'Could not determine diagram format from extension or content',
  };
}
