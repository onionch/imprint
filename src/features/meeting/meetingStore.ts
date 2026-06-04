import { create } from 'zustand';
import type { Meeting } from '@/shared/types/meeting';
import { meetingApi } from '@/shared/api';

const MEETING_STORAGE_KEY = 'checkin-tauri/current-meeting-id';

function readStoredMeetingId(): number | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(MEETING_STORAGE_KEY);
  if (stored) {
    const id = Number(stored);
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

interface MeetingState {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  loading: boolean;
  error: string | null;
  loadMeetings: () => Promise<void>;
  selectMeeting: (meeting: Meeting | null) => void;
  createMeeting: (req: Parameters<typeof meetingApi.create>[0]) => Promise<Meeting>;
  updateMeeting: (id: number, req: Parameters<typeof meetingApi.update>[1]) => Promise<Meeting>;
  deleteMeeting: (id: number) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  loading: false,
  error: null,

  loadMeetings: async () => {
    set({ loading: true, error: null });
    try {
      const meetings = await meetingApi.list();
      set({ meetings, loading: false });
      if (!get().currentMeeting && meetings.length > 0) {
        const storedId = readStoredMeetingId();
        const target = storedId ? meetings.find((m) => m.id === storedId) : null;
        set({ currentMeeting: target || meetings[0] });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  selectMeeting: (meeting) => {
    set({ currentMeeting: meeting });
    if (meeting) {
      window.localStorage.setItem(MEETING_STORAGE_KEY, String(meeting.id));
    } else {
      window.localStorage.removeItem(MEETING_STORAGE_KEY);
    }
  },

  createMeeting: async (req) => {
    const meeting = await meetingApi.create(req);
    set((s) => ({ meetings: [meeting, ...s.meetings] }));
    return meeting;
  },

  updateMeeting: async (id, req) => {
    const meeting = await meetingApi.update(id, req);
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === id ? meeting : m)),
      currentMeeting: s.currentMeeting?.id === id ? meeting : s.currentMeeting,
    }));
    return meeting;
  },

  deleteMeeting: async (id) => {
    await meetingApi.delete(id);
    set((s) => {
      const meetings = s.meetings.filter((m) => m.id !== id);
      return {
        meetings,
        currentMeeting: s.currentMeeting?.id === id ? meetings[0] || null : s.currentMeeting,
      };
    });
  },
}));
