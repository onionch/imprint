import { useEffect, useRef, useState } from 'react';
import { Button, Modal, Typography, message } from 'antd';
import { CloudDownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { updateApi, type UpdateInfo } from '@/shared/api';

const { Text, Paragraph, Title } = Typography;

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const LAST_CHECK_KEY = 'checkin-tauri/last-update-check';

interface UpdateCheckerProps {
  /** Render only the manual check button, skip auto-check logic */
  manualOnly?: boolean;
}

export default function UpdateChecker({ manualOnly = false }: UpdateCheckerProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const hasChecked = useRef(false);

  const doCheck = async (silent: boolean) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const info = await updateApi.checkUpdate();
      if (info) {
        setUpdateInfo(info);
        setModalOpen(true);
      } else if (!silent) {
        message.success('当前已是最新版本');
      }
      window.localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    } catch (err) {
      if (!silent) {
        message.warning(`检查更新失败: ${String(err)}`);
      }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await updateApi.installUpdate();
      // app.restart() is called on the Rust side after install — process will terminate
    } catch (err) {
      message.error(`安装更新失败: ${String(err)}`);
      setInstalling(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    if (manualOnly || hasChecked.current) return;
    hasChecked.current = true;

    const lastCheck = Number(window.localStorage.getItem(LAST_CHECK_KEY) || '0');
    const now = Date.now();
    if (now - lastCheck < CHECK_INTERVAL) return;

    void doCheck(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Button
        type="text"
        icon={checking ? <SyncOutlined spin /> : <CloudDownloadOutlined />}
        loading={checking}
        onClick={() => void doCheck(false)}
        title="检查更新"
      />

      <Modal
        open={modalOpen}
        title="发现新版本"
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="later" onClick={() => setModalOpen(false)}>
            稍后提醒
          </Button>,
          <Button
            key="update"
            type="primary"
            loading={installing}
            onClick={() => void handleInstall()}
          >
            立即更新
          </Button>,
        ]}
      >
        {updateInfo && (
          <div>
            <Title level={5}>
              {updateInfo.current_version} → {updateInfo.latest_version}
            </Title>
            {updateInfo.body ? (
              <Paragraph style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {updateInfo.body}
              </Paragraph>
            ) : (
              <Text type="secondary">暂无更新说明</Text>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
