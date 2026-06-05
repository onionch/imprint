import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Button, Input } from 'antd';
import {
  ApartmentOutlined,
  BarChartOutlined,
  BorderOutlined,
  CloseOutlined,
  DownOutlined,
  FullscreenExitOutlined,
  LineOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { CheckinPage } from '@/features/checkin';
import { CreateMeetingPage, useMeetingStore } from '@/features/meeting';
import { KanbanPage } from '@/features/kanban';
import { SystemSettingsPage } from '@/features/settings';
import { windowApi } from '@/shared/api';

type ShellView = 'checkin' | 'create-meeting' | 'kanban' | 'settings';
const WINDOW_DRAG_THRESHOLD = 4;

function formatSystemTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatMeetingDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function getMeetingStatusText(status: string) {
  switch (status) {
    case 'active':
      return 'NOW';
    case 'completed':
      return 'ENDED';
    default:
      return 'DRAFT';
  }
}

function EventSwitchModal({
  open,
  searchValue,
  onSearchChange,
  onClose,
  onCreateNew,
  onSelectMeeting,
  meetings,
  currentMeetingId,
}: {
  open: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onCreateNew: () => void;
  onSelectMeeting: (meetingId: number) => void;
  meetings: Array<{
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    location?: string;
    status: string;
  }>;
  currentMeetingId?: number;
}) {
  const filteredMeetings = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return meetings;
    }

    return meetings.filter((meeting) =>
      [meeting.title, meeting.location || '', meeting.status]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [meetings, searchValue]);

  const currentMeeting =
    meetings.find((meeting) => meeting.id === currentMeetingId) || meetings[0] || null;

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="event-switch-backdrop"
        aria-label="关闭活动切换弹窗"
        onClick={onClose}
      />
      <div className="event-switch-layer" role="dialog" aria-modal="true" aria-label="切换活动">
        <section className="event-switch-modal">
          <div className="event-switch-modal__header">
            <div>
              <p className="event-switch-modal__eyebrow">CURRENT SCOPE</p>
              <h2 className="event-switch-modal__title">
                {currentMeeting?.title || '请选择活动'}
              </h2>
            </div>
            <button
              type="button"
              className="event-switch-modal__close"
              aria-label="关闭"
              onClick={onClose}
            >
              <CloseOutlined />
            </button>
          </div>

          <div className="event-switch-modal__search">
            <SearchOutlined className="event-switch-modal__search-icon" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="快速查找历史活动或关键词..."
              className="event-switch-modal__search-input"
            />
          </div>

          <div className="event-switch-modal__list">
            {filteredMeetings.map((meeting) => {
              const active = meeting.id === currentMeetingId;
              const ended = meeting.status === 'completed';
              return (
                <button
                  key={meeting.id}
                  type="button"
                  className={`event-switch-item ${active ? 'event-switch-item--active' : ''}`}
                  onClick={() => onSelectMeeting(meeting.id)}
                >
                  <div className="event-switch-item__main">
                    <div className="event-switch-item__head">
                      <span className="event-switch-item__name">{meeting.title}</span>
                      {active ? (
                        <span className="event-switch-item__tag">{getMeetingStatusText(meeting.status)}</span>
                      ) : null}
                    </div>
                    <span className="event-switch-item__date">
                      {formatMeetingDate(meeting.start_time)}
                    </span>
                  </div>
                  <div className="event-switch-item__meta">
                    <p className={`event-switch-item__percent ${ended ? 'is-muted' : ''}`}>
                      {meeting.status === 'completed' ? '100%' : active ? '84%' : '92%'}
                    </p>
                    <div className="event-switch-item__track">
                      <div
                        className={`event-switch-item__fill ${ended ? 'is-muted' : ''}`}
                        style={{ width: meeting.status === 'completed' ? '100%' : active ? '84%' : '92%' }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="event-switch-modal__footer">
            <button type="button" className="event-switch-modal__primary" onClick={onCreateNew}>
              <PlusOutlined />
              <span>创建新活动</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export default function AppShell() {
  const [view, setView] = useState<ShellView>('checkin');
  const [systemTime, setSystemTime] = useState(() => formatSystemTime(new Date()));
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchQuery, setSwitchQuery] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const { currentMeeting, meetings, loadMeetings, selectMeeting } = useMeetingStore();

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSystemTime(formatSystemTime(new Date()));
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await windowApi.isMaximized();
      setIsMaximized(maximized);
    };

    void checkMaximized();

    const handleResize = () => {
      void checkMaximized();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => () => dragCleanupRef.current?.(), []);

  const hasMeetings = meetings.length > 0;
  const showEmpty = !hasMeetings && view !== 'create-meeting';
  const liveTitle = currentMeeting?.title || meetings[0]?.title || '系统待机';

  const handleOpenCreate = () => {
    setSwitchOpen(false);
    setSwitchQuery('');
    setView('create-meeting');
  };

  const handleMinimize = () => {
    void windowApi.minimize().catch(() => undefined);
  };

  const handleToggleMaximize = async () => {
    await windowApi.toggleMaximize();
    const maximized = await windowApi.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    void windowApi.close().catch(() => undefined);
  };

  const handleSelectMeeting = (meetingId: number) => {
    const target = meetings.find((meeting) => meeting.id === meetingId);
    if (!target) {
      return;
    }
    selectMeeting(target);
    setSwitchOpen(false);
    setSwitchQuery('');
  };

  const handleWindowDragStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1) {
      return;
    }

    dragCleanupRef.current?.();

    const startX = event.clientX;
    const startY = event.clientY;

    const cleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dragCleanupRef.current = null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      if (Math.max(deltaX, deltaY) < WINDOW_DRAG_THRESHOLD) {
        return;
      }

      cleanup();
      void windowApi.startDragging().catch(() => undefined);
    };

    const handleMouseUp = () => {
      cleanup();
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleWindowDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    void handleToggleMaximize().catch(() => undefined);
  };

  return (
    <div className="app-shell">
      <div className="window-chrome">
        <div
          className="window-chrome__drag"
          data-tauri-drag-region
          onMouseDown={handleWindowDragStart}
          onDoubleClick={handleWindowDoubleClick}
        >
          <span className="window-chrome__brand-mark" aria-hidden="true" />
          <div className="window-chrome__brand-copy">
            <span className="window-chrome__title">Imprint</span>
            <span className="window-chrome__subtitle">会务签到</span>
          </div>
        </div>
        <div className="window-chrome__actions">
          <button
            type="button"
            className="window-chrome__action"
            aria-label="最小化"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              handleMinimize();
            }}
          >
            <LineOutlined />
          </button>
          <button
            type="button"
            className="window-chrome__action"
            aria-label="最大化或还原"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              handleToggleMaximize();
            }}
          >
            {isMaximized ? <FullscreenExitOutlined /> : <BorderOutlined />}
          </button>
          <button
            type="button"
            className="window-chrome__action window-chrome__action--danger"
            aria-label="关闭"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              handleClose();
            }}
          >
            <CloseOutlined />
          </button>
        </div>
      </div>
      <main className={`app-shell__main ${switchOpen ? 'app-shell__main--modal' : ''} ${showEmpty ? 'app-shell__main--empty' : ''}`}>
        <header className={`topbar ${showEmpty ? 'topbar--empty' : ''}`}>
          <div className={`topbar__left ${showEmpty ? 'topbar__left--empty' : ''}`}>
            {showEmpty ? (
              <>
                <span className="topbar__status-dot topbar__status-dot--neutral" />
                <span className="topbar__status-text">LIVE: 系统待机</span>
              </>
            ) : (
              <div className="topbar__live">
                <span className="topbar__indicator-dot" />
                <span className="topbar__live-text">LIVE: {liveTitle}</span>
                <button
                  type="button"
                  className="topbar__switcher"
                  onClick={() => setSwitchOpen(true)}
                >
                  <span className="topbar__switcher-text">切换 / 新建</span>
                  <DownOutlined className="topbar__switcher-icon" />
                </button>
              </div>
            )}
          </div>

          <div className="topbar__right">
            <div className="topbar__status-group">
              <div className="topbar__status-item">
                <span className="topbar__status-dot topbar__status-dot--success" />
                <span className="topbar__status-text">打印机: 正常</span>
              </div>
              <div className="topbar__status-item">
                <span className="topbar__status-dot topbar__status-dot--success" />
                <span className="topbar__status-text">网络: 在线</span>
              </div>
            </div>
            <Button
              type="text"
              icon={<BarChartOutlined />}
              className="topbar__action"
              aria-label="活动看板"
              onClick={() => setView('kanban')}
            />
            <Button
              type="text"
              icon={<SettingOutlined />}
              className="topbar__action"
              aria-label="设置"
              onClick={() => setView('settings')}
            />
          </div>
        </header>

        {showEmpty ? (
          <>
            <div className="empty-state">
              <div className="empty-state__backdrop" aria-hidden="true">
                <div className="empty-state__glow" />
              </div>

              <section className="empty-state__panel">
                <div className="empty-state__icon-shell">
                  <ApartmentOutlined className="empty-state__icon" />
                  <div className="empty-state__grid" aria-hidden="true" />
                </div>

                <h1 className="empty-state__title">暂无进行中的活动</h1>
                <p className="empty-state__text">
                  由于这是首次启动或所有活动已结束，请先创建一个活动以开始签到工作。
                </p>

                <div className="empty-state__actions">
                  <button
                    type="button"
                    className="empty-state__primary"
                    onClick={handleOpenCreate}
                  >
                    <PlusOutlined />
                    <span>创建新活动</span>
                  </button>
                </div>
              </section>
            </div>

            <footer className="standby-footer">
              <div className="standby-footer__left">
                <div className="standby-footer__hint">
                  <kbd className="standby-footer__key">N</kbd>
                  <span className="standby-footer__text">新建活动</span>
                </div>
                <div className="standby-footer__hint">
                  <kbd className="standby-footer__key">I</kbd>
                  <span className="standby-footer__text">导入配置</span>
                </div>
              </div>
              <div className="standby-footer__right">Standby Mode</div>
            </footer>
          </>
        ) : (
          <>
            <div className="workspace">
              <div className="workspace__inner">
                {view === 'create-meeting' ? (
                  <CreateMeetingPage
                    onCancel={() => setView('checkin')}
                    onCreated={() => setView('checkin')}
                  />
                ) : view === 'kanban' ? (
                  <KanbanPage onBack={() => setView('checkin')} />
                ) : view === 'settings' ? (
                  <SystemSettingsPage onBack={() => setView('checkin')} />
                ) : (
                  <CheckinPage />
                )}
              </div>
            </div>

            <footer className="system-footer">
              <div className="system-footer__left">
                <div className="system-footer__hint">
                  <kbd className="system-footer__key">F5</kbd>
                  <span className="system-footer__text">重印上张</span>
                </div>
                <div className="system-footer__hint">
                  <kbd className="system-footer__key">ESC</kbd>
                  <span className="system-footer__text">清除输入</span>
                </div>
              </div>
              <div className="system-footer__right">SYSTEM READY: {systemTime}</div>
            </footer>
          </>
        )}
      </main>

      <EventSwitchModal
        open={switchOpen}
        searchValue={switchQuery}
        onSearchChange={setSwitchQuery}
        onClose={() => {
          setSwitchOpen(false);
          setSwitchQuery('');
        }}
        onCreateNew={handleOpenCreate}
        onSelectMeeting={handleSelectMeeting}
        meetings={meetings}
        currentMeetingId={currentMeeting?.id}
      />
    </div>
  );
}
