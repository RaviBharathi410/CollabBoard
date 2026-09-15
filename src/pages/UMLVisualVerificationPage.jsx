import React from 'react';
import { Stage } from 'react-konva';
import ShapesLayer from '../canvas/layers/ShapesLayer';
import useCanvasStore from '../canvas/store/canvasStore';

export default function UMLVisualVerificationPage() {
  const setShapes = useCanvasStore((state) => state.addShapes);
  const shapes = useCanvasStore((state) => state.shapes);

  React.useEffect(() => {
    // Populate with authentic UML reference layout
    const referenceUmlShapes = [
      // ── Classes ──
      {
        id: 'class-frame',
        type: 'uml_class',
        pluginType: 'uml-class',
        subtype: 'class',
        x: 400,
        y: 40,
        width: 180,
        height: 100,
        name: 'Frame',
        stereotype: '<<entity>>',
        attributes: ['- title: String', '- isVisible: Boolean'],
        methods: ['+ render()', '+ close()'],
        stroke: '#4F46E5',
      },
      {
        id: 'class-window',
        type: 'uml_class',
        pluginType: 'uml-class',
        subtype: 'class',
        x: 400,
        y: 240,
        width: 180,
        height: 130,
        name: 'Window',
        stereotype: '<<entity>>',
        attributes: ['- radius: float', '- center: unsigned int'],
        methods: ['+ open()', '+ display()', '+ handleEvent()'],
        stroke: '#4F46E5',
      },
      {
        id: 'class-shape',
        type: 'uml_class',
        pluginType: 'uml-class',
        subtype: 'class',
        x: 750,
        y: 240,
        width: 180,
        height: 120,
        name: 'Shape',
        stereotype: '<<interface>>',
        attributes: ['# id: String', '# bounds: Rect'],
        methods: ['+ draw()', '+ erase()', '+ resize()'],
        stroke: '#059669',
      },
      {
        id: 'class-controller',
        type: 'uml_class',
        pluginType: 'uml-class',
        subtype: 'class',
        x: 400,
        y: 470,
        width: 180,
        height: 110,
        name: 'DataController',
        stereotype: '<<control>>',
        attributes: ['- syncState: Int'],
        methods: ['+ fetchData()', '+ commit()'],
        stroke: '#D97706',
      },
      {
        id: 'class-drawing-ctx',
        type: 'uml_class',
        pluginType: 'uml-class',
        subtype: 'class',
        x: 60,
        y: 240,
        width: 190,
        height: 120,
        name: 'DrawingContext',
        stereotype: '<<control>>',
        attributes: ['- canvas: Handle'],
        methods: ['+ clearScreen()', '+ getVerticalSize()'],
        stroke: '#7C3AED',
      },
      {
        id: 'class-event',
        type: 'uml_class',
        pluginType: 'uml-class',
        subtype: 'class',
        x: 60,
        y: 60,
        width: 160,
        height: 90,
        name: 'Event',
        stereotype: '<<entity>>',
        attributes: ['+ timestamp: Long'],
        methods: ['+ dispatch()'],
        stroke: '#2563EB',
      },

      // ── Connectors ──
      // 1. Inheritance: Window (subclass, bottom) -> Frame (superclass, top)
      // Triangle at target (Frame), pointing UP towards Frame
      {
        id: 'edge-inheritance',
        type: 'arrow',
        subtype: 'inheritance',
        pluginType: 'uml-class',
        points: [490, 240, 490, 140],
        stroke: '#4F46E5',
        strokeWidth: 1.5,
      },
      // 2. Composition: Window (whole/composite) -> Shape (part)
      // Solid filled diamond at source (Window), pointing to Shape, with multiplicity
      {
        id: 'edge-composition',
        type: 'arrow',
        subtype: 'composition',
        pluginType: 'uml-class',
        points: [580, 290, 750, 290],
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
        stroke: '#059669',
        strokeWidth: 1.5,
      },
      // 3. Aggregation: Window (whole/aggregate) -> DataController (part)
      // Hollow diamond at source (Window), pointing DOWN to DataController, with multiplicity
      {
        id: 'edge-aggregation',
        type: 'arrow',
        subtype: 'aggregation',
        pluginType: 'uml-class',
        points: [490, 370, 490, 470],
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
        stroke: '#D97706',
        strokeWidth: 1.5,
      },
      // 4. Dependency: Window -> DrawingContext
      // Dashed line with open 'V' arrowhead pointing to DrawingContext
      {
        id: 'edge-dependency',
        type: 'arrow',
        subtype: 'dependency',
        pluginType: 'uml-class',
        label: '<<uses>>',
        points: [400, 300, 250, 300],
        stroke: '#7C3AED',
        strokeWidth: 1.5,
      },
      // 5. Association: Event -> Window
      // Solid line pointing to Window
      {
        id: 'edge-association',
        type: 'arrow',
        subtype: 'association',
        pluginType: 'uml-class',
        directed: true,
        points: [220, 105, 400, 250],
        stroke: '#2563EB',
        strokeWidth: 1.5,
      },
    ];

    useCanvasStore.setState({ shapes: referenceUmlShapes, selectedIds: [] });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#F8F9FB', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#1A1A2E', fontWeight: 700 }}>
            UML Relationship Precision Verification Reference
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
            Visual audit: 3-Compartment Class Cards, Inheritance (hollow triangle), Composition (filled diamond), Aggregation (hollow diamond), Dependency (dashed + open arrow), Multiplicity ('1', '0..*')
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }}>
          <span style={{ padding: '4px 8px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '4px', border: '1px solid #C7D2FE' }}>▲ Inheritance (Target)</span>
          <span style={{ padding: '4px 8px', background: '#ECFDF5', color: '#059669', borderRadius: '4px', border: '1px solid #A7F3D0' }}>◆ Composition (Source)</span>
          <span style={{ padding: '4px 8px', background: '#FFFBEB', color: '#D97706', borderRadius: '4px', border: '1px solid #FDE68A' }}>◇ Aggregation (Source)</span>
          <span style={{ padding: '4px 8px', background: '#F5F3FF', color: '#7C3AED', borderRadius: '4px', border: '1px solid #DDD6FE' }}>⤏ Dependency (Dashed)</span>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <Stage width={1100} height={640}>
          <ShapesLayer selectedIds={[]} onSelect={() => {}} />
        </Stage>
      </div>
    </div>
  );
}
