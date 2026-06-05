import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Spin, message } from 'antd';
import type { InputRef } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CrownOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  PrinterOutlined,
  SafetyCertificateFilled,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMeetingStore } from '@/features/meeting';
import { badgeApi, checkinApi, printApi } from '@/shared/api';
import type { Attendee } from '@/shared/types/attendee';
import type { CheckinRecord } from '@/shared/types/checkin';
import { captureHtmlToPng } from '@/shared/utils/badgeCapture';
import { useCheckinStore } from './checkinStore';

type FeedbackTone = 'idle' | 'processing' | 'success' | 'warning' | 'error';
type PrintState = 'pending' | 'printed' | 'warning' | 'error';

interface FeedbackState {
  tone: FeedbackTone;
  title: string;
  description: string;
  badgeLabel: string;
  printLabel: string;
  printState: PrintState;
}

function getDisplayRole(attendee: Attendee) {
  return attendee.position || '参会嘉宾';
}

function getDisplayOrg(attendee: Attendee) {
  return attendee.department || '未填写单位';
}

function getBadgeLevel(attendee: Attendee) {
  if (attendee.position?.includes('CEO') || attendee.position?.includes('总')) {
    return '全域通行';
  }
  if (attendee.position?.toLowerCase().includes('speaker')) {
    return '演讲嘉宾';
  }
  return '标准通行';
}

