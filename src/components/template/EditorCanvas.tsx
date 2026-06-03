import React, { useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Line as KonvaLine } from 'react-konva';
import QRCode from 'qrcode';
import type { TemplateElement } from '@/types/template';

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

function getStyle(el: TemplateElement, key: string, fallback: unknown = undefined): unknown {
  return el.style?.[key] ?? fallback;
}

function elToPixel(el: TemplateElement, scale: number) {
  return {
    x: (el.x_mm ?? 0) * MM_TO_PX * scale,
    y: (el.y_mm ?? 0) * MM_TO_PX * scale,
    width: (el.width_mm ?? 0) * MM_TO_PX * scale,
    height: (el.height_mm ?? 0) * MM_TO_PX * scale,
  };
}

/** Pre-rendered QR code image component */
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
    const content = element.content || '{{qr_data}}';
    const fg = String(getStyle(element, 'foreground_color', '#000000'));
    const bg = String(getStyle(element, 'background_color', '#ffffff'));

    QRCode.toDataURL(content, {
      width: Math.max(width, 64),
      margin: 1,
      color: { dark: fg, light: bg },
      errorCorrectionLevel: 'M',
    }).then((dataUrl) => {
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => setQrImage(img);
    }).catch(() => {
      // Fallback: leave null, placeholder will show
    });
  }, [element.content, element.style, width]);

  if (qrImage) {
    return (
      <KonvaImage
        image={qrImage}
        x={x}
        y={y}
        width={width}
        height={height}
      />
    );
  }

  // Fallback placeholder
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
  onDragEnd: (e: any) => void;
}> = ({ element, scale, isSelected, onSelect, onDragEnd }) => {
  const px = elToPixel(element, scale);
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
          x={px.x}
          y={px.y}
          text={element.content || '文本'}
          fontSize={fontSizePt * scale}
          fontFamily={fontFamily}
          fill={color}
          fontStyle={fontWeight === 'bold' ? 'bold' : 'normal'}
          width={px.width || undefined}
          height={px.height || undefined}
          align={textAlign}
        />
      );
    }
    case 'qrcode': {
      return (
        <React.Fragment>
          <QrPreview
            element={element}
            scale={scale}
            x={px.x}
            y={px.y}
            width={px.width || 80 * scale}
            height={px.height || 80 * scale}
          />
          {/* Invisible draggable overlay for interaction */}
          <Rect
            {...commonProps}
            id={element.id}
            x={px.x}
            y={px.y}
            width={px.width || 80 * scale}
            height={px.height || 80 * scale}
            stroke={isSelected ? '#1890ff' : undefined}
            strokeWidth={isSelected ? 2 : 0}
            fill="transparent"
          />
        </React.Fragment>
      );
    }
    case 'rectangle': {
      const fillColor = String(getStyle(element, 'fill_color', 'transparent'));
      const borderRadius = Number(getStyle(element, 'border_radius_mm', 0));
      return (
        <Rect
          {...commonProps}
          id={element.id}
          x={px.x}
          y={px.y}
          width={px.width}
          height={px.height}
          fill={fillColor === 'transparent' ? undefined : fillColor}
          cornerRadius={borderRadius * MM_TO_PX * scale}
        />
      );
    }
    case 'image': {
      return (
        <Rect
          {...commonProps}
          id={element.id}
          x={px.x}
          y={px.y}
          width={px.width || 60 * scale}
          height={px.height || 60 * scale}
          fill="#e8e8e8"
          stroke={isSelected ? '#1890ff' : '#ccc'}
          strokeWidth={1}
        />
      );
    }
    case 'line': {
      return (
        <KonvaLine
          {...commonProps}
          id={element.id}
          points={[0, 0, px.width, 0]}
          x={px.x}
          y={px.y}
          stroke={String(getStyle(element, 'color', '#000000'))}
          strokeWidth={Number(getStyle(element, 'stroke_width', 1)) * scale}
        />
      );
    }
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
    (elementId: string, e: any) => {
      const node = e.target;
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
          <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill={schema.background_color || '#ffffff'} />
          {schema.elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              scale={scale}
              isSelected={selectedElementId === el.id}
              onSelect={() => onSelectElement(el.id)}
              onDragEnd={(e) => handleDragEnd(el.id, e)}
            />
          ))}
          {selectedElementId &&
            (() => {
              const sel = schema.elements.find((e) => e.id === selectedElementId);
              if (!sel) return null;
              const px = elToPixel(sel, scale);
              return (
                <Rect
                  x={px.x - 2}
                  y={px.y - 2}
                  width={(px.width || 40 * scale) + 4}
                  height={(px.height || 20 * scale) + 4}
                  stroke="#1890ff"
                  strokeWidth={2}
                  dash={[4, 4]}
                  listening={false}
                />
              );
            })()}
        </Layer>
      </Stage>
    </div>
  );
};
