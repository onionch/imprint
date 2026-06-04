import { App as AntdApp, ConfigProvider } from 'antd';
import AppShell from './layout/AppShell';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0f766e',
          colorInfo: '#0f766e',
          colorSuccess: '#15803d',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          borderRadius: 14,
          fontFamily:
            '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <AntdApp>
        <AppShell />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
