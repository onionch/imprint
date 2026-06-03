import React, { useCallback, useEffect, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Image as KonvaImage, Layer, Line as KonvaLine, Rect, Stage, Text } from 'react-konva';
import QRCode from 'qrcode';
import type { TemplateElement } from '@/shared/types/template';

interface EditorCanvasProps {
  schema: {
    width_mm: number;
    height_mm: number;
    background_color: string;
    border_radius_mm: number;
    elements: TemplateElement[];
  };
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<TemplateElement>) => void;
  scale: number;
}

const MM_TO_PX = 3.78;

function getStyle(element: TemplateElement, key: string, fallback: unknown = undefined): unknown {
  return element.style?.[key] ?? fallback;
}

function elementToPixelBox(element: TemplateElement, scale: number) {
  return {
    x: (element.x_mm ?? 0) * MM_TO_PX * scale,
    y: (element.y_mm ?? 0) * MM_TO_PX * scale,
    width: (element.width_mm ?? 0) * MM_TO_PX * scale,
    height: (element.height_mm ?? 0) * MM_TO_PX * scale,
  };
}

const QrPreview: React.FC<{
  element: TemplateElement;
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}> = ({ element, scale, x, y, width, height }) => {
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const content = element.content || '{{qr_data}}';
    const foreground = String(getStyle(element, 'foreground_color', '#000000'));
    const background = String(getStyle(element, 'background_color', '#ffffff'));

    void QRCode.toDataURL(content, {
      width: Math.max(width, 64),
      margin: 1,
      color: { dark: foreground, light: background },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        const image = new window.Image();
        image.src = dataUrl;
        image.onload = () => {
          if (active) {
            setQrImage(image);
          }
        };
      })
      .catch(() => {
        if (active) {
          setQrImage(null);
        }
      });

    return () => {
      active = false;
    };
  }, [element, width]);

  if (qrImage) {
    return <KonvaImage image={qrImage} x={x} y={y} width={width} height={height} />;
  }

  return (
    <Rect
      x={x}
      y={y}
      width={width || 80 * scale}
      height={height || 80 * scale}
      fill="#f5f5f5"
      stroke="#d9d9d9"
      strokeWidth={1}
    />
  );
};

const ElementRenderer: React.FC<{
  element: TemplateElement;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (event: KonvaEventObject<DragEvent>) => void;
}> = ({ element, scale, isSelected, onSelect, onDragEnd }) => {
  const box = elementToPixelBox(element, scale);
  const commonProps = {
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd,
  };

  switch (element.type) {
    case 'text': {
      const fontSizePt = Number(getStyle(element, 'font_size_pt', 14));
      const fontFamily = String(getStyle(element, 'font_family', 'Microsoft YaHei'));
      const color = String(getStyle(element, 'color', '#000000'));
      const fontWeight = String(getStyle(element, 'font_weight', 'normal'));
      const textAlign = String(getStyle(element, 'text_align', 'left'));

      return (
        <Text
          {...commonProps}
          id={element.id}
          x={box.x}
          y={box.y}
          text={element.content || '文本'}
          fontSize={fontSizePt * scale}
          fontFamily={fontFamily}
          fill={color}
          fontStyle={fontWeight === 'bold' ? 'bold' : 'normal'}
          width={box.width || undefined}
          height={box.height || undefined}
          align={textAlign}
        />
      );
    }
    case 'qrcode':
      return (
        <React.Fragment>
          <QrPreview
            element={element}
            scale={scale}
            x={box.x}
            y={box.y}
            width={box.width || 80 * scale}
            height={box.height || 80 * scale}
          />
          <Rect
            {...commonProps}
            id={element.id}
            x={box.x}
            y={box.y}
            width={box.width || 80 * scale}
            height={box.height || 80 * scale}
            stroke={isSelected ? '#1890ff' : undefined}
            strokeWidth={isSelected ? 2 : 0}
            fill="transparent"
          />
        </React.Fragment>
      );
    case 'rectangle': {
      const fillColor = String(getStyle(element, 'fill_color', 'transparent'));
      const borderRadius = Number(getStyle(element, 'border_radius_mm', 0));

      return (
        <Rect
          {...commonProps}
          id={element.id}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill={fillColor === 'transparent' ? undefined : fillColor}
          cornerRadius={borderRadius * MM_TO_PX * scale}
        />
      );
    }
    case 'image':
      return (
        <Rect
          {...commonProps}
          id={element.id}
          x={box.x}
          y={box.y}
          width={box.width || 60 * scale}
          height={box.height || 60 * scale}
          fill="#e8e8e8"
          stroke={isSelected ? '#1890ff' : '#ccc'}
          strokeWidth={1}
        />
      );
    case 'line':
      return (
        <KonvaLine
          {...commonProps}
          id={element.id}
          points={[0, 0, box.width, 0]}
          x={box.x}
          y={box.y}
          stroke={String(getStyle(element, 'color', '#000000'))}
          strokeWidth={Number(getStyle(element, 'stroke_width', 1)) * scale}
        />
      );
    default:
      return null;
  }
};

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  schema,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  scale,
}) => {
  const canvasWidth = schema.width_mm * MM_TO_PX * scale;
  const canvasHeight = schema.height_mm * MM_TO_PX * scale;

  const handleDragEnd = useCallback(
    (elementId: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const newXMm = node.x() / (MM_TO_PX * scale);
      const newYMm = node.y() / (MM_TO_PX * scale);

      onUpdateElement(elementId, {
        x_mm: Math.round(newXMm * 10) / 10,
        y_mm: Math.round(newYMm * 10) / 10,
      });
    },
    [onUpdateElement, scale]
  );

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        display: 'inline-block',
        background: '#fafafa',
        padding: 8,
        borderRadius: 4,
        overflow: 'auto',
      }}
    >
      <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
        {schema.width_mm}mm x {schema.height_mm}mm
      </div>
      <Stage width={canvasWidth} height={canvasHeight} onClick={() => onSelectElement(null)}>
        <Layer>
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill={schema.background_color || '#ffffff'}
          />
          {schema.elements.map((element) => (
            <ElementRenderer
              key={element.id}
              element={element}
              scale={scale}
              isSelected={selectedElementId === element.id}
              onSelect={() => onSelectElement(element.id)}
              onDragEnd={(event) => handleDragEnd(element.id, event)}
            />
          ))}
          {selectedElementId
            ? (() => {
                const selectedElement = schema.elements.find(
                  (element) => element.id === selectedElementId
                );
                if (!selectedElement) {
                  return null;
                }

                const box = elementToPixelBox(selectedElement, scale);
                return (
                  <Rect
                    x={box.x - 2}
                    y={box.y - 2}
                    width={(box.width || 40 * scale) + 4}
                    height={(box.height || 20 * scale) + 4}
                    stroke="#1890ff"
                    strokeWidth={2}
                    dash={[4, 4]}
                    listening={false}
                  />
                );
              })()
            : null}
        </Layer>
      </Stage>
    </div>
  );
};
