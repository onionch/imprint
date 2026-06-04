import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import { useMeetingStore } from '@/features/meeting';
import { attendeeApi, importApi } from '@/shared/api';
import type {
  Attendee,
  AttendeeImportResult,
  ColumnMapping,
  CreateAttendeeRequest,
  ImportDuplicateStrategy,
  UpdateAttendeeRequest,
} from '@/shared/types/attendee';
import {
  downloadAttendeeImportTemplate,
  exportAttendees,
} from '@/shared/utils/exportAttendees';

const { Title, Text, Paragraph } = Typography;

type AttendeeFormValues = Omit<CreateAttendeeRequest, 'meeting_id'>;

const FIELD_OPTIONS: Array<{
  key: keyof ColumnMapping;
  label: string;
  required?: boolean;
}> = [
  { key: 'name', label: '姓名', required: true },
  { key: 'phone', label: '手机号' },
  { key: 'id_card', label: '身份证号' },
  { key: 'department', label: '部门' },
  { key: 'position', label: '职位' },
  { key: 'email', label: '邮箱' },
  { key: 'checkin_code', label: '签到码' },
];

const DUPLICATE_STRATEGY_OPTIONS: Array<{
  value: ImportDuplicateStrategy;
  label: string;
  description: string;
}> = [
  {
    value: 'keep_all',
    label: '保留全部',
    description: '不做重复校验，Excel 中的每一行都按新记录导入。',
  },
  {
    value: 'skip_duplicates',
    label: '跳过重复',
    description: '遇到重复参会人时跳过，不覆盖现有记录。',
  },
  {
    value: 'overwrite_duplicates',
    label: '覆盖已有',
    description: '遇到重复参会人时，用 Excel 数据更新现有记录。',
  },
];

