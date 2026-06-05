import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Select,
  Switch,
  Tag,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useMeetingStore } from '@/features/meeting';
import { printApi } from '@/shared/api';
import type { PrinterInfo } from '@/shared/types/printer';

interface PrinterDraft {
  meetingId: number | null;
  printerName?: string;
  autoPrint?: boolean;
}

export default function SystemSettingsPage({ onBack }: { onBack?: () => void }) {
  const { currentMeeting, updateMeeting } = useMeetingStore();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [draft, setDraft] = useState<PrinterDraft>({ meetingId: null });

  const activeMeetingId = currentMeeting?.id ?? null;

  const loadPrinters = useCallback(async () => {
    setLoading(true);
    try {
      const list = await printApi.listPrinters();
      setPrinters(list);
    } catch (error) {
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadPrinters();
    });
  }, [loadPrinters]);

  const defaultPrinter = useMemo(
    () => printers.find((printer) => printer.is_default)?.name ?? '',
    [printers]
  );

  const meetingPrinter = currentMeeting?.printer_name || defaultPrinter;
  const selectedPrinter =
    draft.meetingId === activeMeetingId ? draft.printerName ?? meetingPrinter : meetingPrinter;
  const autoPrint =
    draft.meetingId === activeMeetingId
      ? draft.autoPrint ?? currentMeeting?.auto_print ?? false
      : currentMeeting?.auto_print ?? false;

  const selectedPrinterInfo = printers.find((printer) => printer.name === selectedPrinter);

  const persistSetting = useCallback(
    async (printerName: string, autoPrint: boolean) => {
      if (!currentMeeting) return;
      try {
        await updateMeeting(currentMeeting.id, {
          printer_name: printerName,
          auto_print: autoPrint,
        });
      } catch {
        // error shown by caller
      }
    },
    [currentMeeting, updateMeeting]
  );

  const handlePrinterChange = (printerName: string) => {
    const newAutoPrint = autoPrint;
    setDraft({ meetingId: activeMeetingId, printerName, autoPrint: newAutoPrint });
    void persistSetting(printerName, newAutoPrint);
  };

  const handleAutoPrintChange = (enabled: boolean) => {
    const newPrinter = selectedPrinter;
    setDraft({ meetingId: activeMeetingId, printerName: newPrinter, autoPrint: enabled });
    void persistSetting(newPrinter, enabled);
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      message.warning('请先选择打印机');
      return;
    }

    setTesting(true);
    try {
      await printApi.testPrint(selectedPrinter);
      message.success('测试打印已发送');
    } catch (error) {
      message.error(String(error));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-header__title">系统设置</h1>
          <p className="settings-header__subtitle">配置打印机、系统偏好等全局选项</p>
        </div>
        {onBack && (
          <button className="settings-header__back" onClick={onBack}>
            <ArrowLeftOutlined />
            <span>返回</span>
          </button>
        )}
      </div>

      <div className="settings-grid">
        <div className="settings-main">
          {/* 打印机设置 */}
          <div className="settings-section">
            <div className="settings-section__header">
              <PrinterOutlined className="settings-section__icon" />
              <h2 className="settings-section__title">打印机设置</h2>
            </div>

            <div className="settings-form">
              <div className="settings-form__row">
                <label className="settings-form__label">选择打印机</label>
                <div className="settings-form__control">
                  <Select
                    size="large"
                    value={selectedPrinter || undefined}
                    onChange={handlePrinterChange}
                    placeholder="选择打印机"
                    loading={loading}
                    style={{ width: '100%' }}
                    options={printers.map((printer) => ({
                      value: printer.name,
                      label: `${printer.name}${printer.is_default ? ' (默认)' : ''}`,
                    }))}
                  />
                </div>
              </div>

              <div className="settings-form__row">
                <label className="settings-form__label">纸张尺寸</label>
                <div className="settings-form__control">
                  <Select
                    size="large"
                    defaultValue="62mm x 100mm"
                    style={{ width: '100%' }}
                    options={[
                      { value: '62mm x 100mm', label: '62mm x 100mm' },
                      { value: 'Badge Stock (4x3)', label: 'Badge Stock (4x3)' },
                      { value: '29mm x 90mm', label: '29mm x 90mm' },
                    ]}
                  />
                </div>
              </div>

              <div className="settings-form__row">
                <label className="settings-form__label">打印方向</label>
                <div className="settings-form__control">
                  <div className="settings-orientation">
                    <button className="settings-orientation__btn settings-orientation__btn--active">
                      纵向
                    </button>
                    <button className="settings-orientation__btn">横向</button>
                  </div>
                </div>
              </div>

              {!selectedPrinterInfo ? (
                <Alert
                  type="warning"
                  showIcon
                  message="还没有选中可用打印机"
                  description="请先从列表中选择一台打印机，并使用测试打印确认连通性。"
                />
              ) : (
                <div className="settings-printer-info">
                  <div className="settings-printer-info__item">
                    <span className="settings-printer-info__label">当前设备</span>
                    <span className="settings-printer-info__value">{selectedPrinterInfo?.name || '未选择'}</span>
                  </div>
                  <div className="settings-printer-info__item">
                    <span className="settings-printer-info__label">状态</span>
                    <Tag color="success">{selectedPrinterInfo?.status || '未知'}</Tag>
                  </div>
                  <div className="settings-printer-info__item">
                    <span className="settings-printer-info__label">类型</span>
                    <span className="settings-printer-info__value">
                      {selectedPrinterInfo?.is_network ? '网络打印机' : '本地打印机'}
                    </span>
                  </div>
                </div>
              )}

              <div className="settings-form__actions">
                <Button
                  icon={<SyncOutlined spin={testing} />}
                  onClick={() => void handleTestPrint()}
                  loading={testing}
                  disabled={!selectedPrinter}
                  type="primary"
                  size="large"
                >
                  打印测试页
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => void loadPrinters()}
                  loading={loading}
                  size="large"
                >
                  刷新列表
                </Button>
              </div>
            </div>
          </div>

          {/* 打印策略 */}
          <div className="settings-section">
            <div className="settings-section__header">
              <SyncOutlined className="settings-section__icon" />
              <h2 className="settings-section__title">打印策略</h2>
            </div>
            <div className="settings-form">
              <div className="settings-toggle-row">
                <div className="settings-toggle-row__text">
                  <div className="settings-toggle-row__title">自动打印</div>
                  <div className="settings-toggle-row__desc">
                    签到成功后直接打印胸牌，适合稳定的现场打印环境
                  </div>
                </div>
                <Switch checked={autoPrint} onChange={handleAutoPrintChange} />
              </div>
            </div>
          </div>
        </div>

        <div className="settings-side">
          {/* 系统偏好 */}
          <div className="settings-section">
            <div className="settings-section__header">
              <PrinterOutlined className="settings-section__icon" />
              <h2 className="settings-section__title">系统偏好</h2>
            </div>
            <div className="settings-form">
              <div className="settings-form__row">
                <label className="settings-form__label">系统语言</label>
                <div className="settings-form__control">
                  <Select
                    size="large"
                    defaultValue="zh-CN"
                    style={{ width: '100%' }}
                    options={[
                      { value: 'zh-CN', label: '简体中文 (Simplified Chinese)' },
                      { value: 'en-US', label: 'English (US)' },
                    ]}
                  />
                </div>
              </div>

              <div className="settings-divider" />

              <div className="settings-toggle-row">
                <div className="settings-toggle-row__text">
                  <div className="settings-toggle-row__title">声音反馈</div>
                  <div className="settings-toggle-row__desc">成功或错误时播放提示音</div>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="settings-toggle-row">
                <div className="settings-toggle-row__text">
                  <div className="settings-toggle-row__title">数据同步</div>
                  <div className="settings-toggle-row__desc">允许本地数据自动上传</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          {/* 系统版本 */}
          <div className="settings-version">
            <div>
              <p className="settings-version__label">系统版本</p>
              <p className="settings-version__value">v2.4.0-STABLE</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
