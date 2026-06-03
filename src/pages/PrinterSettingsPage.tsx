import { useState, useEffect } from 'react';
import { Card, Select, Button, Space, message, Typography, Divider, Switch } from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { printApi } from '@/services/api';
import type { PrinterInfo } from '@/types/printer';
import { useMeetingStore } from '@/stores/meetingStore';

const { Text, Title } = Typography;

export default function PrinterSettingsPage() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const { currentMeeting, updateMeeting } = useMeetingStore();

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const list = await printApi.listPrinters();
      setPrinters(list);
      const def = list.find((p) => p.is_default);
      if (def && !selectedPrinter) {
        setSelectedPrinter(def.name);
      }
    } catch (e) {
      message.error(String(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  useEffect(() => {
    if (currentMeeting?.printer_name) {
      setSelectedPrinter(currentMeeting.printer_name);
    }
    if (currentMeeting?.auto_print !== undefined) {
      setAutoPrint(currentMeeting.auto_print);
    }
  }, [currentMeeting]);

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      message.warning('请先选择打印机');
      return;
    }
    setTesting(true);
    try {
      await printApi.testPrint(selectedPrinter);
      message.success('测试打印已发送');
    } catch (e) {
      message.error(String(e));
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!currentMeeting) {
      message.warning('请先选择会议');
      return;
    }
    try {
      await updateMeeting(currentMeeting.id, { printer_name: selectedPrinter, auto_print: autoPrint });
      message.success('打印设置已保存');
    } catch (e) {
      message.error(String(e));
    }
  };

  return (
    <Card title="打印设置" style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>选择打印机</Title>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            value={selectedPrinter}
            onChange={setSelectedPrinter}
            placeholder="选择打印机"
            style={{ width: 'calc(100% - 80px)' }}
            loading={loading}
            options={printers.map((p) => ({
              value: p.name,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.name}</span>
                  {p.is_default && <Text type="secondary">(默认)</Text>}
                </div>
              ),
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadPrinters} loading={loading}>
            刷新
          </Button>
        </Space.Compact>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>打印机状态</Title>
        {printers.find((p) => p.name === selectedPrinter) && (
          <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
            <div><Text strong>名称: </Text>{selectedPrinter}</div>
            <div><Text strong>状态: </Text>{printers.find((p) => p.name === selectedPrinter)?.status || '未知'}</div>
            <div><Text strong>类型: </Text>{printers.find((p) => p.name === selectedPrinter)?.is_network ? '网络打印机' : '本地打印机'}</div>
          </div>
        )}
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>自动打印</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch checked={autoPrint} onChange={setAutoPrint} />
          <Text type="secondary">签到成功后自动打印胸牌</Text>
        </div>
      </div>

      <Divider />

      <Space>
        <Button icon={<PrinterOutlined />} onClick={handleTestPrint} loading={testing} disabled={!selectedPrinter}>
          测试打印
        </Button>
        <Button type="primary" onClick={handleSave} disabled={!currentMeeting}>
          保存设置
        </Button>
      </Space>
    </Card>
  );
}
