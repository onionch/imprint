import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { EditorCanvas, EditorToolbar, PropertyPanel } from './components';
import { useTemplateStore } from './templateStore';
import { badgeApi } from '@/shared/api';
import type { CreateBadgeTemplateRequest } from '@/shared/types/template';

const { Title, Text, Paragraph } = Typography;

export default function TemplateEditorPage() {
  const {
    templates,
    currentTemplate,
    editingSchema,
    selectedElementId,
    loadTemplates,
    selectTemplate,
    createTemplate,
    deleteTemplate,
    saveSchemaToTemplate,
    setEditingSchema,
    setSelectedElementId,
    updateElement,
    addElement,
    removeElement,
  } = useTemplateStore();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editorScale, setEditorScale] = useState(2);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const selectedElement =
    editingSchema?.elements.find((element) => element.id === selectedElementId) || null;

  const summary = useMemo(() => {
    const total = templates.length;
    const builtins = templates.filter((template) => template.is_builtin).length;
    const custom = total - builtins;
    return { total, builtins, custom };
  }, [templates]);

  const handleCreate = async (values: {
    name: string;
    description?: string;
    paper_size?: string;
    width_mm?: number;
    height_mm?: number;
    template_json_text: string;
  }) => {
    try {
      const request: CreateBadgeTemplateRequest = {
        name: values.name,
        description: values.description,
        paper_size: values.paper_size,
        width_mm: values.width_mm,
        height_mm: values.height_mm,
        template_json: values.template_json_text,
      };
      const template = await createTemplate(request);
      message.success('模板已创建');
      setCreateOpen(false);
      form.resetFields();
      selectTemplate(template);
    } catch (error) {
      message.error(String(error));
    }
  };

  const handleDuplicate = async (templateId: number) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    try {
      await createTemplate({
        name: `${template.name} 副本`,
        description: template.description,
        paper_size: template.paper_size,
        width_mm: template.width_mm,
        height_mm: template.height_mm,
        template_json: template.template_json,
      });
      message.success('模板已复制');
      void loadTemplates();
    } catch (error) {
      message.error(String(error));
    }
  };

  const handleDelete = (templateId: number) => {
    Modal.confirm({
      title: '确认删除模板？',
      content: '删除后不可恢复，请确认是否继续。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTemplate(templateId);
          message.success('模板已删除');
        } catch (error) {
          message.error(String(error));
        }
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSchemaToTemplate();
      message.success('模板已保存');
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!editingSchema) {
      return;
    }

    setPreviewLoading(true);
    try {
      const html = await badgeApi.renderPreview(JSON.stringify(editingSchema));
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (error) {
      message.error('预览生成失败：' + String(error));
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
    } catch (error) {
      message.error('预览生成失败：' + String(error));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUpdateSchema = (updates: Record<string, unknown>) => {
    if (!editingSchema) {
      return;
    }

    setEditingSchema({
      ...editingSchema,
      canvas: { ...editingSchema.canvas, ...updates },
    });
  };

  if (editingSchema && currentTemplate) {
    const editorSchema = {
      ...editingSchema.canvas,
      elements: editingSchema.elements,
    };

    return (
      <div className="page-frame">
        <Card className="page-card">
          <Space
            style={{ width: '100%', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
            align="start"
          >
            <div>
              <Space wrap>
                <Button onClick={() => selectTemplate(null)}>返回列表</Button>
                <Title level={4} style={{ margin: 0 }}>
                  {currentTemplate.name}
                </Title>
                {currentTemplate.is_builtin ? <Tag color="blue">内置模板</Tag> : null}
              </Space>
              <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                画布编辑尽量保持简洁，移动端时属性面板会自动切换到下方。
              </Paragraph>
            </div>
            <Space wrap>
              <Tag>{currentTemplate.paper_size === 'A4' ? 'A4' : `${currentTemplate.width_mm} × ${currentTemplate.height_mm} mm`}</Tag>
              <Tag>{editingSchema.elements.length} 个元素</Tag>
            </Space>
          </Space>
        </Card>

        <Card className="page-card">
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
            previewLoading={previewLoading || saving}
          />
        </Card>

        <div className="template-workbench">
          <Card className="page-card template-workbench__canvas">
            <EditorCanvas
              schema={editorSchema}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={updateElement}
              scale={editorScale}
            />
          </Card>

          <Card className="page-card template-workbench__panel">
            <PropertyPanel
              schema={editorSchema}
              selectedElement={selectedElement}
              onUpdateElement={updateElement}
              onUpdateSchema={handleUpdateSchema}
            />
          </Card>
        </div>

        <Modal
          title="预览效果"
          open={previewOpen}
          onCancel={() => setPreviewOpen(false)}
          width={640}
          footer={null}
          loading={previewLoading}
        >
          {previewHtml ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <iframe
                srcDoc={previewHtml}
                style={{
                  width: '100%',
                  height: 520,
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  background: '#ffffff',
                }}
                sandbox=""
                title="Badge Preview"
              />
            </div>
          ) : null}
        </Modal>
      </div>
    );
  }

  return (
    <div className="page-frame">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="page-card metric-card">
            <Statistic title="模板总数" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="page-card metric-card">
            <Statistic title="内置模板" value={summary.builtins} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="page-card metric-card">
            <Statistic title="自定义模板" value={summary.custom} />
          </Card>
        </Col>
      </Row>

      <Card className="page-card">
        <Space
          style={{ width: '100%', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
          align="start"
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              胸牌模板
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              保持模板数量精简，优先沉淀少量稳定模板，避免现场切换时出错。
            </Paragraph>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateOpen(true);
            }}
          >
            新建模板
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {templates.map((template) => (
          <Col key={template.id} xs={24} sm={12} xl={8}>
            <Card
              className="page-card interactive-row"
              hoverable
              actions={[
                <EditOutlined key="edit" onClick={() => selectTemplate(template)} />,
                <EyeOutlined key="preview" onClick={() => void handleListPreview(template.template_json)} />,
                <CopyOutlined key="duplicate" onClick={() => void handleDuplicate(template.id)} />,
                <DeleteOutlined
                  key="delete"
                  onClick={() => handleDelete(template.id)}
                  style={{ color: template.is_builtin ? '#cbd5e1' : undefined }}
                />,
              ]}
            >
              <Card.Meta
                title={
                  <Space wrap>
                    <span>{template.name}</span>
                    {template.is_builtin ? <Tag color="blue">内置</Tag> : null}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Text type="secondary">
                      {template.description || '暂无模板说明'}
                    </Text>
                    <div className="subtle-panel" style={{ padding: 12 }}>
                      <Text type="secondary">
                        {template.paper_size === 'A4'
                          ? 'A4 排版'
                          : `${template.width_mm} × ${template.height_mm} mm`}
                      </Text>
                    </div>
                  </Space>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="预览效果"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={640}
        footer={null}
        loading={previewLoading}
      >
        {previewHtml ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <iframe
              srcDoc={previewHtml}
              style={{
                width: '100%',
                height: 520,
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                background: '#ffffff',
              }}
              sandbox=""
              title="Badge Preview"
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title="新建模板"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        width={760}
        okText="创建模板"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="例如：标准嘉宾胸牌" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input placeholder="简要描述模板用途" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="paper_size" label="纸张类型" initialValue="CR80">
                <Select
                  options={[
                    { value: 'CR80', label: 'CR80 (54 × 86 mm)' },
                    { value: 'A4', label: 'A4' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="width_mm" label="宽度 (mm)" initialValue={54}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="height_mm" label="高度 (mm)" initialValue={86}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="template_json_text"
            label="模板 JSON"
            rules={[{ required: true }]}
            initialValue='{"version":1,"canvas":{"width_mm":54,"height_mm":86,"background_color":"#FFFFFF","border_radius_mm":3},"elements":[]}'
          >
            <Input.TextArea rows={10} placeholder="输入模板 JSON 定义" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
