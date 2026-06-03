import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, Space, Table, Tag, message } from 'antd';
import { ExportOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMeetingStore } from '@/features/meeting';
import { checkinApi } from '@/shared/api';
import type { CheckinRecord } from '@/shared/types/checkin';
import { exportRecords } from '@/shared/utils/exportRecords';

const CHECKIN_METHOD_LABELS: Record<string, string> = {
  search: '搜索',
  code: '签到码',
  manual: '手动',
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

  const handleReprint = async (record: CheckinRecord) => {
    if (!currentMeeting?.badge_template_id) {
      message.warning('请先配置胸牌模板');
      return;
    }

    try {
      await checkinApi.updateRecord(record.id, true, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      message.success('已标记为重新打印');
      await loadRecords();
    } catch (error) {
      message.error(String(error));
    }
  };

  const handleExport = async () => {
    if (filteredRecords.length === 0) {
      message.warning('没有可导出的记录');
      return;
    }

    try {
      await exportRecords({
        records: filteredRecords,
        filename: `${currentMeeting?.title ?? '签到记录'}_签到记录`,
      });
      message.success(`已导出 ${filteredRecords.length} 条记录`);
    } catch (error) {
      message.error('导出失败: ' + String(error));
    }
  };

  const filteredRecords = records.filter((record) => {
    const keyword = search.trim().toLowerCase();

    if (printFilter === 'printed' && !record.badge_printed) {
      return false;
    }

    if (printFilter === 'not_printed' && record.badge_printed) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [record.attendee_name, record.attendee_department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  const columns = [
    { title: '姓名', dataIndex: 'attendee_name', key: 'name', width: 120 },
    { title: '部门', dataIndex: 'attendee_department', key: 'department', width: 150 },
    {
      title: '签到时间',
      dataIndex: 'checkin_time',
      key: 'time',
      width: 180,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '签到方式',
      dataIndex: 'checkin_method',
      key: 'method',
      width: 100,
      render: (value: string) => CHECKIN_METHOD_LABELS[value] || value,
    },
    {
      title: '胸牌',
      dataIndex: 'badge_printed',
      key: 'printed',
      width: 100,
      render: (value: boolean) =>
        value ? <Tag color="green">已打印</Tag> : <Tag color="orange">未打印</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: CheckinRecord) => (
        <Space>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => void handleReprint(record)}
          >
            补打
          </Button>
        </Space>
      ),
    },
  ];

  if (!currentMeeting) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100, color: '#999', fontSize: 18 }}>
        请先选择一个会议
      </div>
    );
  }

  return (
    <Card
      title={`签到记录 - ${currentMeeting.title}`}
      extra={
        <Space>
          <Input
            placeholder="搜索姓名或部门"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            value={printFilter}
            onChange={setPrintFilter}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'printed', label: '已打印' },
              { value: 'not_printed', label: '未打印' },
            ]}
          />
          <Button icon={<ExportOutlined />} onClick={() => void handleExport()}>
            导出
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredRecords}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        size="middle"
      />
    </Card>
  );
}
