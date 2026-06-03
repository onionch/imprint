import React from 'react';
import { Button, Space, Tooltip, Popconfirm } from 'antd';
import {
  FontSizeOutlined,
  QrcodeOutlined,
  BorderOutlined,
  PictureOutlined,
  MinusOutlined,
  SaveOutlined,
  DeleteOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { TemplateElement } from '@/shared/types/template';

interface EditorToolbarProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onAddElement: (element: TemplateElement) => void;
  onDeleteElement: () => void;
  onSave: () => void;
  hasSelection: boolean;
  onPreview?: () => void;
  previewLoading?: boolean;
}

function nextId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  scale,
  onScaleChange,
  onAddElement,
  onDeleteElement,
  onSave,
  hasSelection,
  onPreview,
  previewLoading,
}) => {
  const addText = () => {
    onAddElement({
      id: nextId('text'),
      type: 'text',
      x_mm: 5,
      y_mm: 5,
      width_mm: 44,
      height_mm: 8,
      z_index: 10,
      content: '{{attendee_name}}',
      style: {
        font_size_pt: 18,
        font_family: 'Microsoft YaHei',
        font_weight: 'bold',
        color: '#000000',
        text_align: 'center',
        vertical_align: 'middle',
      },
    });
  };

  const addQrcode = () => {
    onAddElement({
      id: nextId('qr'),
      type: 'qrcode',
      x_mm: 17,
      y_mm: 50,
      width_mm: 20,
      height_mm: 20,
      z_index: 5,
      content: '{{qr_data}}',
      style: {
        foreground_color: '#000000',
        background_color: '#ffffff',
      },
    });
  };

  const addRectangle = () => {
    onAddElement({
      id: nextId('rect'),
      type: 'rectangle',
      x_mm: 0,
      y_mm: 0,
      width_mm: 54,
      height_mm: 86,
      z_index: 0,
      style: {
        fill_color: 'transparent',
        border_radius_mm: 3,
      },
    });
  };

  const addImage = () => {
    onAddElement({
      id: nextId('img'),
      type: 'image',
      x_mm: 5,
      y_mm: 5,
      width_mm: 15,
      height_mm: 15,
      z_index: 1,
      content: '',
      style: {
        opacity: 1,
      },
    });
  };

  const addLine = () => {
    onAddElement({
      id: nextId('line'),
      type: 'line',
      x_mm: 5,
      y_mm: 40,
      width_mm: 44,
      height_mm: 0,
      z_index: 2,
      style: {
        color: '#cccccc',
        stroke_width: 0.5,
      },
    });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <Space>
        <Tooltip title="添加文本"><Button icon={<FontSizeOutlined />} onClick={addText}>文本</Button></Tooltip>
        <Tooltip title="添加二维码"><Button icon={<QrcodeOutlined />} onClick={addQrcode}>二维码</Button></Tooltip>
        <Tooltip title="添加矩形"><Button icon={<BorderOutlined />} onClick={addRectangle}>矩形</Button></Tooltip>
        <Tooltip title="添加图片"><Button icon={<PictureOutlined />} onClick={addImage}>图片</Button></Tooltip>
        <Tooltip title="添加线条"><Button icon={<MinusOutlined />} onClick={addLine}>线条</Button></Tooltip>
        <Popconfirm title="确定删除选中元素？" onConfirm={onDeleteElement} disabled={!hasSelection}>
          <Button icon={<DeleteOutlined />} danger disabled={!hasSelection}>删除</Button>
        </Popconfirm>
      </Space>
      <Space>
        <Button icon={<ZoomOutOutlined />} onClick={() => onScaleChange(Math.max(1, scale - 0.5))} />
        <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <Button icon={<ZoomInOutlined />} onClick={() => onScaleChange(Math.min(4, scale + 0.5))} />
        {onPreview && <Button icon={<EyeOutlined />} onClick={onPreview} loading={previewLoading}>预览</Button>}
        <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>保存</Button>
      </Space>
    </div>
  );
}
