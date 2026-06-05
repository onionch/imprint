import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Form, Input, Select, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { useTemplateStore } from '@/features/template';
import type { CreateMeetingRequest } from '@/shared/types/meeting';
import { useMeetingStore } from './meetingStore';

interface CreateMeetingFormValues {
  title: string;
  date: Dayjs;
  location?: string;
  badge_template_id?: number;
}

export default function CreateMeetingPage({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { createMeeting, selectMeeting } = useMeetingStore();
  const { templates, loadTemplates } = useTemplateStore();
  const [form] = Form.useForm<CreateMeetingFormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        value: template.id,
        label: template.name,
        paperSize: template.paper_size,
      })),
    [templates]
  );

  const handleSubmit = async (values: CreateMeetingFormValues) => {
    const selectedTemplate = templateOptions.find(
      (template) => template.value === values.badge_template_id
    );
    const start = values.date.startOf('day');
    const end = values.date.endOf('day');

    const request: CreateMeetingRequest = {
      title: values.title.trim(),
      location: values.location?.trim() || undefined,
      badge_template_id: values.badge_template_id,
      start_time: start.format('YYYY-MM-DD HH:mm:ss'),
      end_time: end.format('YYYY-MM-DD HH:mm:ss'),
      paper_size: selectedTemplate?.paperSize || 'CR80',
      auto_print: false,
    };

    setSaving(true);
    try {
      const meeting = await createMeeting(request);
      selectMeeting(meeting);
      message.success('活动已创建');
      onCreated();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-meeting-view">
      <section className="create-meeting-card">
        <div className="create-meeting-card__heading">
          <h1 className="create-meeting-card__title">新建活动</h1>
          <p className="create-meeting-card__subtitle">
            Configure a new event environment to begin issuing badges.
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          className="create-meeting-form"
          onFinish={(values) => void handleSubmit(values)}
        >
          <Form.Item
            name="title"
            label={
              <span className="create-meeting-form__label">
                活动名称
                <span className="create-meeting-form__required">*</span>
              </span>
            }
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input
              placeholder="请输入活动名称"
              className="create-meeting-form__control create-meeting-form__control--mono"
            />
          </Form.Item>

          <Form.Item
            name="date"
            label={<span className="create-meeting-form__label">活动日期</span>}
            rules={[{ required: true, message: '请选择活动日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              className="create-meeting-form__control create-meeting-form__control--mono"
            />
          </Form.Item>

          <Form.Item
            name="location"
            label={
              <span className="create-meeting-form__label create-meeting-form__label--split">
                <span>活动地点</span>
                <span className="create-meeting-form__hint">Optional</span>
              </span>
            }
          >
            <Input
              placeholder="e.g. Hall A, Convention Center"
              className="create-meeting-form__control create-meeting-form__control--mono"
            />
          </Form.Item>

          <Form.Item
            name="badge_template_id"
            label={<span className="create-meeting-form__label">胸卡模板</span>}
          >
            <Select
              allowClear
              placeholder="选择模板"
              options={templateOptions}
              className="create-meeting-form__control create-meeting-form__control--mono"
            />
          </Form.Item>

          <div className="create-meeting-form__actions">
            <button
              type="button"
              className="create-meeting-form__action create-meeting-form__action--secondary"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="create-meeting-form__action create-meeting-form__action--primary"
              disabled={saving}
            >
              {saving ? '创建中...' : '立即创建'}
            </button>
          </div>
        </Form>
      </section>

      <div className="create-meeting-hints" aria-hidden="true">
        <span className="create-meeting-hints__item">
          <span className="create-meeting-hints__key">Enter</span>
          <span>Confirm</span>
        </span>
        <span className="create-meeting-hints__item">
          <span className="create-meeting-hints__key">Esc</span>
          <span>Back</span>
        </span>
      </div>
    </div>
  );
}