function normalizeOptional(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function guessMapping(headers: string[]): ColumnMapping {
  const candidates: Record<keyof ColumnMapping, string[]> = {
    name: ['姓名', '名字', 'name', '参会人'],
    phone: ['手机', '手机号', '电话', 'phone', 'mobile'],
    id_card: ['身份证', '身份证号', '证件号', 'idcard', 'id_card'],
    department: ['部门', '单位', '公司', 'department', 'org'],
    position: ['职位', '职务', '岗位', 'title', 'position'],
    email: ['邮箱', '邮件', 'email', 'e-mail'],
    checkin_code: ['签到码', '报码', 'checkin', 'code'],
  };

  const mapping: ColumnMapping = {};
  for (const field of FIELD_OPTIONS) {
    const matched = headers.find((header) => {
      const lower = header.toLowerCase();
      return candidates[field.key].some((candidate) =>
        lower.includes(candidate.toLowerCase())
      );
    });

    if (matched) {
      mapping[field.key] = matched;
    }
  }

  return mapping;
}

export default function AttendeesPage() {
  const { currentMeeting } = useMeetingStore();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<React.Key>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'checked_in' | 'not_checked_in'
  >('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'import' | 'onsite'>(
    'all'
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [importResult, setImportResult] =
    useState<AttendeeImportResult | null>(null);
  const [attendeeForm] = Form.useForm<AttendeeFormValues>();
  const [mappingForm] = Form.useForm<
    ColumnMapping & { duplicate_strategy: ImportDuplicateStrategy }
  >();

  const loadAttendees = useCallback(async (meetingId: number | null) => {
    if (!meetingId) {
      setAttendees([]);
      setSelectedRowKeys([]);
      return;
    }

    setLoading(true);
    try {
      const data = await attendeeApi.list(meetingId, 1000, 0);
      setAttendees(data);
      setSelectedRowKeys((keys) =>
        keys.filter((key) => data.some((attendee) => attendee.id === key))
      );
    } catch (error) {
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAttendees(currentMeeting?.id ?? null);
    });
  }, [currentMeeting?.id, loadAttendees]);

  const refreshAttendees = async () => {
    await loadAttendees(currentMeeting?.id ?? null);
  };

  const resetImportState = () => {
    setSelectedFile('');
    setHeaders([]);
    setImportResult(null);
    mappingForm.resetFields();
    mappingForm.setFieldValue('duplicate_strategy', 'skip_duplicates');
  };

  const filteredAttendees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return attendees.filter((attendee) => {
      if (statusFilter === 'checked_in' && !attendee.checked_in) {
        return false;
      }

      if (statusFilter === 'not_checked_in' && attendee.checked_in) {
        return false;
      }

      if (sourceFilter !== 'all' && attendee.source !== sourceFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        attendee.name,
        attendee.phone,
        attendee.id_card,
        attendee.department,
        attendee.position,
        attendee.email,
        attendee.checkin_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [attendees, search, sourceFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = attendees.length;
    const checkedIn = attendees.filter((item) => item.checked_in).length;
    const imported = attendees.filter((item) => item.source === 'import').length;
    const onsite = attendees.filter((item) => item.source === 'onsite').length;
    return { total, checkedIn, imported, onsite };
  }, [attendees]);

  const selectedAttendees = useMemo(
    () => attendees.filter((attendee) => selectedRowKeys.includes(attendee.id)),
    [attendees, selectedRowKeys]
  );

  const openCreateModal = () => {
    setEditingAttendee(null);
    attendeeForm.resetFields();
    setEditorOpen(true);
  };

  const openEditModal = (attendee: Attendee) => {
    setEditingAttendee(attendee);
    attendeeForm.setFieldsValue({
      name: attendee.name,
      id_card: attendee.id_card,
      phone: attendee.phone,
      department: attendee.department,
      position: attendee.position,
      email: attendee.email,
      checkin_code: attendee.checkin_code,
      notes: attendee.notes,
    });
    setEditorOpen(true);
  };

  const handleSaveAttendee = async (values: AttendeeFormValues) => {
    if (!currentMeeting) {
      return;
    }

    const payload = {
      name: values.name.trim(),
      id_card: normalizeOptional(values.id_card),
      phone: normalizeOptional(values.phone),
      department: normalizeOptional(values.department),
      position: normalizeOptional(values.position),
      email: normalizeOptional(values.email),
      checkin_code: normalizeOptional(values.checkin_code),
      notes: normalizeOptional(values.notes),
    };

    setSaving(true);
    try {
      if (editingAttendee) {
        await attendeeApi.update(editingAttendee.id, payload as UpdateAttendeeRequest);
        message.success(`已更新参会人：${payload.name}`);
      } else {
        await attendeeApi.addOnsite({
          meeting_id: currentMeeting.id,
          ...(payload as Omit<CreateAttendeeRequest, 'meeting_id'>),
        });
        message.success(`已新增参会人：${payload.name}`);
      }

      setEditorOpen(false);
      attendeeForm.resetFields();
      await refreshAttendees();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttendee = (attendee: Attendee) => {
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
          message.success(`已删除参会人：${attendee.name}`);
          await refreshAttendees();
        } catch (error) {
          message.error(String(error));
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedAttendees.length === 0) {
      message.warning('请先选择要删除的参会人');
      return;
    }

    const checkedInCount = selectedAttendees.filter(
      (attendee) => attendee.checked_in
    ).length;

    Modal.confirm({
      title: `批量删除 ${selectedAttendees.length} 位参会人？`,
      content:
        checkedInCount > 0
          ? `其中有 ${checkedInCount} 位已经签到，删除后会影响相关签到记录，请确认是否继续。`
          : '删除后不可恢复，请确认是否继续。',
      okText: '批量删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(
            selectedAttendees.map((attendee) => attendeeApi.delete(attendee.id))
          );
          message.success(`已删除 ${selectedAttendees.length} 位参会人`);
          setSelectedRowKeys([]);
          await refreshAttendees();
        } catch (error) {
          message.error(String(error));
        }
      },
    });
  };

  const handleExport = async (onlySelected: boolean) => {
    const target = onlySelected ? selectedAttendees : filteredAttendees;
    if (target.length === 0) {
      message.warning(
        onlySelected
          ? '请先选择要导出的参会人'
          : '当前没有可导出的参会人'
      );
      return;
    }

    setExporting(true);
    try {
      await exportAttendees({
        attendees: target,
        filename: `${currentMeeting?.title || '参会人'}_${
          onlySelected ? '已选' : '全部'
        }名单`,
      });
      message.success(`已导出 ${target.length} 位参会人`);
    } catch (error) {
      message.error('导出失败：' + String(error));
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadAttendeeImportTemplate();
      message.success('导入模板已生成');
    } catch (error) {
      message.error('模板下载失败：' + String(error));
    }
  };

  const handleChooseFile = async () => {
    try {
      const selected = await open({
        title: '选择参会人 Excel 文件',
        multiple: false,
        filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      setSelectedFile(selected);
      setImportResult(null);

      const nextHeaders = await importApi.readHeaders(selected);
      setHeaders(nextHeaders);
      mappingForm.setFieldsValue({
        ...guessMapping(nextHeaders),
        duplicate_strategy:
          mappingForm.getFieldValue('duplicate_strategy') || 'skip_duplicates',
      });
      message.success('已读取 Excel 表头，请确认字段映射');
    } catch (error) {
      message.error('读取 Excel 失败：' + String(error));
    }
  };

  const handleImport = async () => {
    if (!currentMeeting) {
      return;
    }

    if (!selectedFile) {
      message.warning('请先选择 Excel 文件');
      return;
    }

    try {
      const values = await mappingForm.validateFields();
      const { duplicate_strategy, ...mapping } = values;
      setImporting(true);
      const result = await attendeeApi.import(
        currentMeeting.id,
        selectedFile,
        mapping,
        duplicate_strategy || 'skip_duplicates'
      );
      setImportResult(result);
      message.success(
        `导入完成：成功 ${result.success_count} 条，失败 ${result.fail_count} 条，跳过 ${result.skipped_count} 条`
      );
      await refreshAttendees();
    } catch (error) {
      message.error(String(error));
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnsType<Attendee> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          {record.notes ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.notes}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'checked_in',
      key: 'checked_in',
      width: 96,
      render: (value?: boolean) =>
        value ? <Tag color="green">已签到</Tag> : <Tag>未签到</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 108,
      render: (value: string) =>
        value === 'import' ? (
          <Tag color="blue">Excel 导入</Tag>
        ) : (
          <Tag color="gold">现场录入</Tag>
        ),
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '部门', dataIndex: 'department', key: 'department', width: 140 },
    { title: '职位', dataIndex: 'position', key: 'position', width: 140 },
    { title: '签到码', dataIndex: 'checkin_code', key: 'checkin_code', width: 130 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_value, attendee) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(attendee)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAttendee(attendee)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection: TableProps<Attendee>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  if (!currentMeeting) {
    return (
      <Card className="page-card">
        <div style={{ textAlign: 'center', padding: '80px 16px' }}>
          <Title level={4}>请先选择会议</Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            参会人数据会绑定到当前会议，建议先切换会议，再导入名单或做现场补录。
          </Paragraph>
        </div>
      </Card>
    );
  }

  return (
    <div className="page-frame">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic
              title="参会人总数"
              value={summary.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic
              title="已签到"
              value={summary.checkedIn}
              valueStyle={{ color: '#15803d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic
              title="Excel 导入"
              value={summary.imported}
              valueStyle={{ color: '#2563eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic
              title="现场录入"
              value={summary.onsite}
              valueStyle={{ color: '#d97706' }}
            />
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
              参会人管理
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              当前会议：{currentMeeting.title}。优先导入标准名单，再根据现场情况补录和修订。
            </Paragraph>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAttendees()}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => void handleDownloadTemplate()}>
              下载导入模板
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Excel 导入
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增参会人
            </Button>
          </Space>
        </Space>
      </Card>

      <Card className="page-card">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <Input
                placeholder="搜索姓名、手机号、身份证号、部门或签到码"
                prefix={<SearchOutlined />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                allowClear
              />
            </Col>
            <Col xs={12} md={5}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'checked_in', label: '已签到' },
                  { value: 'not_checked_in', label: '未签到' },
                ]}
              />
            </Col>
            <Col xs={12} md={5}>
              <Select
                value={sourceFilter}
                onChange={setSourceFilter}
                style={{ width: '100%' }}
                options={[
                  { value: 'all', label: '全部来源' },
                  { value: 'import', label: 'Excel 导入' },
                  { value: 'onsite', label: '现场录入' },
                ]}
              />
            </Col>
            <Col xs={24} md={4}>
              <Text type="secondary">
                当前 {filteredAttendees.length} / {attendees.length}
              </Text>
            </Col>
          </Row>

          <div className="subtle-panel" style={{ padding: 14 }}>
            <Space
              style={{ width: '100%', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
              align="center"
            >
              <Space wrap>
                <Text strong>批量操作</Text>
                <Text type="secondary">已选 {selectedAttendees.length} 位参会人</Text>
              </Space>
              <Space wrap>
                <Button
                  icon={<FileExcelOutlined />}
                  loading={exporting}
                  onClick={() => void handleExport(false)}
                >
                  导出当前结果
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  disabled={selectedAttendees.length === 0}
                  loading={exporting}
                  onClick={() => void handleExport(true)}
                >
                  导出已选
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={selectedAttendees.length === 0}
                  onClick={handleBatchDelete}
                >
                  删除已选
                </Button>
              </Space>
            </Space>
          </div>
        </Space>
      </Card>

      {attendees.length === 0 ? (
        <Card className="page-card">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前会议还没有参会人，建议先导入 Excel 名单或手动新增。"
          >
            <Space wrap>
              <Button onClick={() => void handleDownloadTemplate()}>下载模板</Button>
              <Button onClick={() => setImportOpen(true)}>Excel 导入</Button>
              <Button type="primary" onClick={openCreateModal}>
                手动新增
              </Button>
            </Space>
          </Empty>
        </Card>
      ) : (
        <Card className="page-card table-shell">
          <Table
            rowKey="id"
            rowSelection={rowSelection}
            columns={columns}
            dataSource={filteredAttendees}
            loading={loading}
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 位参会人`,
            }}
          />
        </Card>
      )}

      <Modal
        title={editingAttendee ? `编辑参会人：${editingAttendee.name}` : '新增参会人'}
        open={editorOpen}
        onCancel={() => {
          setEditorOpen(false);
          attendeeForm.resetFields();
        }}
        onOk={() => attendeeForm.submit()}
        confirmLoading={saving}
        width={720}
        okText={editingAttendee ? '保存修改' : '新增参会人'}
      >
        <Form form={attendeeForm} layout="vertical" onFinish={handleSaveAttendee}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[
                  { required: true, message: '请输入参会人姓名' },
                  { whitespace: true, message: '姓名不能为空白字符' },
                ]}
              >
                <Input placeholder="例如：张三" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="手机号">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="id_card" label="身份证号">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="checkin_code" label="签到码">
                <Input placeholder="选填，可用于快速签到" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="department" label="部门">
                <Input placeholder="例如：市场部" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="position" label="职位">
                <Input placeholder="例如：产品经理" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="备注">
                <Input.TextArea
                  rows={3}
                  placeholder="可补充特殊接待要求、座位说明等信息"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Excel 导入参会人"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          resetImportState();
        }}
        onOk={() => void handleImport()}
        confirmLoading={importing}
        okText="开始导入"
        width={920}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="导入说明"
            description="系统会读取第一个工作表的表头并尝试自动匹配字段。建议先下载模板，按模板列名准备数据。"
          />

          <div className="subtle-panel" style={{ padding: 20, textAlign: 'center' }}>
            <Space direction="vertical" size={12}>
              <InboxOutlined style={{ fontSize: 28, color: '#2563eb' }} />
              <Text>支持 `.xlsx` / `.xls`，建议第一行作为表头。</Text>
              <Space wrap>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => void handleDownloadTemplate()}
                >
                  下载模板
                </Button>
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  onClick={() => void handleChooseFile()}
                >
                  选择 Excel 文件
                </Button>
              </Space>
            </Space>
          </div>

          {selectedFile ? (
            <Descriptions size="small" bordered column={1}>
              <Descriptions.Item label="已选文件">{selectedFile}</Descriptions.Item>
              <Descriptions.Item label="识别到的表头">
                {headers.join(' / ') || '无'}
              </Descriptions.Item>
            </Descriptions>
          ) : null}

          <Card className="page-card" size="small" title="导入策略">
            <Form
              form={mappingForm}
              layout="vertical"
              initialValues={{ duplicate_strategy: 'skip_duplicates' }}
            >
              <Form.Item name="duplicate_strategy" label="重复项处理">
                <Select
                  options={DUPLICATE_STRATEGY_OPTIONS.map((item) => ({
                    value: item.value,
                    label: `${item.label} - ${item.description}`,
                  }))}
                />
              </Form.Item>

              <Row gutter={16}>
                {FIELD_OPTIONS.map((field) => (
                  <Col key={field.key} xs={24} sm={12} md={8}>
                    <Form.Item
                      name={field.key}
                      label={field.label}
                      rules={
                        field.required
                          ? [{ required: true, message: `请选择 ${field.label} 对应列` }]
                          : undefined
                      }
                    >
                      <Select
                        allowClear={!field.required}
                        placeholder={
                          field.required
                            ? `请选择 ${field.label} 对应列`
                            : '没有对应列可留空'
                        }
                        options={headers.map((header) => ({
                          value: header,
                          label: header,
                        }))}
                        disabled={headers.length === 0}
                        showSearch
                        optionFilterProp="label"
                      />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
          </Card>

          {importResult ? (
            <Card className="page-card" size="small" title="导入结果">
              <Row gutter={[16, 16]}>
                <Col xs={12} md={6}>
                  <Statistic title="批次号" value={importResult.batch_id} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="成功"
                    value={importResult.success_count}
                    valueStyle={{ color: '#15803d' }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="失败"
                    value={importResult.fail_count}
                    valueStyle={{ color: '#dc2626' }}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="跳过"
                    value={importResult.skipped_count}
                    valueStyle={{ color: '#d97706' }}
                  />
                </Col>
              </Row>

              {importResult.errors.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <Table
                    rowKey={(row) => `${row.row}-${row.field}-${row.message}`}
                    size="small"
                    pagination={false}
                    dataSource={importResult.errors}
                    columns={[
                      { title: '行号', dataIndex: 'row', key: 'row', width: 100 },
                      { title: '字段', dataIndex: 'field', key: 'field', width: 140 },
                      { title: '原因', dataIndex: 'message', key: 'message' },
                    ]}
                  />
                </div>
              ) : (
                <Alert
                  style={{ marginTop: 16 }}
                  type="success"
                  showIcon
                  message="没有失败记录"
                />
              )}
            </Card>
          ) : null}
        </Space>
      </Modal>
    </div>
  );
}
