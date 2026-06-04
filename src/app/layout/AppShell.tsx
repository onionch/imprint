import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Grid, Layout, Menu, Select, Space, Tag, Typography } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  IdcardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  PrinterOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { AttendeesPage } from '@/features/attendee';
import { CheckinPage, RecordsPage } from '@/features/checkin';
import { MeetingDashboard, useMeetingStore } from '@/features/meeting';
import { PrinterSettingsPage } from '@/features/printing';
import { TemplateEditorPage } from '@/features/template';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type PageKey =
  | 'meetings'
  | 'attendees'
  | 'checkin'
  | 'records'
  | 'templates'
  | 'printer';

interface PageMeta {
  title: string;
  subtitle: string;
  content: ReactNode;
}

const PAGE_STORAGE_KEY = 'checkin-tauri/current-page';

const pageRegistry: Record<PageKey, PageMeta> = {
  meetings: {
    title: '\u4f1a\u8bae\u7ba1\u7406',
    subtitle:
      '\u521b\u5efa\u4f1a\u8bae\u3001\u7ef4\u62a4\u65e5\u7a0b\u4e0e\u7b7e\u5230\u914d\u7f6e\u3002',
    content: <MeetingDashboard />,
  },
  attendees: {
    title: '\u53c2\u4f1a\u4eba\u7ba1\u7406',
    subtitle: '\u5bfc\u5165\u540d\u5355\u3001\u73b0\u573a\u8865\u5f55\u4e0e\u6279\u91cf\u7ef4\u62a4\u3002',
    content: <AttendeesPage />,
  },
  checkin: {
    title: '\u7b7e\u5230\u53f0',
    subtitle: '\u9762\u5411\u524d\u53f0\u9ad8\u9891\u64cd\u4f5c\uff0c\u7a81\u51fa\u68c0\u7d22\u4e0e\u786e\u8ba4\u3002',
    content: <CheckinPage />,
  },
  records: {
    title: '\u7b7e\u5230\u8bb0\u5f55',
    subtitle: '\u67e5\u770b\u8fdb\u5ea6\u3001\u8ddf\u8e2a\u8865\u6253\u72b6\u6001\u5e76\u5bfc\u51fa\u8bb0\u5f55\u3002',
    content: <RecordsPage />,
  },
  templates: {
    title: '\u80f8\u724c\u6a21\u677f',
    subtitle: '\u7ef4\u62a4\u80f8\u724c\u6a21\u677f\u4e0e\u9884\u89c8\u6548\u679c\u3002',
    content: <TemplateEditorPage />,
  },
  printer: {
    title: '\u6253\u5370\u8bbe\u7f6e',
    subtitle: '\u9009\u62e9\u6253\u5370\u673a\u5e76\u914d\u7f6e\u81ea\u52a8\u6253\u5370\u7b56\u7565\u3002',
    content: <PrinterSettingsPage />,
  },
};

const menuItems = [
  { key: 'meetings', icon: <CalendarOutlined />, label: '\u4f1a\u8bae' },
  { key: 'attendees', icon: <TeamOutlined />, label: '\u53c2\u4f1a\u4eba' },
  { key: 'checkin', icon: <CheckCircleOutlined />, label: '\u7b7e\u5230' },
  { key: 'records', icon: <UnorderedListOutlined />, label: '\u8bb0\u5f55' },
  { key: 'templates', icon: <IdcardOutlined />, label: '\u6a21\u677f' },
  { key: 'printer', icon: <PrinterOutlined />, label: '\u6253\u5370' },
];

function readStoredPage(): PageKey {
  if (typeof window === 'undefined') {
    return 'meetings';
  }

  const stored = window.localStorage.getItem(PAGE_STORAGE_KEY);
  if (stored && stored in pageRegistry) {
    return stored as PageKey;
  }

  return 'meetings';
}

function getMeetingStatusMeta(status: string) {
  switch (status) {
    case 'active':
      return { label: '\u8fdb\u884c\u4e2d', color: 'green' as const };
    case 'completed':
      return { label: '\u5df2\u7ed3\u675f', color: 'default' as const };
    default:
      return { label: '\u8349\u7a3f', color: 'gold' as const };
  }
}

export default function AppShell() {
  const screens = useBreakpoint();
  const mobile = !screens.lg;
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageKey>(readStoredPage);
  const { meetings, currentMeeting, selectMeeting, loadMeetings } = useMeetingStore();

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    window.localStorage.setItem(PAGE_STORAGE_KEY, currentPage);
  }, [currentPage]);

  const collapsed = mobile ? !mobileMenuOpen : desktopCollapsed;
  const currentMeta = pageRegistry[currentPage];

  const meetingOptions = useMemo(
    () => meetings.map((meeting) => ({ value: meeting.id, label: meeting.title })),
    [meetings]
  );

  const currentMeetingStatus = currentMeeting
    ? getMeetingStatusMeta(currentMeeting.status)
    : null;

  const toggleMenu = () => {
    if (mobile) {
      setMobileMenuOpen((value) => !value);
      return;
    }

    setDesktopCollapsed((value) => !value);
  };

  const handlePageChange = (page: PageKey) => {
    setCurrentPage(page);
    if (mobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <Layout className="app-shell">
      {mobile && mobileMenuOpen ? (
        <div
          className="app-shell__overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}
      <Sider
        className="app-shell__sider"
        width={220}
        collapsedWidth={mobile ? 0 : 76}
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
      >
        <div className="app-shell__brand">
          <Title level={4} className="app-shell__brand-title">
            {collapsed && !mobile ? 'CI' : '\u4f1a\u52a1\u7b7e\u5230'}
          </Title>
          {!collapsed ? (
            <Text className="app-shell__brand-text">
              {'\u8f7b\u91cf\u3001\u6e05\u6670\u3001\u9762\u5411\u73b0\u573a\u6267\u884c'}
            </Text>
          ) : null}
        </div>

        <Menu
          className="app-shell__menu"
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => handlePageChange(key as PageKey)}
        />
      </Sider>

      <Layout className="app-shell__main">
        <Header className="app-shell__header">
          <Space className="app-shell__header-row" align="start">
            <Space size={14} align="start">
              <Button
                type="text"
                size="large"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleMenu}
              />
              <div>
                <Title level={3} className="page-frame__hero-title">
                  {currentMeta.title}
                </Title>
                <Text className="page-frame__hero-text">{currentMeta.subtitle}</Text>
              </div>
            </Space>

            <Space wrap size={10} className="app-shell__actions">
              {currentMeeting && currentMeetingStatus ? (
                <Tag color={currentMeetingStatus.color}>
                  {currentMeeting.title} · {currentMeetingStatus.label}
                </Tag>
              ) : (
                <Tag>{'\u672a\u9009\u62e9\u4f1a\u8bae'}</Tag>
              )}

              <Select
                showSearch
                value={currentMeeting?.id}
                placeholder={'\u5207\u6362\u4f1a\u8bae'}
                className="app-shell__meeting-select"
                onChange={(id) => {
                  const target = meetings.find((meeting) => meeting.id === id);
                  selectMeeting(target || null);
                }}
                options={meetingOptions}
                filterOption={(input, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                allowClear
              />

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handlePageChange('meetings')}
              >
                {'\u65b0\u5efa\u4f1a\u8bae'}
              </Button>
            </Space>
          </Space>
        </Header>

        <Content className="app-shell__content">
          <div className="app-shell__content-inner">
            <div className="page-frame">{currentMeta.content}</div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
