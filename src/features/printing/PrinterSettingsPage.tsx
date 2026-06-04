import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMeetingStore } from '@/features/meeting';
import { printApi } from '@/shared/api';
import type { PrinterInfo } from '@/shared/types/printer';

const { Title, Text, Paragraph } = Typography;

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
  const [saving, setSaving] = useState(false);
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
      message.warning('\u8bf7\u5148\u9009\u62e9\u6253\u5370\u673a');
      return;
    }

    setTesting(true);
    try {
      await printApi.testPrint(selectedPrinter);
      message.success('\u6d4b\u8bd5\u6253\u5370\u5df2\u53d1\u9001');
    } catch (error) {
      message.error(String(error));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!currentMeeting) {
      message.warning('\u8bf7\u5148\u9009\u62e9\u4f1a\u8bae');
      return;
    }

    if (!selectedPrinter) {
      message.warning('\u8bf7\u5148\u9009\u62e9\u6253\u5370\u673a');
      return;
    }

    setSaving(true);
    try {
      await updateMeeting(currentMeeting.id, {
        printer_name: selectedPrinter,
        auto_print: autoPrint,
      });
      setDraft({
        meetingId: currentMeeting.id,
        printerName: selectedPrinter,
        autoPrint,
      });
      message.success('\u6253\u5370\u8bbe\u7f6e\u5df2\u4fdd\u5b58');
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  if (!currentMeeting) {
    return (
      <Card className="page-card">
        <div style={{ textAlign: 'center', padding: '80px 16px' }}>
          <Title level={4}>{'\u8bf7\u5148\u9009\u62e9\u4f1a\u8bae'}</Title>
          <Paragraph type="secondary">
            {
              '\u6253\u5370\u8bbe\u7f6e\u4f1a\u4fdd\u5b58\u5230\u5f53\u524d\u4f1a\u8bae\u4e0b\uff0c\u5efa\u8bae\u5148\u786e\u5b9a\u5f53\u524d\u4f1a\u573a\u540e\u518d\u8fdb\u884c\u914d\u7f6e\u3002'
            }
          </Paragraph>
        </div>
      </Card>
    );
  }

  return (
    <div className="page-frame">
      <Card className="page-card">
        <Space
          style={{ width: '100%', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
          align="start"
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {'\u6253\u5370\u7ec8\u7aef'}
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
              {
                '\u8bbe\u7f6e\u4f1a\u76f4\u63a5\u5f71\u54cd\u7b7e\u5230\u53f0\u7684\u80f8\u724c\u6253\u5370\u4f53\u9a8c\uff0c\u5efa\u8bae\u5148\u8fdb\u884c\u6d4b\u8bd5\u6253\u5370\u518d\u5f00\u542f\u81ea\u52a8\u6253\u5370\u3002'
              }
            </Paragraph>
          </div>
          <Space wrap>
            <Tag color="processing">
              {'\u5f53\u524d\u4f1a\u8bae: '}
              {currentMeeting.title}
            </Tag>
            {currentMeeting.auto_print ? (
              <Tag color="success">{'\u81ea\u52a8\u6253\u5370\u5df2\u5f00\u542f'}</Tag>
            ) : (
              <Tag>{'\u81ea\u52a8\u6253\u5370\u672a\u5f00\u542f'}</Tag>
            )}
          </Space>
        </Space>
      </Card>

      {!selectedPrinterInfo ? (
        <Alert
          type="warning"
          showIcon
          message={'\u8fd8\u6ca1\u6709\u9009\u4e2d\u53ef\u7528\u6253\u5370\u673a'}
          description={
            '\u8bf7\u5148\u4ece\u5217\u8868\u4e2d\u9009\u62e9\u4e00\u53f0\u6253\u5370\u673a\uff0c\u5e76\u4f7f\u7528\u6d4b\u8bd5\u6253\u5370\u786e\u8ba4\u8fde\u901a\u6027\u3002'
          }
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card className="page-card">
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Space
                style={{ width: '100%', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                align="start"
              >
                <div>
                  <Title level={5} style={{ margin: 0 }}>
                    {'\u6253\u5370\u673a\u9009\u62e9'}
                  </Title>
                  <Text type="secondary">
                    {'\u53ef\u4ee5\u5728\u8fd9\u91cc\u5207\u6362\u6253\u5370\u8bbe\u5907\uff0c\u6216\u8005\u5237\u65b0\u5217\u8868\u540e\u91cd\u65b0\u8bc6\u522b\u3002'}
                  </Text>
                </div>
                <Button icon={<ReloadOutlined />} onClick={() => void loadPrinters()} loading={loading}>
                  {'\u5237\u65b0\u5217\u8868'}
                </Button>
              </Space>

              <Select
                size="large"
                value={selectedPrinter || undefined}
                onChange={handlePrinterChange}
                placeholder={'\u9009\u62e9\u6253\u5370\u673a'}
                loading={loading}
                options={printers.map((printer) => ({
                  value: printer.name,
                  label: `${printer.name}${printer.is_default ? ' (默认)' : ''}`,
                }))}
              />

              <div className="subtle-panel" style={{ padding: 16 }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Text type="secondary">{'\u5f53\u524d\u8bbe\u5907'}</Text>
                    <div style={{ marginTop: 6, fontWeight: 600 }}>
                      {selectedPrinterInfo?.name || '\u672a\u9009\u62e9'}
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <Text type="secondary">{'\u72b6\u6001'}</Text>
                    <div style={{ marginTop: 6 }}>
                      {selectedPrinterInfo ? (
                        <Tag color="success">{selectedPrinterInfo.status || '\u672a\u77e5'}</Tag>
                      ) : (
                        <Tag>{'\u672a\u77e5'}</Tag>
                      )}
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <Text type="secondary">{'\u7c7b\u578b'}</Text>
                    <div style={{ marginTop: 6 }}>
                      {selectedPrinterInfo?.is_network
                        ? '\u7f51\u7edc\u6253\u5370\u673a'
                        : '\u672c\u5730\u6253\u5370\u673a'}
                    </div>
                  </Col>
                </Row>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card className="page-card">
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {'\u6253\u5370\u7b56\u7565'}
                </Title>
                <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                  {'\u914d\u7f6e\u4f1a\u4fdd\u5b58\u5230\u5f53\u524d\u4f1a\u8bae\uff0c\u4e0d\u4f1a\u5f71\u54cd\u5176\u4ed6\u4f1a\u573a\u3002'}
                </Paragraph>
              </div>

              <div className="subtle-panel" style={{ padding: 16 }}>
                <Space
                  style={{ width: '100%', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                  align="center"
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{'\u81ea\u52a8\u6253\u5370'}</div>
                    <Text type="secondary">
                      {'\u7b7e\u5230\u6210\u529f\u540e\u76f4\u63a5\u6253\u5370\u80f8\u724c\uff0c\u9002\u5408\u7a33\u5b9a\u7684\u73b0\u573a\u6253\u5370\u73af\u5883\u3002'}
                    </Text>
                  </div>
                  <Switch checked={autoPrint} onChange={handleAutoPrintChange} />
                </Space>
              </div>

              <Space wrap>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => void handleTestPrint()}
                  loading={testing}
                  disabled={!selectedPrinter}
                >
                  {'\u6d4b\u8bd5\u6253\u5370'}
                </Button>
                <Button
                  type="primary"
                  onClick={() => void handleSave()}
                  loading={saving}
                  disabled={!currentMeeting}
                >
                  {'\u4fdd\u5b58\u8bbe\u7f6e'}
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
