import { create } from 'zustand';
import type { Attendee } from '@/shared/types/attendee';
import type { CheckinRecord, MeetingStats } from '@/shared/types/checkin';
import { checkinApi, attendeeApi } from '@/shared/api';

interface CheckinState {
  searchResults: Attendee[];
  selectedAttendee: Attendee | null;
  recentRecords: CheckinRecord[];
  stats: MeetingStats | null;
  searchLoading: boolean;
  checkinLoading: boolean;
  search: (meetingId: number, query: string) => Promise<Attendee[]>;
  selectAttendee: (attendee: Attendee | null) => void;
  checkin: (attendeeId: number, meetingId: number, method?: string) => Promise<CheckinRecord>;
  loadStats: (meetingId: number) => Promise<void>;
  loadRecentRecords: (meetingId: number) => Promise<void>;
  clearSearch: () => void;
}

export const useCheckinStore = create<CheckinState>((set) => ({
  searchResults: [],
  selectedAttendee: null,
  recentRecords: [],
  stats: null,
  searchLoading: false,
  checkinLoading: false,

  search: async (meetingId, query) => {
    if (!query.trim()) {
      set({ searchResults: [], searchLoading: false });
      return [];
    }
    set({ searchLoading: true });
    try {
      const results = await attendeeApi.search(meetingId, query);
      set({ searchResults: results, searchLoading: false });
      return results;
    } catch {
      set({ searchResults: [], searchLoading: false });
      return [];
    }
  },

  selectAttendee: (attendee) => set({ selectedAttendee: attendee }),

  checkin: async (attendeeId, meetingId, method) => {
    set({ checkinLoading: true });
    try {
      const record = await checkinApi.checkin(attendeeId, meetingId, method);
      set({ checkinLoading: false, selectedAttendee: null, searchResults: [] });
      return record;
    } catch (e) {
      set({ checkinLoading: false });
      throw e;
    }
  },

  loadStats: async (meetingId) => {
    try {
      const stats = await checkinApi.getStats(meetingId);
      set({ stats });
    } catch { /* ignore */ }
  },

  loadRecentRecords: async (meetingId) => {
    try {
      const records = await checkinApi.listRecords(meetingId, 20, 0);
      set({ recentRecords: records });
    } catch { /* ignore */ }
  },

  clearSearch: () => set({ searchResults: [], selectedAttendee: null }),
}));
