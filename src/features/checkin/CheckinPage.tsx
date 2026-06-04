import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import type { InputRef } from 'antd';
import {
  CheckCircleOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMeetingStore } from '@/features/meeting';
import { attendeeApi, badgeApi, checkinApi, printApi } from '@/shared/api';
import type { Attendee } from '@/shared/types/attendee';
import { captureHtmlToPng } from '@/shared/utils/badgeCapture';
import { useCheckinStore } from './checkinStore';

const { Text, Title, Paragraph } = Typography;

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

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
  const [printing, setPrinting] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [lastCheckedIn, setLastCheckedIn] = useState<{ id: number; name: string } | null>(null);
  const [registerForm] = Form.useForm();
  const inputRef = useRef<InputRef>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!currentMeeting) {
      return;
    }

    void loadStats(currentMeeting.id);
    void loadRecentRecords(currentMeeting.id);
  }, [currentMeeting, loadRecentRecords, loadStats]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const resetSearchFlow = useCallback(() => {
    setQuery('');
    setLastCheckedIn(null);
    clearSearch();
    focusSearch();
  }, [clearSearch, focusSearch]);

  const refreshSidebarData = useCallback(
    async (meetingId: number) => {
      await Promise.all([loadStats(meetingId), loadRecentRecords(meetingId)]);
    },
    [loadRecentRecords, loadStats]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (currentMeeting && value.trim()) {
        debounceTimerRef.current = setTimeout(() => {
          void search(currentMeeting.id, value);
        }, 250);
        return;
      }
      clearSearch();
    },
    [clearSearch, currentMeeting, search]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const playTone = useCallback((type: 'success' | 'error') => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.3;
      if (type === 'success') {
        osc.frequency.value = 1200;
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.value = 400;
        osc.type = 'square';
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Ignore audio failures on unsupported devices.
    }
  }, []);

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
        const html = await badgeApi.renderHtml(
          currentMeeting.badge_template_id,
          attendeeId,
          currentMeeting.id
        );
        const pngBase64 = await captureHtmlToPng(html);
        await printApi.printBadge(
          currentMeeting.printer_name,
          pngBase64,
          currentMeeting.paper_size || 'CR80'
        );
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
    async (attendeeId: number, attendeeName: string) => {
      if (!currentMeeting) return;

      setCheckinSuccess(true);
      message.success(`${attendeeName} 已签到`);
      playTone('success');
      window.setTimeout(() => setCheckinSuccess(false), 1200);

      setLastCheckedIn({ id: attendeeId, name: attendeeName });
      setQuery('');
      clearSearch();

      await refreshSidebarData(currentMeeting.id);

      if (!currentMeeting.auto_print) return;
      if (!currentMeeting.badge_template_id) {
        message.warning('自动打印未执行：请先配置胸牌模板');
        return;
      }
      if (!currentMeeting.printer_name) {
        message.warning('自动打印未执行：请先配置打印机');
        return;
      }
      try {
        await handlePrintBadge(attendeeId);
      } catch (error) {
        message.warning('自动打印失败：' + String(error));
      }
    },
    [currentMeeting, handlePrintBadge, refreshSidebarData, clearSearch, playTone]
  );

  const handleCheckin = async (attendee: Attendee) => {
    if (!currentMeeting) return;
    try {
      await checkin(attendee.id, currentMeeting.id, 'search');
      await handlePostCheckin(attendee.id, attendee.name);
    } catch (error) {
      playTone('error');
      message.error(String(error));
    }
  };

  const handleRegisterAndCheckin = async (values: Record<string, unknown>) => {
    if (!currentMeeting) return;
    try {
      const attendee = await attendeeApi.addOnsite({
        meeting_id: currentMeeting.id,
        name: String(values.name ?? '').trim(),
        phone: toOptionalString(values.phone),
        id_card: toOptionalString(values.id_card),
        department: toOptionalString(values.department),
        position: toOptionalString(values.position),
      });
      await checkin(attendee.id, currentMeeting.id, 'manual');
      setShowRegister(false);
      registerForm.resetFields();
      await handlePostCheckin(attendee.id, attendee.name);
    } catch (error) {
      playTone('error');
      message.error(String(error));
    }
  };

  if (!currentMeeting) {
    return (
      <Card className="page-card">
        <div style={{ textAlign: 'center', padding: '80px 16px' }}>
          <Title level={4}>请先选择会议</Title>
          <Paragraph type="secondary">
            签到台围绕当前会议工作。先在左上角选择一个会议，再开始检索、签到和打印胸牌。
          </Paragraph>
        </div>
      </Card>
    );
  }

  return (
    <div className="page-frame">
      {checkinSuccess ? (
        <div className="floating-feedback">
          <CheckCircleOutlined style={{ fontSize: 132, color: '#15803d' }} />
        </div>
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="总参会人" value={stats?.total_attendees || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="已签到" value={stats?.checked_in || 0} valueStyle={{ color: '#15803d' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic title="未签到" value={stats?.not_checked_in || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-card metric-card">
            <Statistic
              title="待打印胸牌"
              value={stats?.badges_not_printed || 0}
              valueStyle={{ color: '#d97706' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card className="page-card">
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Space
                style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}
                align="start"
              >
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    快速签到
                  </Title>
                  <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                    支持姓名、手机号、身份证号或签到码检索。录入后按回车，如果结果唯一会直接进入确认态。
                  </Paragraph>
                </div>
                <Space wrap>
                  {currentMeeting.auto_print ? <Tag color="success">自动打印已开启</Tag> : <Tag>自动打印未开启</Tag>}
                  <Button icon={<PlusOutlined />} onClick={() => setShowRegister(true)}>
                    现场补录
                  </Button>
                </Space>
              </Space>

              <Input
                ref={inputRef}
                size="large"
                placeholder="输入姓名、手机号、身份证号或签到码  (Enter 确认, Esc 清空, 1-9 快选)"
                prefix={<SearchOutlined />}
                value={query}
                onChange={(event) => handleSearch(event.target.value)}
                onPressEnter={() => {
                  if (searchResults.length === 1) selectAttendee(searchResults[0]);
                }}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    resetSearchFlow();
                    return;
                  }
                  const num = Number(e.key);
                  if (num >= 1 && num <= 9 && !selectedAttendee && searchResults.length >= num) {
                    e.preventDefault();
                    selectAttendee(searchResults[num - 1]);
                  }
                }}
                allowClear
                autoFocus
              />

              {searchLoading ? (
                <div className="subtle-panel" style={{ padding: 28, textAlign: 'center' }}>
                  <Spin />
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary">正在检索匹配的参会人…</Text>
                  </div>
                </div>
              ) : null}

              {selectedAttendee ? (
                <Card className="page-card focus-card">
                  <Space
                    style={{ width: '100%', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
                    align="start"
                  >
                    <div>
                      <Title level={3} style={{ margin: 0 }}>
                        {selectedAttendee.name}
                      </Title>
                      <Space wrap size={[8, 8]} style={{ marginTop: 10 }}>
                        {selectedAttendee.department ? <Tag>{selectedAttendee.department}</Tag> : null}
                        {selectedAttendee.position ? <Tag>{selectedAttendee.position}</Tag> : null}
                        {selectedAttendee.phone ? <Tag>{selectedAttendee.phone}</Tag> : null}
                        {selectedAttendee.checked_in ? <Tag color="green">已签到</Tag> : <Tag>未签到</Tag>}
                      </Space>
                    </div>

                    <Space wrap>
                      <Button onClick={resetSearchFlow}>取消</Button>
                      <Button
                        type="primary"
                        size="large"
                        icon={<CheckCircleOutlined />}
                        loading={checkinLoading}
                        onClick={() => void handleCheckin(selectedAttendee)}
                      >
                        确认签到
                      </Button>
                      <Button
                        icon={<PrinterOutlined />}
                        loading={printing}
                        onClick={() =>
                          void handlePrintBadge(selectedAttendee.id).catch((error) =>
                            message.error(String(error))
                          )
                        }
                      >
                        打印胸牌
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ) : null}

              {lastCheckedIn && !selectedAttendee && searchResults.length === 0 ? (
                <Card className="page-card focus-card">
                  <Space
                    style={{ width: '100%', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
                    align="center"
                  >
                    <Space>
                      <CheckCircleOutlined style={{ fontSize: 28, color: '#15803d' }} />
                      <div>
                        <Title level={4} style={{ margin: 0 }}>{lastCheckedIn.name}</Title>
                        <Text type="secondary">签到成功</Text>
                      </div>
                    </Space>
                    <Space wrap>
                      <Button
                        icon={<PrinterOutlined />}
                        loading={printing}
                        onClick={() =>
                          void handlePrintBadge(lastCheckedIn.id).catch((err) =>
                            message.error(String(err))
                          )
                        }
                      >
                        打印胸牌
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={resetSearchFlow}
                      >
                        继续签到
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ) : null}

              {!selectedAttendee && searchResults.length > 0 ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {searchResults.map((attendee, index) => (
                    <Card
                      key={attendee.id}
                      className="page-card interactive-row"
                      styles={{ body: { padding: 16 } }}
                      onClick={() => selectAttendee(attendee)}
                    >
                      <Space
                        style={{ width: '100%', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                        align="center"
                      >
                        <Space>
                          {index < 9 && (
                            <Tag
                              style={{
                                minWidth: 24,
                                textAlign: 'center',
                                borderRadius: 6,
                                background: '#f0f0f0',
                                border: '1px solid #d9d9d9',
                                color: '#8c8c8c',
                                fontSize: 12,
                              }}
                            >
                              {index + 1}
                            </Tag>
                          )}
                          <div>
                            <Title level={5} style={{ margin: 0 }}>
                              {attendee.name}
                            </Title>
                            <Space wrap size={[8, 8]} style={{ marginTop: 8 }}>
                              {attendee.department ? <Tag>{attendee.department}</Tag> : null}
                              {attendee.position ? <Tag>{attendee.position}</Tag> : null}
                              {attendee.phone ? <Tag>{attendee.phone}</Tag> : null}
                            </Space>
                          </div>
                        </Space>
                        {attendee.checked_in ? <Tag color="green">已签到</Tag> : <Tag>待签到</Tag>}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ) : null}

              {!searchLoading && query && searchResults.length === 0 && !selectedAttendee ? (
                <div className="subtle-panel" style={{ padding: 28, textAlign: 'center' }}>
                  <Title level={5}>未找到匹配的参会人</Title>
                  <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    可以检查检索关键词，或直接做现场补录并完成签到。
                  </Paragraph>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowRegister(true)}>
                    现场补录并签到
                  </Button>
                </div>
              ) : null}
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card className="page-card">
              <Title level={5}>当前会议配置</Title>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">胸牌模板</Text>
                  <div>{currentMeeting.badge_template_id ? '已配置' : '未配置'}</div>
                </div>
                <div>
                  <Text type="secondary">打印机</Text>
                  <div>{currentMeeting.printer_name || '未配置打印机'}</div>
                </div>
                <div>
                  <Text type="secondary">自动打印</Text>
                  <div>{currentMeeting.auto_print ? '已开启' : '未开启'}</div>
                </div>
              </Space>
            </Card>

            <Card className="page-card">
              <Title level={5}>最近签到</Title>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {recentRecords.length === 0 ? (
                  <Text type="secondary">当前还没有签到记录。</Text>
                ) : (
                  recentRecords.slice(0, 6).map((record) => (
                    <div key={record.id} className="subtle-panel" style={{ padding: 14 }}>
                      <Space
                        style={{ width: '100%', justifyContent: 'space-between', gap: 12 }}
                        align="start"
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{record.attendee_name}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.attendee_department || '未填写部门'}
                          </Text>
                        </div>
                        <Tag color={record.badge_printed ? 'green' : 'gold'}>
                          {record.badge_printed ? '已打印' : '待打印'}
                        </Tag>
                      </Space>
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(record.checkin_time).toLocaleTimeString()}
                        </Text>
                      </div>
                    </div>
                  ))
                )}
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        title="现场补录"
        open={showRegister}
        onCancel={() => setShowRegister(false)}
        onOk={() => registerForm.submit()}
        okText="登记并签到"
      >
        <Form form={registerForm} layout="vertical" onFinish={handleRegisterAndCheckin}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
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
