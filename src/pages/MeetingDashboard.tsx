import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, DatePicker, Select, message, Empty, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMeetingStore } from '@/stores/meetingStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { CreateMeetingRequest } from '@/types/meeting';

export default function MeetingDashboard() {
  const { meetings, loading, loadMeetings, createMeeting, updateMeeting, deleteMeeting, selectMeeting } = useMeetingStore();
  const { templates, loadTemplates } = useTemplateStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMeetings();
    loadTemplates();
  }, []);

  const handleSubmit = async (values: CreateMeetingRequest & { start_time: dayjs.Dayjs; end_time: dayjs.Dayjs }) => {
    const req: CreateMeetingRequest = {
      ...values,
      start_time: values.start_time.format('YYYY-MM-DD HH:mm:ss'),
      end_time: values.end_time.format('YYYY-MM-DD HH:mm:ss'),
    };
    try {
      if (editingId) {
        await updateMeeting(editingId, req);
        message.success('会议已更新');
      } else {
        const meeting = await createMeeting(req);
        selectMeeting(meeting);
        message.success('会议已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingId(null);
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleEdit = (id: number) => {
    const meeting = meetings.find((m) => m.id === id);
    if (meeting) {
      setEditingId(id);
      form.setFieldsValue({
        ...meeting,
        start_time: dayjs(meeting.start_time),
        end_time: dayjs(meeting.end_time),
      });
      setModalOpen(true);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除会议将同时删除所有参会者和签到记录，确定要删除吗？',
      onOk: async () => {
        try {
          await deleteMeeting(id);
          message.success('会议已删除');
        } catch (e) {
          message.error(String(e));
        }
      },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>会议管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalOpen(true); }}>
          新建会议
        </Button>
      </div>

      <Spin spinning={loading}>
        {meetings.length === 0 ? (
          <Empty description="暂无会议，点击上方按钮创建" style={{ marginTop: 64 }} />
        ) : (
          <Row gutter={[16, 16]}>
            {meetings.map((meeting) => (
              <Col key={meeting.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => selectMeeting(meeting)}
                  actions={[
                    <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); handleEdit(meeting.id); }} />,
                    <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); handleDelete(meeting.id); }} />,
                  ]}
                >
                  <Card.Meta
                    title={meeting.title}
                    description={
                      <div>
                        <div><CalendarOutlined /> {dayjs(meeting.start_time).format('YYYY-MM-DD HH:mm')}</div>
                        {meeting.location && <div><EnvironmentOutlined /> {meeting.location}</div>}
                        <div style={{ marginTop: 8 }}>
                          <span style={{ color: meeting.status === 'active' ? '#52c41a' : '#999' }}>
                            {meeting.status === 'active' ? '进行中' : meeting.status === 'completed' ? '已结束' : '草稿'}
                          </span>
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <Modal
        title={editingId ? '编辑会议' : '新建会议'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingId(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="会议名称" rules={[{ required: true, message: '请输入会议名称' }]}>
            <Input placeholder="例如：2024年度技术峰会" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="会议地点">
            <Input placeholder="例如：北京国际会议中心" />
          </Form.Item>
          <Form.Item name="description" label="会议描述">
            <Input.TextArea rows={3} placeholder="会议简介..." />
          </Form.Item>
          <Form.Item name="checkin_code" label="签到码（可选）">
            <Input placeholder="输入签到码，参会者可通过此码签到" />
          </Form.Item>
          <Form.Item name="badge_template_id" label="胸牌模板">
            <Select placeholder="选择胸牌模板" allowClear options={templates.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
