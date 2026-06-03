import { useEffect, useState } from 'react';
import { Layout, Menu, Select, Button, Space, Typography } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  IdcardOutlined,
  PlusOutlined,
  PrinterOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useMeetingStore } from '@/stores/meetingStore';
import MeetingDashboard from '@/pages/MeetingDashboard';
import AttendeesPage from '@/pages/AttendeesPage';
import CheckinPage from '@/pages/CheckinPage';
import RecordsPage from '@/pages/RecordsPage';
import TemplateEditorPage from '@/pages/TemplateEditorPage';
import PrinterSettingsPage from '@/pages/PrinterSettingsPage';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: 'meetings', icon: <CalendarOutlined />, label: '会议管理' },
  { key: 'attendees', icon: <TeamOutlined />, label: '参会者管理' },
  { key: 'checkin', icon: <CheckCircleOutlined />, label: '签到' },
  { key: 'records', icon: <UnorderedListOutlined />, label: '签到记录' },
  { key: 'templates', icon: <IdcardOutlined />, label: '胸牌模板' },
  { key: 'printer', icon: <PrinterOutlined />, label: '打印设置' },
];

const pageMap: Record<string, React.ReactNode> = {
  meetings: <MeetingDashboard />,
  attendees: <AttendeesPage />,
  checkin: <CheckinPage />,
  records: <RecordsPage />,
  templates: <TemplateEditorPage />,
  printer: <PrinterSettingsPage />,
};

export default function AppShell() {
  const [currentPage, setCurrentPage] = useState('meetings');
  const { meetings, currentMeeting, selectMeeting, loadMeetings } = useMeetingStore();

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          gap: 16,
        }}
      >
        <Space size={20}>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1664FF' }}>
              会务签到
            </Title>
            <Text type="secondary">签到、胸牌打印、参会者管理一体化</Text>
          </div>
        </Space>

        <Space wrap>
          <Select
            value={currentMeeting?.id}
            placeholder="选择当前会议"
            style={{ width: 280 }}
            onChange={(id) => {
              const target = meetings.find((meeting) => meeting.id === id);
              selectMeeting(target || null);
            }}
            options={meetings.map((meeting) => ({ value: meeting.id, label: meeting.title }))}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrentPage('meetings')}>
            新建会议
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key)}
            style={{ height: '100%', borderRight: 0, paddingTop: 12 }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f5f6f7', overflow: 'auto' }}>
          {pageMap[currentPage]}
        </Content>
      </Layout>
    </Layout>
  );
}
