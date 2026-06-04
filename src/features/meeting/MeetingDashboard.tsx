import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTemplateStore } from '@/features/template';
import type { CreateMeetingRequest } from '@/shared/types/meeting';
import { useMeetingStore } from './meetingStore';

const { Title, Text, Paragraph } = Typography;

interface MeetingFormValues
  extends Omit<CreateMeetingRequest, 'start_time' | 'end_time'> {
  start_time: Dayjs;
  end_time: Dayjs;
  status?: string;
}

function getStatusMeta(status: string) {
  switch (status) {
    case 'active':
      return { label: '进行中', color: 'green' as const };
    case 'completed':
      return { label: '已结束', color: 'default' as const };
    default:
      return { label: '草稿', color: 'gold' as const };
  }
}

export default function MeetingDashboard() {
  const {
    meetings,
    currentMeeting,
    loading,
    loadMeetings,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    selectMeeting,
  } = useMeetingStore();
  const { templates, loadTemplates } = useTemplateStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<MeetingFormValues>();

  useEffect(() => {
    void loadMeetings();
    void loadTemplates();
  }, [loadMeetings, loadTemplates]);

  const summary = useMemo(() => {
    const total = meetings.length;
    const active = meetings.filter((meeting) => meeting.status === 'active').length;
    const draft = meetings.filter((meeting) => meeting.status === 'draft').length;
    const completed = meetings.filter((meeting) => meeting.status === 'completed').length;
    return { total, active, draft, completed };
  }, [meetings]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      paper_size: 'CR80',
      auto_print: false,
      start_time: dayjs().minute(0).second(0),
      end_time: dayjs().add(2, 'hour').minute(0).second(0),
      status: 'draft',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: MeetingFormValues) => {
    const request: CreateMeetingRequest = {
      ...values,
      start_time: values.start_time.format('YYYY-MM-DD HH:mm:ss'),
      end_time: values.end_time.format('YYYY-MM-DD HH:mm:ss'),
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateMeeting(editingId, request);
        message.success('会议已更新');
      } else {
        const meeting = await createMeeting(request);
        selectMeeting(meeting);
        message.success('会议已创建并切换为当前会议');
      }
      closeModal();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (meetingId: number) => {
    const meeting = meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return;
    }

    setEditingId(meetingId);
    form.setFieldsValue({
      ...meeting,
      start_time: dayjs(meeting.start_time),
      end_time: dayjs(meeting.end_time),
    });
    setModalOpen(true);
  };

  const handleDelete = (meetingId: number) => {
    Modal.confirm({
      title: '确认删除会议？',
      content: '删除后会同时移除该会议下的参会人、签到记录和相关配置，请谨慎操作。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMeeting(meetingId);
          message.success('会议已删除');
        } catch (error) {
          message.error(String(error));
        }
      },
    });
  };

  return (
    <div className="page-frame">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="会议总数" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="进行中" value={summary.active} valueStyle={{ color: '#15803d' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="草稿中" value={summary.draft} valueStyle={{ color: '#d97706' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="已结束" value={summary.completed} />
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
              会议列表
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              建议将当前执行中的会议保持为“进行中”，这样签到台和打印设置会围绕它组织操作。
            </Paragraph>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建会议
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {meetings.length === 0 ? (
          <Card className="page-card">
            <Empty
              description="还没有会议，先创建一个会议开始配置签到流程。"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                创建第一个会议
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {meetings.map((meeting) => {
              const status = getStatusMeta(meeting.status);
              const selected = currentMeeting?.id === meeting.id;

              return (
                <Col key={meeting.id} xs={24} md={12} xl={8}>
                  <Card
                    hoverable
                    className={`page-card interactive-row ${selected ? 'focus-card' : ''}`}
                    onClick={() => selectMeeting(meeting)}
                    actions={[
                      <Button
                        key="edit"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEdit(meeting.id);
                        }}
                      >
                        编辑
                      </Button>,
                      <Button
                        key="delete"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(meeting.id);
                        }}
                      >
                        删除
                      </Button>,
                    ]}
                  >
                    <Space direction="vertical" size={14} style={{ width: '100%' }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                        <Title level={5} style={{ margin: 0 }}>
                          {meeting.title}
                        </Title>
                        <Space wrap>
                          {selected ? <Tag color="processing">当前会议</Tag> : null}
                          <Tag color={status.color}>{status.label}</Tag>
                        </Space>
                      </Space>

                      <Space direction="vertical" size={6}>
                        <Text>
                          <CalendarOutlined /> {dayjs(meeting.start_time).format('YYYY-MM-DD HH:mm')} -{' '}
                          {dayjs(meeting.end_time).format('HH:mm')}
                        </Text>
                        <Text type="secondary">
                          <EnvironmentOutlined /> {meeting.location || '未设置会议地点'}
                        </Text>
                        <Text type="secondary">
                          胸牌模板: {meeting.badge_template_id ? '已配置' : '未配置'}
                        </Text>
                      </Space>

                      <Paragraph
                        type="secondary"
                        style={{ marginBottom: 0, minHeight: 44 }}
                        ellipsis={{ rows: 2 }}
                      >
                        {meeting.description || '暂无会议说明，可在编辑时补充会务信息与签到提示。'}
                      </Paragraph>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>

      <Modal
        title={editingId ? '编辑会议' : '新建会议'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={720}
        okText={editingId ? '保存修改' : '创建会议'}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="会议名称"
                rules={[{ required: true, message: '请输入会议名称' }]}
              >
                <Input placeholder="例如：2026 年渠道伙伴大会" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="start_time"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="end_time"
                label="结束时间"
                rules={[{ required: true, message: '请选择结束时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="location" label="会议地点">
                <Input placeholder="例如：A馆 3F 主会场" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="checkin_code" label="签到码">
                <Input placeholder="可选，用于扫码或快速识别" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="badge_template_id" label="默认胸牌模板">
                <Select
                  allowClear
                  placeholder="选择模板"
                  options={templates.map((template) => ({
                    value: template.id,
                    label: template.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="会议状态">
                <Select
                  options={[
                    { value: 'draft', label: '草稿' },
                    { value: 'active', label: '进行中' },
                    { value: 'completed', label: '已结束' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="description" label="会议说明">
                <Input.TextArea
                  rows={4}
                  placeholder="补充签到提示、现场安排、着装要求等信息，方便团队协作。"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
