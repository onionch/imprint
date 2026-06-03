import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Card, Button, Space, Tag, Statistic, Row, Col, message, Modal, Form, Typography } from 'antd';
import type { InputRef } from 'antd';
import { CheckCircleOutlined, SearchOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import { useMeetingStore } from '@/stores/meetingStore';
import { useCheckinStore } from '@/stores/checkinStore';
import { attendeeApi, checkinApi, badgeApi, printApi } from '@/services/api';
import { captureHtmlToPng } from '@/utils/badgeCapture';
import type { Attendee } from '@/types/attendee';

const { Text } = Typography;

export default function CheckinPage() {
  const { currentMeeting } = useMeetingStore();
  const {
    searchResults,
    selectedAttendee,
    stats,
    recentRecords,
    searchLoading,
    checkinLoading,
    search,
    selectAttendee,
    checkin,
    loadStats,
    loadRecentRecords,
    clearSearch,
  } = useCheckinStore();
  const [query, setQuery] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm] = Form.useForm();
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [printing, setPrinting] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (currentMeeting) {
      loadStats(currentMeeting.id);
      loadRecentRecords(currentMeeting.id);
    }
  }, [currentMeeting, loadRecentRecords, loadStats]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (currentMeeting && value.trim()) {
        search(currentMeeting.id, value);
      } else {
        clearSearch();
      }
    },
    [currentMeeting, search, clearSearch]
  );

  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1000;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore audio failures
    }
  };

  const handlePrintBadge = useCallback(
    async (attendeeId: number) => {
      if (!currentMeeting?.badge_template_id) {
        throw new Error('请先在会议设置中选择胸牌模板');
      }
      if (!currentMeeting.printer_name) {
        throw new Error('请先在打印设置中选择打印机');
      }

      setPrinting(true);
      try {
        const html = await badgeApi.renderHtml(currentMeeting.badge_template_id, attendeeId, currentMeeting.id);
        const pngBase64 = await captureHtmlToPng(html);
        await printApi.printBadge(currentMeeting.printer_name, pngBase64, currentMeeting.paper_size || 'CR80');
        await checkinApi.markBadgePrinted(attendeeId, currentMeeting.id, new Date().toISOString());
        message.success('胸牌打印成功');
        await loadStats(currentMeeting.id);
      } finally {
        setPrinting(false);
      }
    },
    [currentMeeting, loadStats]
  );

  const handlePostCheckin = useCallback(
    async (attendeeId: number, successMessage: string) => {
      if (!currentMeeting) {
        return;
      }

      setCheckinSuccess(true);
      message.success(successMessage);
      playBeep();
      setTimeout(() => setCheckinSuccess(false), 1500);

      await Promise.all([
        loadStats(currentMeeting.id),
        loadRecentRecords(currentMeeting.id),
      ]);

      setQuery('');
      clearSearch();
      inputRef.current?.focus();

      console.log('[auto-print] auto_print:', currentMeeting.auto_print, 'type:', typeof currentMeeting.auto_print, 'full:', JSON.stringify(currentMeeting));
      if (!currentMeeting.auto_print) {
        message.info('自动打印未开启（auto_print=' + currentMeeting.auto_print + '）');
        return;
      }

      if (!currentMeeting.badge_template_id) {
        message.warning('自动打印未执行：请先选择胸牌模板');
        return;
      }

      if (!currentMeeting.printer_name) {
        message.warning('自动打印未执行：请先选择打印机');
        return;
      }

      try {
        await handlePrintBadge(attendeeId);
      } catch (printErr) {
        message.warning('自动打印失败: ' + String(printErr));
      }
    },
    [clearSearch, currentMeeting, handlePrintBadge, loadRecentRecords, loadStats]
  );

  const handleCheckin = async (attendee: Attendee) => {
    if (!currentMeeting) return;

    try {
      await checkin(attendee.id, currentMeeting.id, 'search');
      await handlePostCheckin(attendee.id, `${attendee.name} 签到成功！`);
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleRegisterAndCheckin = async (values: Record<string, unknown>) => {
    if (!currentMeeting) return;

    try {
      const attendee = await attendeeApi.addOnsite({
        meeting_id: currentMeeting.id,
        name: String(values.name ?? ''),
        phone: typeof values.phone === 'string' ? values.phone : undefined,
        id_card: typeof values.id_card === 'string' ? values.id_card : undefined,
        department: typeof values.department === 'string' ? values.department : undefined,
        position: typeof values.position === 'string' ? values.position : undefined,
      });
      await checkin(attendee.id, currentMeeting.id, 'manual');
      setShowRegister(false);
      registerForm.resetFields();
      await handlePostCheckin(attendee.id, `${values.name ?? '参会者'} 登记并签到成功！`);
    } catch (e) {
      message.error(String(e));
    }
  };

  if (!currentMeeting) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <Text type="secondary" style={{ fontSize: 18 }}>
          请先选择或创建一个会议
        </Text>
      </div>
    );
  }

  return (
    <div>
      {checkinSuccess && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(82, 196, 26, 0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <CheckCircleOutlined style={{ fontSize: 120, color: '#52c41a' }} />
        </div>
      )}

      <Row gutter={24}>
        <Col span={16}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Input
                ref={inputRef}
                size="large"
                placeholder="输入姓名、身份证号、手机号或签到码搜索..."
                prefix={<SearchOutlined />}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onPressEnter={() => {
                  if (searchResults.length === 1) {
                    selectAttendee(searchResults[0]);
                  }
                }}
                allowClear
                autoFocus
              />
            </div>

            {searchResults.length > 0 && !selectedAttendee && (
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, maxHeight: 300, overflow: 'auto' }}>
                {searchResults.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onClick={() => selectAttendee(att)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                    }}
                  >
                    <div>
                      <Text strong style={{ fontSize: 16 }}>
                        {att.name}
                      </Text>
                      {att.department && (
                        <Text type="secondary" style={{ marginLeft: 12 }}>
                          {att.department}
                        </Text>
                      )}
                    </div>
                    <div>{att.checked_in ? <Tag color="green">已签到</Tag> : <Tag>未签到</Tag>}</div>
                  </div>
                ))}
              </div>
            )}

            {selectedAttendee && (
              <Card style={{ marginTop: 16, borderColor: '#1664FF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ fontSize: 20 }}>
                      {selectedAttendee.name}
                    </Text>
                    <div style={{ marginTop: 8, color: '#666' }}>
                      {selectedAttendee.department && (
                        <span style={{ marginRight: 16 }}>部门: {selectedAttendee.department}</span>
                      )}
                      {selectedAttendee.position && (
                        <span style={{ marginRight: 16 }}>职位: {selectedAttendee.position}</span>
                      )}
                      {selectedAttendee.phone && <span>电话: {selectedAttendee.phone}</span>}
                    </div>
                  </div>
                  <Space>
                    <Button
                      onClick={() => {
                        clearSearch();
                        setQuery('');
                        inputRef.current?.focus();
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      loading={checkinLoading}
                      onClick={() => handleCheckin(selectedAttendee)}
                      size="large"
                    >
                      确认签到
                    </Button>
                    <Button
                      icon={<PrinterOutlined />}
                      loading={printing}
                      onClick={async () => {
                        try {
                          await handlePrintBadge(selectedAttendee.id);
                        } catch (e) {
                          message.error(String(e));
                        }
                      }}
                    >
                      打印胸牌
                    </Button>
                  </Space>
                </div>
              </Card>
            )}

            {query && searchResults.length === 0 && !searchLoading && !selectedAttendee && (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                <p>未找到匹配的参会者</p>
                <Button type="link" icon={<PlusOutlined />} onClick={() => setShowRegister(true)}>
                  现场登记并签到
                </Button>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="签到统计">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="总参会人数" value={stats?.total_attendees || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="已签到" value={stats?.checked_in || 0} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col span={12}>
                <Statistic title="未签到" value={stats?.not_checked_in || 0} />
              </Col>
              <Col span={12}>
                <Statistic
                  title="未打印胸牌"
                  value={stats?.badges_not_printed || 0}
                  styles={{ content: { color: '#faad14' } }}
                />
              </Col>
            </Row>
          </Card>

          <Card title="最近签到" style={{ marginTop: 16 }}>
            {recentRecords.slice(0, 5).map((record) => (
              <div key={record.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{record.attendee_name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(record.checkin_time).toLocaleTimeString()}
                  </Text>
                </div>
                {record.attendee_department && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.attendee_department}
                  </Text>
                )}
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Modal
        title="现场登记"
        open={showRegister}
        onCancel={() => setShowRegister(false)}
        onOk={() => registerForm.submit()}
      >
        <Form form={registerForm} layout="vertical" onFinish={handleRegisterAndCheckin}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号">
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
