/** Shared Yjs document reference for AI metadata sync. */

let _ydoc = null;
let _yshapes = null;

export function setYjsDocument(ydoc) {
  _ydoc = ydoc;
  _yshapes = ydoc ? ydoc.getMap('shapes') : null;
}

export function getYjsShapesMap() {
  return _yshapes;
}

export function getYjsDocument() {
  return _ydoc;
}

export function markShapeAiGenerated(shapeId, { aiModel, aiTimestamp = Date.now() }) {
  if (!_yshapes) return;
  _ydoc?.transact(() => {
    const existing = _yshapes.get(shapeId) || {};
    _yshapes.set(shapeId, {
      ...existing,
      aiGenerated: true,
      aiModel,
      aiTimestamp,
    });
  });
}
