import { create } from 'zustand';
import type { Meeting } from '@/types/meeting';
import { meetingApi } from '@/services/api';

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
        set({ currentMeeting: meetings[0] });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  selectMeeting: (meeting) => set({ currentMeeting: meeting }),

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
