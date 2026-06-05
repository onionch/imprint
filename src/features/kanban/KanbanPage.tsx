import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Switch,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import dayjs from 'dayjs';
import { useMeetingStore } from '@/features/meeting';
import type { Attendee, CreateAttendeeRequest, UpdateAttendeeRequest } from '@/shared/types/attendee';
import type { CheckinRecord, MeetingStats } from '@/shared/types/checkin';
import { attendeeApi, checkinApi, importApi, meetingApi } from '@/shared/api';
import { exportAttendees, downloadAttendeeImportTemplate } from '@/shared/utils/exportAttendees';

interface KanbanAttendee extends Attendee {
  checked_in?: boolean;
}

const FIELD_OPTIONS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'name', label: '姓名', required: true },
  { key: 'phone', label: '手机号' },
  { key: 'id_card', label: '身份证号' },
  { key: 'department', label: '部门' },
  { key: 'position', label: '职位' },
  { key: 'email', label: '邮箱' },
  { key: 'checkin_code', label: '签到码' },
];

function guessMapping(headers: string[]) {
  const candidates: Record<string, string[]> = {
    name: ['姓名', '名字', 'name', '参会人'],
    phone: ['手机', '手机号', '电话', 'phone', 'mobile'],
    id_card: ['身份证', '身份证号', '证件号', 'idcard', 'id_card'],
    department: ['部门', '单位', '公司', 'department', 'org'],
    position: ['职位', '职务', '岗位', 'title', 'position'],
    email: ['邮箱', '邮件', 'email', 'e-mail'],
    checkin_code: ['签到码', '报码', 'checkin', 'code'],
  };

  const mapping: Record<string, string> = {};
  for (const field of FIELD_OPTIONS) {
    const matched = headers.find((header) => {
      const lower = header.toLowerCase();
      return candidates[field.key]?.some((candidate) =>
        lower.includes(candidate.toLowerCase())
      );
    });
    if (matched) {
      mapping[field.key] = matched;
    }
  }
  return mapping;
}