function getRecordIcon(index: number) {
  if (index === 0) {
    return <CrownOutlined className="record-item__icon record-item__icon--primary" />;
  }
  if (index === 1) {
    return <SolutionOutlined className="record-item__icon record-item__icon--accent" />;
  }
  return <UserOutlined className="record-item__icon record-item__icon--muted" />;
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function createIdleFeedback(): FeedbackState {
  return {
    tone: 'idle',
    title: '等待核验',
    description: '请输入签到码并按 Enter 查询，选中人员后自动完成签到与打印。',
    badgeLabel: '待识别',
    printLabel: '未打印',
    printState: 'pending',
  };
}

function buildFeedbackFromRecord(
  attendee: Attendee,
  record: CheckinRecord | null,
  state: Omit<FeedbackState, 'badgeLabel'>
): FeedbackState {
  return {
    ...state,
    badgeLabel: getBadgeLevel(attendee),
    printLabel: record?.badge_printed ? '已打印' : state.printLabel,
    printState: record?.badge_printed ? 'printed' : state.printState,
  };
}

export default function CheckinPage() {
  const { currentMeeting } = useMeetingStore();
  const {
    searchResults,
    selectedAttendee,
    recentRecords,
    stats,
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
  const [feedbackAttendee, setFeedbackAttendee] = useState<Attendee | null>(null);
  const [feedbackRecord, setFeedbackRecord] = useState<CheckinRecord | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(createIdleFeedback);
  const [processingAttendeeId, setProcessingAttendeeId] = useState<number | null>(null);
  const inputRef = useRef<InputRef>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshMeetingData = useCallback(
    async (meetingId: number) => {
      await Promise.all([loadStats(meetingId), loadRecentRecords(meetingId)]);
    },
    [loadRecentRecords, loadStats]
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const finalizeFlow = useCallback(() => {
    setQuery('');
    clearSearch();
    queueMicrotask(focusInput);
  }, [clearSearch, focusInput]);

  const findExistingRecord = useCallback(
    async (meetingId: number, attendeeId: number) => {
      const records = await checkinApi.listRecords(meetingId, 500, 0);
      return records.find((record) => record.attendee_id === attendeeId) ?? null;
    },
    []
  );

  const runSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!currentMeeting || !trimmed) {
        clearSearch();
        return [];
      }
      return search(currentMeeting.id, trimmed);
    },
    [clearSearch, currentMeeting, search]
  );

  const printBadgeForAttendee = useCallback(
    async (attendee: Attendee, record: CheckinRecord) => {
      if (!currentMeeting?.badge_template_id) {
        const nextState = buildFeedbackFromRecord(attendee, record, {
          tone: 'warning',
          title: '签到成功',
          description: '未配置胸牌模板，暂未触发打印。',
          printLabel: '未打印',
          printState: 'warning',
        });
        setFeedbackState(nextState);
        return record;
      }

      if (!currentMeeting.printer_name) {
        const nextState = buildFeedbackFromRecord(attendee, record, {
          tone: 'warning',
          title: '签到成功',
          description: '未配置打印机，暂未触发打印。',
          printLabel: '未打印',
          printState: 'warning',
        });
        setFeedbackState(nextState);
        return record;
      }

      setFeedbackState(
        buildFeedbackFromRecord(attendee, record, {
          tone: 'processing',
          title: '验证成功',
          description: '签到完成，正在发送打印任务...',
          printLabel: '打印中',
          printState: 'pending',
        })
      );

      const html = await badgeApi.renderHtml(currentMeeting.badge_template_id, attendee.id, currentMeeting.id);
      const pngBase64 = await captureHtmlToPng(html);
      await printApi.printBadge(currentMeeting.printer_name, pngBase64, currentMeeting.paper_size);

      const printTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      await checkinApi.markBadgePrinted(attendee.id, currentMeeting.id, printTime);

      const printedRecord: CheckinRecord = {
        ...record,
        badge_printed: true,
        badge_print_time: printTime,
        reprint_count: record.reprint_count + 1,
      };

      setFeedbackRecord(printedRecord);
      setFeedbackState(
        buildFeedbackFromRecord(attendee, printedRecord, {
          tone: 'success',
          title: '打印完成',
          description: `已发送到打印机：${currentMeeting.printer_name}`,
          printLabel: '已打印',
          printState: 'printed',
        })
      );
      return printedRecord;
    },
    [currentMeeting]
  );

  const processAttendee = useCallback(
    async (attendee: Attendee, method: string) => {
      if (!currentMeeting || processingAttendeeId !== null) {
        return;
      }

      setProcessingAttendeeId(attendee.id);
      setFeedbackAttendee(attendee);
      setFeedbackRecord(null);
      selectAttendee(attendee);

      try {
        if (attendee.checked_in) {
          const existingRecord = await findExistingRecord(currentMeeting.id, attendee.id);
          setFeedbackRecord(existingRecord);
          setFeedbackState(
            buildFeedbackFromRecord(attendee, existingRecord, {
              tone: 'warning',
              title: '该人员已签到',
              description: existingRecord?.badge_printed
                ? '当前胸牌已打印，无需重复签到。'
                : '当前胸牌尚未打印，请在记录页补打或检查打印配置。',
              printLabel: existingRecord?.badge_printed ? '已打印' : '未打印',
              printState: existingRecord?.badge_printed ? 'printed' : 'warning',
            })
          );
          message.warning(`${attendee.name} 已签到`);
          return;
        }

        const record = await checkin(attendee.id, currentMeeting.id, method);
        const checkedInAttendee = { ...attendee, checked_in: true };
        setFeedbackAttendee(checkedInAttendee);
        setFeedbackRecord(record);
        setFeedbackState(
          buildFeedbackFromRecord(checkedInAttendee, record, {
            tone: 'processing',
            title: '验证成功',
            description: '签到记录已创建，准备打印胸牌...',
            printLabel: '未打印',
            printState: 'pending',
          })
        );

        await printBadgeForAttendee(checkedInAttendee, record);
        await refreshMeetingData(currentMeeting.id);
        message.success(`${attendee.name} 签到完成`);
      } catch (error) {
        const errorText = getErrorText(error);
        let existingRecord: CheckinRecord | null = null;

        if (errorText.includes('已签到')) {
          existingRecord = await findExistingRecord(currentMeeting.id, attendee.id);
        }

        setFeedbackRecord(existingRecord);
        setFeedbackState(
          buildFeedbackFromRecord(attendee, existingRecord, {
            tone: existingRecord ? 'warning' : 'error',
            title: existingRecord ? '该人员已签到' : '处理失败',
            description: existingRecord
              ? existingRecord.badge_printed
                ? '该人员已完成签到并已打印胸牌。'
                : '该人员已签到，但胸牌尚未打印。'
              : errorText,
            printLabel: existingRecord?.badge_printed ? '已打印' : '未打印',
            printState: existingRecord?.badge_printed ? 'printed' : 'error',
          })
        );
        message.error(errorText);
      } finally {
        await refreshMeetingData(currentMeeting.id);
        setProcessingAttendeeId(null);
        selectAttendee(null);
        finalizeFlow();
      }
    },
    [
      checkin,
      currentMeeting,
      finalizeFlow,
      findExistingRecord,
      printBadgeForAttendee,
      processingAttendeeId,
      refreshMeetingData,
      selectAttendee,
    ]
  );

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (!currentMeeting) {
      queueMicrotask(() => {
        setQuery('');
        setFeedbackAttendee(null);
        setFeedbackRecord(null);
        setFeedbackState(createIdleFeedback());
      });
      clearSearch();
      return;
    }

    void refreshMeetingData(currentMeeting.id);
    queueMicrotask(() => {
      setQuery('');
      setFeedbackAttendee(null);
      setFeedbackRecord(null);
      setFeedbackState({
        ...createIdleFeedback(),
        description: `当前会议：${currentMeeting.title}。请输入签到码并按 Enter 查询。`,
      });
    });
    clearSearch();
  }, [clearSearch, currentMeeting, refreshMeetingData]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!value.trim()) {
        clearSearch();
        if (!processingAttendeeId) {
          setFeedbackRecord(null);
          setFeedbackAttendee(null);
          setFeedbackState(createIdleFeedback());
        }
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        void runSearch(value);
      }, 250);
    },
    [clearSearch, processingAttendeeId, runSearch]
  );

  const handleEnterSearch = useCallback(async () => {
    if (!currentMeeting) {
      message.warning('请先选择会议');
      return;
    }

    if (!query.trim()) {
      message.warning('请输入签到码');
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const results = await runSearch(query);

    if (results.length === 0) {
      setFeedbackAttendee(null);
      setFeedbackRecord(null);
      setFeedbackState({
        tone: 'warning',
        title: '未找到匹配人员',
        description: '请核对签到码或手机号后重试。',
        badgeLabel: '待识别',
        printLabel: '未打印',
        printState: 'warning',
      });
      message.warning('未找到匹配人员');
      return;
    }

    if (results.length === 1) {
      await processAttendee(results[0], 'code');
      return;
    }

    setFeedbackAttendee(null);
    setFeedbackRecord(null);
    setFeedbackState({
      tone: 'processing',
      title: `找到 ${results.length} 位匹配人员`,
      description: '请从左侧列表中点击正确的人员信息，系统会自动签到并打印。',
      badgeLabel: '待确认',
      printLabel: '待选择',
      printState: 'pending',
    });
  }, [currentMeeting, processAttendee, query, runSearch]);

  const progressPercent = stats
    ? Math.min(100, Math.round((stats.checked_in / Math.max(stats.total_attendees, 1)) * 1000) / 10)
    : 0;

  const handleFocusInput = () => {
    focusInput();
  };

  const feedbackIcon = useMemo(() => {
    switch (feedbackState.tone) {
      case 'success':
        return <CheckCircleFilled className="feedback-card__status-icon" />;
      case 'warning':
        return <ExclamationCircleFilled className="feedback-card__status-icon" />;
      case 'error':
        return <CloseCircleFilled className="feedback-card__status-icon" />;
      case 'processing':
        return <LoadingOutlined className="feedback-card__status-icon" />;
      default:
        return <PrinterOutlined className="feedback-card__status-icon" />;
    }
  }, [feedbackState.tone]);

  const feedbackCardClassName = useMemo(() => {
    const toneClass =
      feedbackState.tone === 'success'
        ? 'feedback-card--success'
        : feedbackState.tone === 'warning'
          ? 'feedback-card--warning'
          : feedbackState.tone === 'error'
            ? 'feedback-card--error'
            : feedbackState.tone === 'processing'
              ? 'feedback-card--processing'
              : 'feedback-card--idle';

    return `feedback-card ${toneClass}`;
  }, [feedbackState.tone]);

  const printLabelClassName = useMemo(() => {
    switch (feedbackState.printState) {
      case 'printed':
        return 'feedback-card__value feedback-card__value--printed';
      case 'warning':
        return 'feedback-card__value feedback-card__value--warning';
      case 'error':
        return 'feedback-card__value feedback-card__value--error';
      default:
        return 'feedback-card__value feedback-card__value--pending';
    }
  }, [feedbackState.printState]);

  const records = recentRecords.slice(0, 3);
  const lastRecord = recentRecords[0] ?? feedbackRecord;
  const lastCheckinTime = lastRecord ? dayjs(lastRecord.checkin_time).format('HH:mm:ss') : '暂无记录';
  const printSummary = stats ? `${stats.badges_printed} / ${stats.checked_in || 0}` : '0 / 0';

  return (
    <section className="checkin-layout" onClick={handleFocusInput}>
      <div className="checkin-column checkin-column--primary">
        <div className="scanner-card">
          <div className="scanner-card__meta">SCAN_READY_v2.4</div>
          <div className="scanner-card__content">
            <div className="scanner-card__input-wrap">
              <div className="scan-line" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => handleSearchChange(event.target.value)}
                onPressEnter={() => {
                  void handleEnterSearch();
                }}
                placeholder="输入签到码、手机号或姓名"
                className="scanner-card__input"
              />
              <div className="scanner-card__hotkey">
                <kbd>ENTER</kbd>
              </div>
            </div>

            {searchLoading ? (
              <div className="scanner-card__state">
                <Spin />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="scanner-card__results">
                {searchResults.slice(0, 5).map((attendee) => {
                  const isActive = selectedAttendee?.id === attendee.id;
                  const isProcessing = processingAttendeeId === attendee.id;
                  return (
                    <button
                      key={attendee.id}
                      type="button"
                      className={`scanner-result ${isActive ? 'scanner-result--active' : ''}`}
                      disabled={checkinLoading || processingAttendeeId !== null}
                      onClick={(event) => {
                        event.stopPropagation();
                        void processAttendee(attendee, 'search');
                      }}
                    >
                      <span className="scanner-result__name">
                        {attendee.name}
                        {attendee.checked_in ? (
                          <span className="scanner-result__tag scanner-result__tag--checked-in">已签到</span>
                        ) : null}
                        {isProcessing ? (
                          <span className="scanner-result__tag scanner-result__tag--processing">处理中</span>
                        ) : null}
                      </span>
                      <span className="scanner-result__meta">
                        {getDisplayRole(attendee)} / {getDisplayOrg(attendee)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : query.trim() ? (
              <div className="scanner-card__state scanner-card__state--muted">未找到匹配结果</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="checkin-column checkin-column--secondary">
        <div className={feedbackCardClassName}>
          <div className="feedback-card__header">
            <div>
              <h3 className="feedback-card__title">{feedbackState.title}</h3>
              <p className="feedback-card__token">
                TOKEN: #{feedbackAttendee?.checkin_code || currentMeeting?.checkin_code || 'PENDING'}
              </p>
            </div>
            {feedbackIcon}
          </div>

          <div className="feedback-card__profile">
            <div className="feedback-card__avatar">
              {feedbackAttendee ? feedbackAttendee.name.slice(0, 1) : '验'}
            </div>
            <div>
              <div className="feedback-card__name">{feedbackAttendee?.name || '等待识别结果'}</div>
              <div className="feedback-card__role">
                {feedbackAttendee
                  ? `${getDisplayRole(feedbackAttendee)} | ${getDisplayOrg(feedbackAttendee)}`
                  : feedbackState.description}
              </div>
            </div>
          </div>

          {feedbackAttendee ? (
            <div className="feedback-card__description">{feedbackState.description}</div>
          ) : null}

          <div className="feedback-card__details">
            <div>
              <div className="feedback-card__label">通行等级</div>
              <div className="feedback-card__value">{feedbackState.badgeLabel}</div>
            </div>
            <div>
              <div className="feedback-card__label">打印状态</div>
              <div className={printLabelClassName}>{feedbackState.printLabel}</div>
            </div>
          </div>
        </div>

        <div className="progress-card">
          <div className="progress-card__summary">
            <div>
              <div className="progress-card__label">签到进度</div>
              <div className="progress-card__headline">
                {stats?.checked_in ?? 0}
                <span> / {stats?.total_attendees ?? 0}</span>
              </div>
            </div>
            <div className="progress-card__percent">{progressPercent}%</div>
          </div>

          <div className="progress-card__track">
            <div className="progress-card__fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="progress-card__meta">
            <div className="progress-card__meta-item">
              <ClockCircleOutlined />
              <span>最近签到: {lastCheckinTime}</span>
            </div>
            <div className="progress-card__meta-item">
              <SafetyCertificateFilled />
              <span>打印完成: {printSummary}</span>
            </div>
          </div>

          <div className="record-list">
            <div className="record-list__label">签到记录</div>
            <div className="record-list__items">
              {records.length > 0 ? (
                records.map((record, index) => (
                  <div key={record.id} className={`record-item ${index > 0 ? 'record-item--dim' : ''}`}>
                    <div className="record-item__main">
                      {getRecordIcon(index)}
                      <div className="record-item__copy">
                        <span className="record-item__name">{record.attendee_name || '未知嘉宾'}</span>
                        <span className="record-item__role">
                          {(record.attendee_position || 'attendee').toUpperCase()} /{' '}
                          {record.attendee_department || '参会嘉宾'}
                        </span>
                      </div>
                    </div>
                    <div className="record-item__time">
                      <span>{dayjs(record.checkin_time).format('HH:mm:ss')}</span>
                      <strong>{record.badge_printed ? 'PRINTED' : 'PENDING'}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="record-item record-item--empty">暂无签到记录</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
