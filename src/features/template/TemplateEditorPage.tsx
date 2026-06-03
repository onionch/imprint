import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, Select, Space, message, Typography, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { EditorCanvas, EditorToolbar, PropertyPanel } from './components';
import { useTemplateStore } from './templateStore';
import { badgeApi } from '@/shared/api';
import type { CreateBadgeTemplateRequest } from '@/shared/types/template';

const { Text } = Typography;

export default function TemplateEditorPage() {
  const {
    templates, currentTemplate, editingSchema, selectedElementId,
    loadTemplates, selectTemplate, createTemplate, deleteTemplate,
    saveSchemaToTemplate, setEditingSchema, setSelectedElementId,
    updateElement, addElement, removeElement,
  } = useTemplateStore();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editorScale, setEditorScale] = useState(2);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const selectedElement = editingSchema?.elements.find((e) => e.id === selectedElementId) || null;

  const handleCreate = async (values: {
    name: string;
    description?: string;
    paper_size?: string;
    width_mm?: number;
    height_mm?: number;
    template_json_text: string;
  }) => {
    try {
      const req: CreateBadgeTemplateRequest = {
        name: values.name,
        description: values.description,
        paper_size: values.paper_size,
        width_mm: values.width_mm,
        height_mm: values.height_mm,
        template_json: values.template_json_text,
      };
      const template = await createTemplate(req);
      message.success('模板已创建');
      setCreateOpen(false);
      form.resetFields();
      // Open the new template in editor
      selectTemplate(template);
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleDuplicate = async (templateId: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    try {
      await createTemplate({
        name: `${template.name} (副本)`,
        description: template.description,
        paper_size: template.paper_size,
        width_mm: template.width_mm,
        height_mm: template.height_mm,
        template_json: template.template_json,
      });
      message.success('模板已复制');
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此模板吗？',
      onOk: async () => {
        try {
          await deleteTemplate(id);
          message.success('模板已删除');
        } catch (e) {
          message.error(String(e));
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      await saveSchemaToTemplate();
      message.success('模板已保存');
    } catch (e) {
      message.error(String(e));
    }
  };

  const handlePreview = async () => {
    if (!editingSchema) return;
    setPreviewLoading(true);
    try {
      const jsonStr = JSON.stringify(editingSchema);
      const html = await badgeApi.renderPreview(jsonStr);
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (e) {
      message.error('预览生成失败: ' + String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleListPreview = async (templateJson: string) => {
    setPreviewLoading(true);
    try {
      const html = await badgeApi.renderPreview(templateJson);
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (e) {
      message.error('预览生成失败: ' + String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUpdateSchema = (updates: Record<string, unknown>) => {
    if (!editingSchema) return;
    setEditingSchema({
      ...editingSchema,
      canvas: { ...editingSchema.canvas, ...updates },
    });
  };

  const handleExitEditor = () => {
    selectTemplate(null);
  };

  // Editor mode
  if (editingSchema && currentTemplate) {
    const editorSchema = {
      ...editingSchema.canvas,
      elements: editingSchema.elements,
    };

    return (
      <div>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button onClick={handleExitEditor}>返回列表</Button>
            <Text strong style={{ fontSize: 16 }}>{currentTemplate.name}</Text>
            {currentTemplate.is_builtin && <Tag color="blue">内置</Tag>}
          </Space>
        </div>

        <EditorToolbar
          scale={editorScale}
          onScaleChange={setEditorScale}
          onAddElement={addElement}
          onDeleteElement={() => {
            if (selectedElementId) {
              removeElement(selectedElementId);
            }
          }}
          onSave={handleSave}
          hasSelection={!!selectedElementId}
          onPreview={handlePreview}
          previewLoading={previewLoading}
        />

        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <EditorCanvas
              schema={editorSchema}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={updateElement}
              scale={editorScale}
            />
          </div>
          <div style={{ width: 240, border: '1px solid #d9d9d9', borderRadius: 4, overflowY: 'auto', maxHeight: 500 }}>
            <PropertyPanel
              schema={editorSchema}
              selectedElement={selectedElement}
              onUpdateElement={updateElement}
              onUpdateSchema={handleUpdateSchema}
            />
          </div>
        </div>

        <Modal title="效果预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} width={600} footer={null} loading={previewLoading}>
          {previewHtml && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <iframe
                srcDoc={previewHtml}
                style={{ width: '100%', height: 500, border: '1px solid #d9d9d9', borderRadius: 4 }}
                sandbox=""
                title="Badge Preview"
              />
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // List mode
  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>胸牌模板</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>
          新建模板
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {templates.map((template) => (
          <Col key={template.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              actions={[
                <EditOutlined key="edit" onClick={() => selectTemplate(template)} />,
                <EyeOutlined key="preview" onClick={() => handleListPreview(template.template_json)} />,
                <CopyOutlined key="duplicate" onClick={() => handleDuplicate(template.id)} />,
                <DeleteOutlined key="delete" onClick={() => handleDelete(template.id)} style={{ color: template.is_builtin ? '#ccc' : undefined }} />,
              ]}
            >
              <Card.Meta
                title={<Space>{template.name}{template.is_builtin && <Tag color="blue">内置</Tag>}</Space>}
                description={
                  <div>
                    <div>{template.description}</div>
                    <div style={{ marginTop: 8, color: '#999' }}>
                      {template.paper_size === 'A4' ? 'A4 排版' : `${template.width_mm}x${template.height_mm}mm`}
                    </div>
                  </div>
                }
              />
              <div style={{
                marginTop: 16, border: '1px dashed #d9d9d9', borderRadius: 8,
                height: template.paper_size === 'A4' ? 120 : 140,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fafafa', color: '#999', fontSize: 12,
              }}>
                {template.paper_size === 'A4' ? 'A4 排版预览' : `${template.width_mm}x${template.height_mm}mm`}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal title="效果预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} width={600} footer={null} loading={previewLoading}>
        {previewHtml && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <iframe
              srcDoc={previewHtml}
              style={{ width: '100%', height: 500, border: '1px solid #d9d9d9', borderRadius: 4 }}
              sandbox=""
              title="Badge Preview"
            />
          </div>
        )}
      </Modal>

      <Modal title="新建模板" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="例如：自定义模板1" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="模板说明" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="paper_size" label="纸张类型" initialValue="CR80">
                <Select options={[{ value: 'CR80', label: 'CR80 (54x86mm)' }, { value: 'A4', label: 'A4' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="width_mm" label="宽度(mm)" initialValue={54}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="height_mm" label="高度(mm)" initialValue={86}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="template_json_text" label="模板 JSON" rules={[{ required: true }]} initialValue='{"version":1,"canvas":{"width_mm":54,"height_mm":86,"background_color":"#FFFFFF","border_radius_mm":3},"elements":[]}'>
            <Input.TextArea rows={10} placeholder="输入模板 JSON 定义" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