function normalizeOptional(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export default function KanbanPage({ onBack }: { onBack?: () => void }) {
  const { currentMeeting, setCurrentMeeting } = useMeetingStore();
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [attendees, setAttendees] = useState<KanbanAttendee[]>([]);
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordSearch, setRecordSearch] = useState('');

  // Modal states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<KanbanAttendee | null>(null);
  const [saving, setSaving] = useState(false);
  const [attendeeForm] = Form.useForm();

  // Import states
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'keep_all' | 'skip_duplicates' | 'overwrite_duplicates'>('skip_duplicates');

  // Meeting settings states
  const [showMeetingSettings, setShowMeetingSettings] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingForm] = Form.useForm();

  const meetingId = currentMeeting?.id;

  const loadData = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const [statsData, attendeeList, recordList] = await Promise.all([
        checkinApi.getStats(meetingId),
        attendeeApi.list(meetingId, 500, 0),
        checkinApi.listRecords(meetingId, 20, 0),
      ]);
      setStats(statsData);
      setAttendees(attendeeList.map((a) => ({ ...a, checked_in: a.checked_in ?? false })));
      setRecords(recordList);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredAttendees = useMemo(() => {
    if (!searchQuery.trim()) return attendees;
    const q = searchQuery.toLowerCase();
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.department || '').toLowerCase().includes(q) ||
        (a.position || '').toLowerCase().includes(q)
    );
  }, [attendees, searchQuery]);

  const filteredRecords = useMemo(() => {
    if (!recordSearch.trim()) return records.slice(0, 10);
    const q = recordSearch.toLowerCase();
    return records.filter(
      (r) =>
        (r.attendee_name || '').toLowerCase().includes(q) ||
        (r.attendee_department || '').toLowerCase().includes(q)
    );
  }, [records, recordSearch]);

  const totalAttendees = stats?.total_attendees ?? 0;
  const checkedIn = stats?.checked_in ?? 0;
  const checkinRate = totalAttendees > 0 ? Math.round((checkedIn / totalAttendees) * 1000) / 10 : 0;

  // ── Actions ──

  const handleExport = async () => {
    if (attendees.length === 0) {
      message.warning('当前没有可导出的参会人');
      return;
    }
    try {
      await exportAttendees({
        attendees,
        filename: `${currentMeeting?.title || '参会人'}_名单`,
      });
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadAttendeeImportTemplate();
      message.success('导入模板已生成');
    } catch {
      message.error('模板下载失败');
    }
  };

  const handleChooseFile = async () => {
    try {
      const selected = await open({
        title: '选择参会人 Excel 文件',
        multiple: false,
        filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
      });
      if (!selected || Array.isArray(selected)) return;
      setSelectedFile(selected);
      const nextHeaders = await importApi.readHeaders(selected);
      setHeaders(nextHeaders);
      setMapping(guessMapping(nextHeaders));
      message.success('已读取 Excel 表头，请确认字段映射');
    } catch {
      message.error('读取 Excel 失败');
    }
  };

  const handleImport = async () => {
    if (!meetingId || !selectedFile) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    setImporting(true);
    try {
      await attendeeApi.import(meetingId, selectedFile, mapping, duplicateStrategy);
      message.success('导入成功');
      setImportOpen(false);
      setSelectedFile('');
      setHeaders([]);
      setMapping({});
      await loadData();
    } catch {
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const openCreateModal = () => {
    setEditingAttendee(null);
    attendeeForm.resetFields();
    setEditorOpen(true);
  };

  const openEditModal = (attendee: KanbanAttendee) => {
    setEditingAttendee(attendee);
    attendeeForm.setFieldsValue({
      name: attendee.name,
      phone: attendee.phone,
      id_card: attendee.id_card,
      department: attendee.department,
      position: attendee.position,
      email: attendee.email,
      checkin_code: attendee.checkin_code,
    });
    setEditorOpen(true);
  };

  const handleSaveAttendee = async (values: Record<string, unknown>) => {
    if (!meetingId) return;
    setSaving(true);
    try {
      const payload = {
        name: String(values.name).trim(),
        id_card: normalizeOptional(values.id_card as string),
        phone: normalizeOptional(values.phone as string),
        department: normalizeOptional(values.department as string),
        position: normalizeOptional(values.position as string),
        email: normalizeOptional(values.email as string),
        checkin_code: normalizeOptional(values.checkin_code as string),
      };

      if (editingAttendee) {
        await attendeeApi.update(editingAttendee.id, payload as UpdateAttendeeRequest);
        message.success(`已更新：${payload.name}`);
      } else {
        await attendeeApi.addOnsite({
          meeting_id: meetingId,
          ...payload,
        } as CreateAttendeeRequest);
        message.success(`已新增：${payload.name}`);
      }
      setEditorOpen(false);
      attendeeForm.resetFields();
      await loadData();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttendee = (attendee: KanbanAttendee) => {
    Modal.confirm({
      title: `删除 ${attendee.name}？`,
      content: attendee.checked_in
        ? '该参会人已经签到，删除后会影响相关签到记录，请确认是否继续。'
        : '删除后不可恢复，请确认是否继续。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await attendeeApi.delete(attendee.id);
          message.success(`已删除：${attendee.name}`);
          await loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // ── Meeting Settings ──

  const toggleMeetingSettings = () => {
    const next = !showMeetingSettings;
    setShowMeetingSettings(next);
    if (next && currentMeeting) {
      meetingForm.setFieldsValue({
        title: currentMeeting.title,
        description: currentMeeting.description,
        location: currentMeeting.location,
        start_time: currentMeeting.start_time ? dayjs(currentMeeting.start_time) : null,
        end_time: currentMeeting.end_time ? dayjs(currentMeeting.end_time) : null,
        checkin_code: currentMeeting.checkin_code,
        paper_size: currentMeeting.paper_size,
        auto_print: currentMeeting.auto_print,
      });
    }
  };

  const handleSaveMeeting = async (values: Record<string, unknown>) => {
    if (!currentMeeting) return;
    setSavingMeeting(true);
    try {
      const payload = {
        title: String(values.title).trim(),
        description: normalizeOptional(values.description as string),
        location: normalizeOptional(values.location as string),
        start_time: values.start_time ? dayjs(values.start_time as string).toISOString() : undefined,
        end_time: values.end_time ? dayjs(values.end_time as string).toISOString() : undefined,
        checkin_code: normalizeOptional(values.checkin_code as string),
        paper_size: normalizeOptional(values.paper_size as string),
        auto_print: values.auto_print as boolean,
      };

      const updated = await meetingApi.update(currentMeeting.id, payload);
      setCurrentMeeting(updated);
      message.success('活动设置已保存');
      setShowMeetingSettings(false);
      meetingForm.resetFields();
    } catch {
      message.error('保存活动设置失败');
    } finally {
      setSavingMeeting(false);
    }
  };

  const getCategoryLabel = (position?: string) => {
    if (!position) return '参会嘉宾';
    if (position.includes('CEO') || position.includes('总')) return 'VIP';
    if (position.toLowerCase().includes('speaker')) return 'Speaker';
    return '参会嘉宾';
  };

  const getCategoryStyle = (position?: string) => {
    if (!position) return 'kanban-tag--default';
    if (position.includes('CEO') || position.includes('总')) return 'kanban-tag--vip';
    if (position.toLowerCase().includes('speaker')) return 'kanban-tag--speaker';
    return 'kanban-tag--default';
  };

  return (
    <div className="kanban-page">
      <div className="kanban-header">
        <div>
          <h1 className="kanban-header__title">
            {currentMeeting?.title || '活动看板'}
          </h1>
          <div className="kanban-header__meta">
            <span className="kanban-header__meta-item">
              <ClockCircleOutlined />
              <span>
                {currentMeeting
                  ? `${dayjs(currentMeeting.start_time).format('YYYY.MM.DD')} - ${dayjs(currentMeeting.end_time).format('MM.DD')}`
                  : '暂无活动'}
              </span>
            </span>
            {currentMeeting?.location && (
              <span className="kanban-header__meta-item">
                <span>{currentMeeting.location}</span>
              </span>
            )}
          </div>
        </div>
        <div className="kanban-header__actions">
          <button
            className={`kanban-header__btn ${showMeetingSettings ? 'kanban-header__btn--active' : ''}`}
            onClick={toggleMeetingSettings}
            title="活动设置"
          >
            <SettingOutlined />
          </button>
          {onBack && (
            <button className="kanban-header__btn kanban-header__btn--primary" onClick={onBack} title="返回签到">
              <ArrowLeftOutlined />
              <span>返回签到</span>
            </button>
          )}
        </div>
      </div>

      {/* Meeting Settings Panel */}
      {showMeetingSettings && (
        <div className="kanban-meeting-settings">
          <div className="kanban-meeting-settings__header">
            <h3 className="kanban-meeting-settings__title">活动设置</h3>
            <div className="kanban-meeting-settings__actions">
              <Button onClick={() => setShowMeetingSettings(false)}>取消</Button>
              <Button type="primary" onClick={() => meetingForm.submit()} loading={savingMeeting}>
                保存
              </Button>
            </div>
          </div>
          <Form form={meetingForm} layout="vertical" onFinish={handleSaveMeeting}>
            <div className="kanban-meeting-settings__grid">
              <Form.Item
                name="title"
                label="活动名称"
                rules={[{ required: true, message: '请输入活动名称' }]}
              >
                <Input placeholder="例如：2024年度技术大会" />
              </Form.Item>
              <Form.Item name="location" label="活动地点">
                <Input placeholder="例如：北京国际会议中心" />
              </Form.Item>
              <Form.Item name="start_time" label="开始时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择开始时间" />
              </Form.Item>
              <Form.Item name="end_time" label="结束时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择结束时间" />
              </Form.Item>
              <Form.Item name="checkin_code" label="签到码">
                <Input placeholder="选填，用于快速签到验证" />
              </Form.Item>
              <Form.Item name="paper_size" label="纸张尺寸">
                <Select
                  placeholder="选择纸张尺寸"
                  options={[
                    { value: 'A4', label: 'A4' },
                    { value: 'A5', label: 'A5' },
                    { value: 'A6', label: 'A6' },
                    { value: 'Letter', label: 'Letter' },
                  ]}
                />
              </Form.Item>
            </div>
            <div className="kanban-meeting-settings__row">
              <Form.Item
                className="kanban-meeting-settings__description"
                name="description"
                label="活动描述"
              >
                <Input.TextArea placeholder="选填，活动简介" rows={3} />
              </Form.Item>
              <div className="kanban-meeting-settings__switches">
                <Form.Item name="auto_print" label="自动打印" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
              </div>
            </div>
          </Form>
        </div>
      )}

      {!showMeetingSettings && (
        <>
          <div className="kanban-stats">
            <div className="kanban-stat">
              <span className="kanban-stat__label">参会总人数</span>
              <div className="kanban-stat__value">
                <span className="kanban-stat__number">{totalAttendees}</span>
                <span className="kanban-stat__unit">人</span>
              </div>
              <div className="kanban-stat__track">
                <div className="kanban-stat__fill" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="kanban-stat">
              <span className="kanban-stat__label">已签到</span>
              <div className="kanban-stat__value">
                <span className="kanban-stat__number kanban-stat__number--primary">{checkedIn}</span>
                <span className="kanban-stat__unit">人</span>
              </div>
              <div className="kanban-stat__track">
                <div className="kanban-stat__fill kanban-stat__fill--primary" style={{ width: `${Math.min(checkinRate, 100)}%` }} />
              </div>
            </div>
            <div className="kanban-stat">
              <span className="kanban-stat__label">签到率</span>
              <div className="kanban-stat__value">
                <span className="kanban-stat__number">{checkinRate}</span>
                <span className="kanban-stat__unit">%</span>
              </div>
              <div className="kanban-stat__trend">
                <BarChartOutlined />
                <span className="kanban-stat__trend-text">实时统计</span>
              </div>
            </div>
          </div>

          <div className="kanban-body">
        <div className="kanban-panel kanban-panel--wide">
          <div className="kanban-panel__header">
            <h2 className="kanban-panel__title">参会人员</h2>
            <div className="kanban-panel__toolbar">
              <button className="kanban-toolbar__btn" onClick={() => setImportOpen(true)}>
                <UploadOutlined />
                <span>导入</span>
              </button>
              <button className="kanban-toolbar__btn" onClick={() => void handleExport()}>
                <ExportOutlined />
                <span>导出</span>
              </button>
              <button className="kanban-toolbar__btn kanban-toolbar__btn--primary" onClick={openCreateModal}>
                <PlusOutlined />
                <span>新增</span>
              </button>
              <div className="kanban-search">
                <SearchOutlined className="kanban-search__icon" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索姓名/公司..."
                  className="kanban-search__input"
                />
              </div>
            </div>
          </div>

          <div className="kanban-table__wrap">
            {loading ? (
              <div className="kanban-loading">
                <Spin />
              </div>
            ) : (
              <table className="kanban-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>公司</th>
                    <th>类别</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="kanban-table__empty">
                        暂无参会人员
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((attendee) => (
                      <tr key={attendee.id} className="kanban-table__row">
                        <td className="kanban-table__name">{attendee.name}</td>
                        <td className="kanban-table__dept">{attendee.department || '未填写单位'}</td>
                        <td>
                          <span className={`kanban-tag ${getCategoryStyle(attendee.position)}`}>
                            {getCategoryLabel(attendee.position)}
                          </span>
                        </td>
                        <td>
                          {attendee.checked_in ? (
                            <div className="kanban-status kanban-status--checked">
                              <span className="kanban-status__dot" />
                              <span>已签到</span>
                            </div>
                          ) : (
                            <div className="kanban-status kanban-status--pending">
                              <span className="kanban-status__dot" />
                              <span>未签到</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="kanban-table__actions">
                            <button className="kanban-table__action" onClick={() => openEditModal(attendee)}>
                              <EditOutlined />
                            </button>
                            <button className="kanban-table__action kanban-table__action--danger" onClick={() => handleDeleteAttendee(attendee)}>
                              <DeleteOutlined />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="kanban-table__footer">
            <span className="kanban-table__count">
              SHOWING {filteredAttendees.length} OF {totalAttendees} ENTRIES
            </span>
            <div className="kanban-table__pagination">
              <button className="kanban-table__page-btn">PREV</button>
              <button className="kanban-table__page-btn kanban-table__page-btn--active">NEXT</button>
            </div>
          </div>
        </div>

        <div className="kanban-panel kanban-panel--narrow">
          <div className="kanban-panel__header">
            <div className="kanban-panel__header-left">
              <h2 className="kanban-panel__title">最新签到记录</h2>
              <div className="kanban-search kanban-search--small">
                <SearchOutlined className="kanban-search__icon" />
                <Input
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  placeholder="搜索记录..."
                  className="kanban-search__input"
                />
              </div>
            </div>
            <div className="kanban-panel__header-right">
              <button className="kanban-toolbar__btn" onClick={() => void handleExport()}>
                <ExportOutlined />
                <span>导出</span>
              </button>
              <span className="kanban-badge">REAL-TIME</span>
            </div>
          </div>

          <div className="kanban-timeline">
            {filteredRecords.length === 0 ? (
              <div className="kanban-timeline__empty">暂无签到记录</div>
            ) : (
              <div className="kanban-timeline__items">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="kanban-timeline__item">
                    <span className="kanban-timeline__icon">
                      <CheckCircleFilled />
                    </span>
                    <div className="kanban-timeline__content">
                      <div className="kanban-timeline__head">
                        <span className="kanban-timeline__name">{record.attendee_name || '未知嘉宾'}</span>
                        <span className="kanban-timeline__time">
                          {dayjs(record.checkin_time).format('HH:mm:ss')}
                        </span>
                      </div>
                      <p className="kanban-timeline__desc">
                        Success &bull; {record.checkin_method || '手动签到'} &bull;{' '}
                        {record.badge_printed ? 'Badge Printed' : 'No Badge'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="kanban-timeline__more">查看全部历史记录</button>
        </div>
      </div>
        </>
      )}

      {/* Edit / Create Modal */}
      <Modal
        title={editingAttendee ? `编辑参会人：${editingAttendee.name}` : '新增参会人'}
        open={editorOpen}
        onCancel={() => {
          setEditorOpen(false);
          attendeeForm.resetFields();
        }}
        onOk={() => attendeeForm.submit()}
        confirmLoading={saving}
        okText={editingAttendee ? '保存修改' : '新增参会人'}
      >
        <Form form={attendeeForm} layout="vertical" onFinish={handleSaveAttendee}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="例如：张三" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="例如：市场部" />
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input placeholder="例如：产品经理" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="checkin_code" label="签到码">
            <Input placeholder="选填，可用于快速签到" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="Excel 导入参会人"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setSelectedFile('');
          setHeaders([]);
          setMapping({});
        }}
        onOk={() => void handleImport()}
        confirmLoading={importing}
        okText="开始导入"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 20, border: '1px dashed var(--outline-variant)' }}>
            <UploadOutlined style={{ fontSize: 28, color: 'var(--primary-container)' }} />
            <p>支持 .xlsx / .xls，建议第一行作为表头</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={() => void handleDownloadTemplate()}>下载模板</Button>
              <Button type="primary" onClick={() => void handleChooseFile()}>选择 Excel 文件</Button>
            </div>
          </div>

          {selectedFile && (
            <div>
              <p><strong>已选文件：</strong>{selectedFile}</p>
              <p><strong>识别到的表头：</strong>{headers.join(' / ') || '无'}</p>
            </div>
          )}

          {headers.length > 0 && (
            <div>
              <h4>字段映射</h4>
              {FIELD_OPTIONS.map((field) => (
                <div key={field.key} style={{ marginBottom: 8 }}>
                  <label>{field.label}</label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder={`选择 ${field.label} 对应列`}
                    value={mapping[field.key]}
                    onChange={(value) => setMapping((m) => ({ ...m, [field.key]: value }))}
                    options={headers.map((h) => ({ value: h, label: h }))}
                  />
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <label>重复项处理策略</label>
                <Select
                  style={{ width: '100%' }}
                  value={duplicateStrategy}
                  onChange={(value) => setDuplicateStrategy(value)}
                  options={[
                    { value: 'keep_all', label: '保留全部' },
                    { value: 'skip_duplicates', label: '跳过重复' },
                    { value: 'overwrite_duplicates', label: '覆盖已有' },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
