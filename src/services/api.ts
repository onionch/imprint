import { invoke } from '@tauri-apps/api/core';
import type { Meeting, CreateMeetingRequest, UpdateMeetingRequest } from '@/types/meeting';
import type {
  Attendee,
  CreateAttendeeRequest,
  UpdateAttendeeRequest,
  ColumnMapping,
  AttendeeImportResult,
  ImportDuplicateStrategy,
} from '@/types/attendee';
import type { CheckinRecord, MeetingStats } from '@/types/checkin';
import type { BadgeTemplate, CreateBadgeTemplateRequest, UpdateBadgeTemplateRequest } from '@/types/template';
import type { PrinterInfo } from '@/types/printer';

// Meeting APIs
export const meetingApi = {
  list: () => invoke<Meeting[]>('list_meetings'),
  get: (id: number) => invoke<Meeting>('get_meeting', { id }),
  create: (req: CreateMeetingRequest) => invoke<Meeting>('create_meeting', { req }),
  update: (id: number, req: UpdateMeetingRequest) => invoke<Meeting>('update_meeting', { id, req }),
  delete: (id: number) => invoke<void>('delete_meeting', { id }),
};

// Attendee APIs
export const attendeeApi = {
  search: (meetingId: number, query: string) => invoke<Attendee[]>('search_attendees', { meetingId, query }),
  list: (meetingId: number, limit?: number, offset?: number) => invoke<Attendee[]>('list_attendees', { meetingId, limit, offset }),
  addOnsite: (req: CreateAttendeeRequest) => invoke<Attendee>('add_attendee_onsite', { req }),
  update: (id: number, req: UpdateAttendeeRequest) => invoke<Attendee>('update_attendee', { id, req }),
  delete: (id: number) => invoke<void>('delete_attendee', { id }),
  import: (meetingId: number, filePath: string, mapping: ColumnMapping, duplicateStrategy?: ImportDuplicateStrategy) =>
    invoke<AttendeeImportResult>(
      'import_attendees', { meetingId, filePath, mapping, duplicateStrategy }
    ),
};

// Checkin APIs
export const checkinApi = {
  checkin: (attendeeId: number, meetingId: number, checkinMethod?: string) =>
    invoke<CheckinRecord>('checkin', { attendeeId, meetingId, checkinMethod }),
  listRecords: (meetingId: number, limit?: number, offset?: number) =>
    invoke<CheckinRecord[]>('list_checkin_records', { meetingId, limit, offset }),
  updateRecord: (id: number, badgePrinted?: boolean, badgePrintTime?: string) =>
    invoke<void>('update_checkin_record', { id, badgePrinted, badgePrintTime }),
  markBadgePrinted: (attendeeId: number, meetingId: number, printTime: string) =>
    invoke<void>('mark_badge_printed', { attendeeId, meetingId, printTime }),
  getStats: (meetingId: number) => invoke<MeetingStats>('get_meeting_stats', { meetingId }),
};

// Badge Template APIs
export const badgeApi = {
  listTemplates: () => invoke<BadgeTemplate[]>('list_badge_templates'),
  getTemplate: (id: number) => invoke<BadgeTemplate>('get_badge_template', { id }),
  createTemplate: (req: CreateBadgeTemplateRequest) => invoke<BadgeTemplate>('create_badge_template', { req }),
  updateTemplate: (id: number, req: UpdateBadgeTemplateRequest) => invoke<BadgeTemplate>('update_badge_template', { id, req }),
  deleteTemplate: (id: number) => invoke<void>('delete_badge_template', { id }),
  renderHtml: (templateId: number, attendeeId: number, meetingId: number) =>
    invoke<string>('render_badge_html', { templateId, attendeeId, meetingId }),
  renderPreview: (templateJson: string) =>
    invoke<string>('render_badge_html_preview', { templateJson }),
};

// Print APIs
export const printApi = {
  listPrinters: () => invoke<PrinterInfo[]>('list_printers'),
  printBadge: (printerName: string, pngBase64: string, paperSize: string) =>
    invoke<void>('print_badge', { printerName, pngBase64, paperSize }),
  testPrint: (printerName: string) => invoke<void>('test_print', { printerName }),
};

// Import APIs
export const importApi = {
  readHeaders: (filePath: string) => invoke<string[]>('read_excel_headers', { filePath }),
};
