import { useState, useEffect } from 'react';
import { Layout, Menu, Select, Button, Space, Typography } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  IdcardOutlined,
  PrinterOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useMeetingStore } from '@/stores/meetingStore';
import MeetingDashboard from '@/pages/MeetingDashboard';
import CheckinPage from '@/pages/CheckinPage';
import RecordsPage from '@/pages/RecordsPage';
import TemplateEditorPage from '@/pages/TemplateEditorPage';
import PrinterSettingsPage from '@/pages/PrinterSettingsPage';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: 'meetings', icon: <CalendarOutlined />, label: '会议管理' },
  { key: 'checkin', icon: <CheckCircleOutlined />, label: '签到' },
  { key: 'records', icon: <UnorderedListOutlined />, label: '签到记录' },
  { key: 'templates', icon: <IdcardOutlined />, label: '胸牌模板' },
  { key: 'printer', icon: <PrinterOutlined />, label: '打印设置' },
];

const pageMap: Record<string, React.ReactNode> = {
  meetings: <MeetingDashboard />,
  checkin: <CheckinPage />,
  records: <RecordsPage />,
  templates: <TemplateEditorPage />,
  printer: <PrinterSettingsPage />,
};

export default function AppShell() {
  const [currentPage, setCurrentPage] = useState('meetings');
  const { meetings, currentMeeting, selectMeeting, loadMeetings, createMeeting } = useMeetingStore();

  useEffect(() => {
    loadMeetings();
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={4} style={{ margin: 0, marginRight: 32, color: '#1664FF' }}>
          会务签到
        </Title>
        <Space>
          <Select
            value={currentMeeting?.id}
            placeholder="选择会议"
            style={{ width: 240 }}
            onChange={(id) => {
              const m = meetings.find((m) => m.id === id);
              selectMeeting(m || null);
            }}
            options={meetings.map((m) => ({ value: m.id, label: m.title }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCurrentPage('meetings')}
          >
            新建会议
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f5f6f7', overflow: 'auto' }}>
          {pageMap[currentPage]}
        </Content>
      </Layout>
    </Layout>
  );
}
