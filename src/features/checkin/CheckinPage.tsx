import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Spin, message } from 'antd';
import type { InputRef } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CrownOutlined,
  SafetyCertificateFilled,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMeetingStore } from '@/features/meeting';
import type { Attendee } from '@/shared/types/attendee';
import { useCheckinStore } from './checkinStore';

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

export default function CheckinPage() {
  const { currentMeeting } = useMeetingStore();
  const {
    searchResults,
    selectedAttendee,
    recentRecords,
    stats,
    searchLoading,
    search,
    selectAttendee,
    loadStats,
    loadRecentRecords,
    clearSearch,
  } = useCheckinStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<InputRef>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!currentMeeting) {
      return;
    }

    void loadStats(currentMeeting.id);
    void loadRecentRecords(currentMeeting.id);
  }, [currentMeeting, loadRecentRecords, loadStats]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!currentMeeting || !value.trim()) {
        clearSearch();
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        void search(currentMeeting.id, value);
      }, 250);
    },
    [clearSearch, currentMeeting, search]
  );

  const feedbackAttendee = useMemo(() => {
    if (selectedAttendee) {
      return selectedAttendee;
    }

    return searchResults[0] || null;
  }, [searchResults, selectedAttendee]);

  const progressPercent = stats
    ? Math.min(100, Math.round((stats.checked_in / Math.max(stats.total_attendees, 1)) * 1000) / 10)
    : 0;

  const handleFocusInput = () => {
    inputRef.current?.focus();
  };

  const handleSelectResult = (attendee: Attendee) => {
    selectAttendee(attendee);
    message.success(`已选中 ${attendee.name}`);
  };

  const records = recentRecords.slice(0, 3);

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
                onChange={(event) => handleSearch(event.target.value)}
                onPressEnter={() => {
                  if (searchResults[0]) {
                    handleSelectResult(searchResults[0]);
                  }
                }}
                placeholder="输入签到码..."
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
                {searchResults.slice(0, 5).map((attendee) => (
                  <button
                    key={attendee.id}
                    type="button"
                    className={`scanner-result ${
                      selectedAttendee?.id === attendee.id ? 'scanner-result--active' : ''
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSelectResult(attendee);
                    }}
                  >
                    <span className="scanner-result__name">{attendee.name}</span>
                    <span className="scanner-result__meta">
                      {getDisplayRole(attendee)} / {getDisplayOrg(attendee)}
                    </span>
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="scanner-card__state scanner-card__state--muted">
                未找到匹配结果
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="checkin-column checkin-column--secondary">
        <div className="feedback-card">
          <div className="feedback-card__header">
            <div>
              <h3 className="feedback-card__title">验证成功</h3>
              <p className="feedback-card__token">
                TOKEN: #{feedbackAttendee?.checkin_code || currentMeeting?.checkin_code || 'PX-9821-AW'}
              </p>
            </div>
            <CheckCircleFilled className="feedback-card__status-icon" />
          </div>

          <div className="feedback-card__profile">
            <div className="feedback-card__avatar">
              {feedbackAttendee ? feedbackAttendee.name.slice(0, 1) : '嘉'}
            </div>
            <div>
              <div className="feedback-card__name">
                {feedbackAttendee?.name || '等待识别结果'}
              </div>
              <div className="feedback-card__role">
                {feedbackAttendee
                  ? `${getDisplayRole(feedbackAttendee)} | ${getDisplayOrg(feedbackAttendee)}`
                  : '请在左侧输入签到码'}
              </div>
            </div>
          </div>

          <div className="feedback-card__details">
            <div>
              <div className="feedback-card__label">通行等级</div>
              <div className="feedback-card__value">
                {feedbackAttendee ? getBadgeLevel(feedbackAttendee) : '待识别'}
              </div>
            </div>
            <div>
              <div className="feedback-card__label">打印状态</div>
              <div className="feedback-card__value">已打印</div>
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
              <span>上次: 2s 前</span>
            </div>
            <div className="progress-card__meta-item">
              <SafetyCertificateFilled />
              <span>速度: 12 人/分</span>
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
                          {(record.attendee_position || 'ATTENDEE').toUpperCase()} /{' '}
                          {record.attendee_department || '参会嘉宾'}
                        </span>
                      </div>
                    </div>
                    <div className="record-item__time">
                      <span>{dayjs(record.checkin_time).format('HH:mm:ss')}</span>
                      <strong>SUCCESS</strong>
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
