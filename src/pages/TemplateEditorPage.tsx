import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, Select, Space, message, Typography, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useTemplateStore } from '@/stores/templateStore';
import type { CreateBadgeTemplateRequest, TemplateElement, TemplateSchema } from '@/types/template';
import { EditorCanvas } from '@/components/template/EditorCanvas';
import { EditorToolbar } from '@/components/template/EditorToolbar';
import { PropertyPanel } from '@/components/template/PropertyPanel';

const { Text } = Typography;

export default function TemplateEditorPage() {
  const {
    templates, currentTemplate, editingSchema, selectedElementId, loading,
    loadTemplates, selectTemplate, createTemplate, deleteTemplate,
    saveSchemaToTemplate, setEditingSchema, setSelectedElementId,
    updateElement, addElement, removeElement,
  } = useTemplateStore();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewJson, setPreviewJson] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editorScale, setEditorScale] = useState(2);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
  }, []);

  const selectedElement = editingSchema?.elements.find((e) => e.id === selectedElementId) || null;

  const handleCreate = async (values: any) => {
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

  const handlePreview = () => {
    if (editingSchema) {
      setPreviewJson(JSON.stringify(editingSchema));
      setPreviewOpen(true);
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
        />

        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <EditorCanvas
              schema={editingSchema.canvas}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={updateElement}
              scale={editorScale}
            />
          </div>
          <div style={{ width: 240, border: '1px solid #d9d9d9', borderRadius: 4, overflowY: 'auto', maxHeight: 500 }}>
            <PropertyPanel
              schema={editingSchema.canvas}
              selectedElement={selectedElement}
              onUpdateElement={updateElement}
              onUpdateSchema={handleUpdateSchema}
            />
          </div>
        </div>

        <Modal title="模板 JSON 预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} width={700} footer={null}>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 500, overflow: 'auto', fontSize: 12 }}>
            {(() => { try { return JSON.stringify(JSON.parse(previewJson), null, 2); } catch { return previewJson; } })()}
          </pre>
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
                <EyeOutlined key="preview" onClick={() => { setPreviewJson(template.template_json); setPreviewOpen(true); }} />,
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

      <Modal title="模板 JSON 预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} width={700} footer={null}>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 500, overflow: 'auto', fontSize: 12 }}>
          {(() => { try { return JSON.stringify(JSON.parse(previewJson), null, 2); } catch { return previewJson; } })()}
        </pre>
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