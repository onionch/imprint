import React from 'react';
import { Form, Input, InputNumber, Select, Divider } from 'antd';
import type { TemplateElement } from '@/types/template';
import { TEMPLATE_VARIABLES } from '@/types/template';

interface PropertyPanelProps {
  schema: {
    width_mm: number;
    height_mm: number;
    background_color: string;
    border_radius_mm: number;
    elements: TemplateElement[];
  };
  selectedElement: TemplateElement | null;
  onUpdateElement: (id: string, updates: Partial<TemplateElement>) => void;
  onUpdateSchema: (updates: Record<string, unknown>) => void;
}

const ELEMENT_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'qrcode', label: '二维码' },
  { value: 'rectangle', label: '矩形' },
  { value: 'image', label: '图片' },
  { value: 'line', label: '线条' },
];

function getStyle(el: TemplateElement, key: string, fallback: unknown = ''): unknown {
  return el.style?.[key] ?? fallback;
}

function setStyle(el: TemplateElement, key: string, value: unknown): Record<string, unknown> {
  return { ...el.style, [key]: value };
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  schema,
  selectedElement,
  onUpdateElement,
  onUpdateSchema,
}) => {
  if (!selectedElement) {
    return (
      <div style={{ padding: 16 }}>
        <h4 style={{ marginBottom: 12 }}>画布属性</h4>
        <Form layout="vertical" size="small">
          <Form.Item label="宽度 (mm)">
            <InputNumber value={schema.width_mm} min={20} max={300} onChange={(v) => v && onUpdateSchema({ width_mm: v })} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="高度 (mm)">
            <InputNumber value={schema.height_mm} min={20} max={300} onChange={(v) => v && onUpdateSchema({ height_mm: v })} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="背景色">
            <Input value={schema.background_color || '#ffffff'} onChange={(e) => onUpdateSchema({ background_color: e.target.value })} />
          </Form.Item>
          <Form.Item label="圆角 (mm)">
            <InputNumber value={schema.border_radius_mm || 0} min={0} max={20} onChange={(v) => onUpdateSchema({ border_radius_mm: v ?? 0 })} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      <h4 style={{ marginBottom: 12 }}>元素属性</h4>
      <Form layout="vertical" size="small">
        <Form.Item label="类型">
          <Select value={selectedElement.type} options={ELEMENT_TYPES} onChange={(v) => onUpdateElement(selectedElement.id, { type: v })} />
        </Form.Item>

        <Divider style={{ margin: '8px 0' }} />
        <Form.Item label="位置 (mm)">
          <div style={{ display: 'flex', gap: 8 }}>
            <InputNumber placeholder="X" value={selectedElement.x_mm} min={0} onChange={(v) => v !== null && onUpdateElement(selectedElement.id, { x_mm: v })} style={{ width: '50%' }} />
            <InputNumber placeholder="Y" value={selectedElement.y_mm} min={0} onChange={(v) => v !== null && onUpdateElement(selectedElement.id, { y_mm: v })} style={{ width: '50%' }} />
          </div>
        </Form.Item>
        <Form.Item label="尺寸 (mm)">
          <div style={{ display: 'flex', gap: 8 }}>
            <InputNumber placeholder="宽" value={selectedElement.width_mm} min={0} onChange={(v) => v !== null && onUpdateElement(selectedElement.id, { width_mm: v })} style={{ width: '50%' }} />
            <InputNumber placeholder="高" value={selectedElement.height_mm} min={0} onChange={(v) => v !== null && onUpdateElement(selectedElement.id, { height_mm: v })} style={{ width: '50%' }} />
          </div>
        </Form.Item>

        {selectedElement.type === 'text' && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="内容">
              <Input.TextArea value={selectedElement.content || ''} onChange={(e) => onUpdateElement(selectedElement.id, { content: e.target.value })} rows={2} />
            </Form.Item>
            <Form.Item label="变量插入">
              <Select placeholder="选择变量" options={TEMPLATE_VARIABLES} onChange={(v) => { const cur = selectedElement.content || ''; onUpdateElement(selectedElement.id, { content: cur + v }); }} allowClear />
            </Form.Item>
            <Form.Item label="字号 (pt)">
              <InputNumber value={Number(getStyle(selectedElement, 'font_size_pt', 14))} min={6} max={72} onChange={(v) => v && onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'font_size_pt', v) })} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="字体">
              <Select value={String(getStyle(selectedElement, 'font_family', 'Microsoft YaHei'))} options={[{ value: 'Microsoft YaHei', label: '微软雅黑' }, { value: 'SimSun', label: '宋体' }, { value: 'SimHei', label: '黑体' }, { value: 'KaiTi', label: '楷体' }, { value: 'Arial', label: 'Arial' }]} onChange={(v) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'font_family', v) })} />
            </Form.Item>
            <Form.Item label="字重">
              <Select value={String(getStyle(selectedElement, 'font_weight', 'normal'))} options={[{ value: 'normal', label: '常规' }, { value: 'bold', label: '粗体' }]} onChange={(v) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'font_weight', v) })} />
            </Form.Item>
            <Form.Item label="颜色">
              <Input value={String(getStyle(selectedElement, 'color', '#000000'))} onChange={(e) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'color', e.target.value) })} />
            </Form.Item>
            <Form.Item label="对齐">
              <Select value={String(getStyle(selectedElement, 'text_align', 'left'))} options={[{ value: 'left', label: '左对齐' }, { value: 'center', label: '居中' }, { value: 'right', label: '右对齐' }]} onChange={(v) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'text_align', v) })} />
            </Form.Item>
          </>
        )}

        {selectedElement.type === 'qrcode' && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="数据内容">
              <Input value={selectedElement.content || '{{qr_data}}'} onChange={(e) => onUpdateElement(selectedElement.id, { content: e.target.value })} />
            </Form.Item>
            <Form.Item label="前景色">
              <Input value={String(getStyle(selectedElement, 'foreground_color', '#000000'))} onChange={(e) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'foreground_color', e.target.value) })} />
            </Form.Item>
          </>
        )}

        {selectedElement.type === 'rectangle' && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="填充色">
              <Input value={String(getStyle(selectedElement, 'fill_color', 'transparent'))} onChange={(e) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'fill_color', e.target.value) })} placeholder="transparent" />
            </Form.Item>
            <Form.Item label="圆角 (mm)">
              <InputNumber value={Number(getStyle(selectedElement, 'border_radius_mm', 0))} min={0} max={50} onChange={(v) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'border_radius_mm', v ?? 0) })} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {selectedElement.type === 'line' && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="线条颜色">
              <Input value={String(getStyle(selectedElement, 'color', '#000000'))} onChange={(e) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'color', e.target.value) })} />
            </Form.Item>
            <Form.Item label="线条宽度">
              <InputNumber value={Number(getStyle(selectedElement, 'stroke_width', 1))} min={0.5} max={10} step={0.5} onChange={(v) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'stroke_width', v ?? 1) })} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {selectedElement.type === 'image' && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Form.Item label="透明度">
              <InputNumber value={Number(getStyle(selectedElement, 'opacity', 1))} min={0} max={1} step={0.1} onChange={(v) => onUpdateElement(selectedElement.id, { style: setStyle(selectedElement, 'opacity', v ?? 1) })} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}
      </Form>
    </div>
  );
};