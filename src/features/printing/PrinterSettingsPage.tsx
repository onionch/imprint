import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Divider, Select, Space, Switch, Typography, message } from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMeetingStore } from '@/features/meeting';
import { printApi } from '@/shared/api';
import type { PrinterInfo } from '@/shared/types/printer';

const { Text, Title } = Typography;

interface PrinterDraft {
  meetingId: number | null;
  printerName?: string;
  autoPrint?: boolean;
}

export default function PrinterSettingsPage() {
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

  const handlePrinterChange = (printerName: string) => {
    setDraft((currentDraft) => ({
      meetingId: activeMeetingId,
      printerName,
      autoPrint:
        currentDraft.meetingId === activeMeetingId
          ? currentDraft.autoPrint ?? currentMeeting?.auto_print ?? false
          : currentMeeting?.auto_print ?? false,
    }));
  };

  const handleAutoPrintChange = (enabled: boolean) => {
    setDraft((currentDraft) => ({
      meetingId: activeMeetingId,
      printerName:
        currentDraft.meetingId === activeMeetingId
          ? currentDraft.printerName ?? meetingPrinter
          : meetingPrinter,
      autoPrint: enabled,
    }));
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

  const handleSave = async () => {
    if (!currentMeeting) {
      message.warning('请先选择会议');
      return;
    }

    if (!selectedPrinter) {
      message.warning('请先选择打印机');
      return;
    }

    try {
      await updateMeeting(currentMeeting.id, {
        printer_name: selectedPrinter,
        auto_print: autoPrint,
      });
      setDraft({ meetingId: currentMeeting.id, printerName: selectedPrinter, autoPrint });
      message.success('打印设置已保存');
    } catch (error) {
      message.error(String(error));
    }
  };

  return (
    <Card title="打印设置" style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>选择打印机</Title>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            value={selectedPrinter || undefined}
            onChange={handlePrinterChange}
            placeholder="选择打印机"
            style={{ width: 'calc(100% - 80px)' }}
            loading={loading}
            options={printers.map((printer) => ({
              value: printer.name,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{printer.name}</span>
                  {printer.is_default ? <Text type="secondary">(默认)</Text> : null}
                </div>
              ),
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadPrinters()} loading={loading}>
            刷新
          </Button>
        </Space.Compact>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>打印机状态</Title>
        {selectedPrinterInfo ? (
          <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
            <div>
              <Text strong>名称: </Text>
              {selectedPrinterInfo.name}
            </div>
            <div>
              <Text strong>状态: </Text>
              {selectedPrinterInfo.status || '未知'}
            </div>
            <div>
              <Text strong>类型: </Text>
              {selectedPrinterInfo.is_network ? '网络打印机' : '本地打印机'}
            </div>
          </div>
        ) : (
          <Text type="secondary">当前未选择打印机</Text>
        )}
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>自动打印</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch checked={autoPrint} onChange={handleAutoPrintChange} />
          <Text type="secondary">签到成功后自动打印胸牌</Text>
        </div>
      </div>

      <Divider />

      <Space>
        <Button
          icon={<PrinterOutlined />}
          onClick={() => void handleTestPrint()}
          loading={testing}
          disabled={!selectedPrinter}
        >
          测试打印
        </Button>
        <Button type="primary" onClick={() => void handleSave()} disabled={!currentMeeting}>
          保存设置
        </Button>
      </Space>
    </Card>
  );
}
