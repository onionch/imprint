import { App as AntdApp, ConfigProvider } from 'antd';
import AppShell from './layout/AppShell';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#003fd8',
          colorInfo: '#003fd8',
          colorSuccess: '#15803d',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          borderRadius: 8,
          fontFamily:
            '"MiSans", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
