import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Row, Col, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { ExportOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMeetingStore } from '@/features/meeting';
import { checkinApi } from '@/shared/api';
import type { CheckinRecord } from '@/shared/types/checkin';
import { exportRecords } from '@/shared/utils/exportRecords';

const { Title, Paragraph } = Typography;

const CHECKIN_METHOD_LABELS: Record<string, string> = {
  search: '\u641c\u7d22',
  code: '\u7b7e\u5230\u7801',
  manual: '\u624b\u52a8',
};

export default function RecordsPage() {
  const { currentMeeting } = useMeetingStore();
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'not_printed'>('all');

  const loadRecords = useCallback(async () => {
    if (!currentMeeting) {
      setRecords([]);
      return;
    }

    setLoading(true);
    try {
      const data = await checkinApi.listRecords(currentMeeting.id, 500, 0);
      setRecords(data);
    } catch (error) {
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  }, [currentMeeting]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRecords();
    });
  }, [loadRecords]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return records.filter((record) => {
      if (printFilter === 'printed' && !record.badge_printed) {
        return false;
      }

      if (printFilter === 'not_printed' && record.badge_printed) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [record.attendee_name, record.attendee_department, record.attendee_phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [printFilter, records, search]);

  const summary = useMemo(() => {
    const total = records.length;
    const printed = records.filter((record) => record.badge_printed).length;
    const pending = total - printed;
    return { total, printed, pending };
  }, [records]);

  const handleReprint = async (record: CheckinRecord) => {
    if (!currentMeeting?.badge_template_id) {
      message.warning('\u8bf7\u5148\u914d\u7f6e\u80f8\u724c\u6a21\u677f');
      return;
    }

    try {
      await checkinApi.updateRecord(record.id, true, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      message.success('\u5df2\u6807\u8bb0\u4e3a\u91cd\u65b0\u6253\u5370');
      await loadRecords();
    } catch (error) {
      message.error(String(error));
    }
  };

  const handleExport = async () => {
    if (filteredRecords.length === 0) {
      message.warning('\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u8bb0\u5f55');
      return;
    }

    try {
      await exportRecords({
        records: filteredRecords,
        filename: `${currentMeeting?.title ?? '\u7b7e\u5230\u8bb0\u5f55'}_\u7b7e\u5230\u8bb0\u5f55`,
      });
      message.success(`\u5df2\u5bfc\u51fa ${filteredRecords.length} \u6761\u8bb0\u5f55`);
    } catch (error) {
      message.error('\u5bfc\u51fa\u5931\u8d25: ' + String(error));
    }
  };

  const columns = [
    { title: '\u59d3\u540d', dataIndex: 'attendee_name', key: 'name', width: 120 },
    { title: '\u90e8\u95e8', dataIndex: 'attendee_department', key: 'department', width: 150 },
    {
      title: '\u7b7e\u5230\u65f6\u95f4',
      dataIndex: 'checkin_time',
      key: 'time',
      width: 180,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '\u7b7e\u5230\u65b9\u5f0f',
      dataIndex: 'checkin_method',
      key: 'method',
      width: 110,
      render: (value: string) => CHECKIN_METHOD_LABELS[value] || value,
    },
    {
      title: '\u80f8\u724c\u72b6\u6001',
      dataIndex: 'badge_printed',
      key: 'printed',
      width: 110,
      render: (value: boolean) =>
        value ? <Tag color="green">{'\u5df2\u6253\u5370'}</Tag> : <Tag color="orange">{'\u5f85\u6253\u5370'}</Tag>,
    },
    {
      title: '\u64cd\u4f5c',
      key: 'action',
      width: 120,
      render: (_: unknown, record: CheckinRecord) => (
        <Button
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => void handleReprint(record)}
        >
          {'\u8865\u6253'}
        </Button>
      ),
    },
  ];

  if (!currentMeeting) {
    return (
      <Card className="page-card">
        <div style={{ textAlign: 'center', padding: '80px 16px' }}>
          <Title level={4}>{'\u8bf7\u5148\u9009\u62e9\u4f1a\u8bae'}</Title>
          <Paragraph type="secondary">
            {
              '\u8bb0\u5f55\u9875\u9762\u4f1a\u56f4\u7ed5\u5f53\u524d\u4f1a\u8bae\u8fdb\u884c\u7b5b\u9009\u3001\u8865\u6253\u4e0e\u5bfc\u51fa\u3002'
            }
          </Paragraph>
        </div>
      </Card>
    );
  }

  return (
    <div className="page-frame">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="page-card metric-card">
            <Statistic title="\u7b7e\u5230\u8bb0\u5f55\u603b\u6570" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="page-card metric-card">
            <Statistic title="\u5df2\u6253\u5370" value={summary.printed} valueStyle={{ color: '#15803d' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="page-card metric-card">
            <Statistic title="\u5f85\u6253\u5370" value={summary.pending} valueStyle={{ color: '#d97706' }} />
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
              {'\u7b7e\u5230\u8bb0\u5f55'}
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              {
                '\u53ef\u4ee5\u5728\u8fd9\u91cc\u67e5\u770b\u73b0\u573a\u7b7e\u5230\u8fdb\u5ea6\uff0c\u8ffd\u8e2a\u8865\u6253\u72b6\u6001\uff0c\u5e76\u5bfc\u51fa\u73b0\u573a\u8bb0\u5f55\u3002'
              }
            </Paragraph>
          </div>
          <Space wrap>
            <Input
              placeholder={'\u641c\u7d22\u59d3\u540d\u3001\u90e8\u95e8\u6216\u624b\u673a\u53f7'}
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={printFilter}
              onChange={setPrintFilter}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '\u5168\u90e8' },
                { value: 'printed', label: '\u5df2\u6253\u5370' },
                { value: 'not_printed', label: '\u672a\u6253\u5370' },
              ]}
            />
            <Button icon={<ExportOutlined />} onClick={() => void handleExport()}>
              {'\u5bfc\u51fa'}
            </Button>
          </Space>
        </Space>
      </Card>

      <Card className="page-card table-shell">
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `\u5171 ${total} \u6761\u8bb0\u5f55`,
          }}
          size="middle"
        />
      </Card>
    </div>
  );
}
