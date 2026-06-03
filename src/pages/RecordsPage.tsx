import { useState, useEffect } from 'react';
import { Table, Card, Input, Select, Tag, Button, Space, message } from 'antd';
import { SearchOutlined, PrinterOutlined, ExportOutlined } from '@ant-design/icons';
import { useMeetingStore } from '@/stores/meetingStore';
import { checkinApi } from '@/services/api';
import type { CheckinRecord } from '@/types/checkin';
import { exportRecords } from '@/utils/exportRecords';
import dayjs from 'dayjs';

export default function RecordsPage() {
  const { currentMeeting, meetings } = useMeetingStore();
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [printFilter, setPrintFilter] = useState<string>('all');

  const loadRecords = async () => {
    if (!currentMeeting) return;
    setLoading(true);
    try {
      const data = await checkinApi.listRecords(currentMeeting.id, 500, 0);
      setRecords(data);
    } catch (e) {
      message.error(String(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, [currentMeeting]);

  const handleReprint = async (record: CheckinRecord) => {
    if (!currentMeeting?.badge_template_id) {
      message.warning('请先配置胸牌模板');
      return;
    }
    try {
      await checkinApi.updateRecord(record.id, true, dayjs().format('YYYY-MM-DD HH:mm:ss'));
      message.success('胸牌已标记为重新打印');
      loadRecords();
    } catch (e) {
      message.error(String(e));
    }
  };

  const filteredRecords = records.filter((r) => {
    if (printFilter === 'printed' && !r.badge_printed) return false;
    if (printFilter === 'not_printed' && r.badge_printed) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.attendee_name?.toLowerCase().includes(q)) ||
        (r.attendee_department?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const columns = [
    { title: '姓名', dataIndex: 'attendee_name', key: 'name', width: 120 },
    { title: '部门', dataIndex: 'attendee_department', key: 'dept', width: 150 },
    {
      title: '签到时间', dataIndex: 'checkin_time', key: 'time', width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '签到方式', dataIndex: 'checkin_method', key: 'method', width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { search: '搜索', code: '签到码', manual: '手动' };
        return map[v] || v;
      },
    },
    {
      title: '胸牌', dataIndex: 'badge_printed', key: 'printed', width: 100,
      render: (v: boolean) => v ? <Tag color="green">已打印</Tag> : <Tag color="orange">未打印</Tag>,
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: unknown, record: CheckinRecord) => (
        <Space>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handleReprint(record)}>
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
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select value={printFilter} onChange={setPrintFilter} style={{ width: 120 }}>
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="printed">已打印</Select.Option>
            <Select.Option value="not_printed">未打印</Select.Option>
          </Select>
          <Button
            icon={<ExportOutlined />}
            onClick={() => {
              if (filteredRecords.length === 0) {
                message.warning('没有可导出的记录');
                return;
              }
              try {
                exportRecords({ records: filteredRecords, filename: `${currentMeeting.title}_签到记录` });
                message.success(`已导出 ${filteredRecords.length} 条记录`);
              } catch (e) {
                message.error('导出失败: ' + String(e));
              }
            }}
          >
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
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条记录` }}
        size="middle"
      />
    </Card>
  );
}
