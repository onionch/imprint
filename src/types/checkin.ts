export interface CheckinRecord {
  id: number;
  attendee_id: number;
  meeting_id: number;
  checkin_time: string;
  checkin_method: string;
  badge_printed: boolean;
  badge_print_time?: string;
  badge_image_path?: string;
  reprint_count: number;
  notes?: string;
  created_at: string;
  attendee_name?: string;
  attendee_department?: string;
  attendee_phone?: string;
  attendee_position?: string;
  checkin_code?: string;
}

export interface MeetingStats {
  total_attendees: number;
  checked_in: number;
  not_checked_in: number;
  badges_printed: number;
  badges_not_printed: number;
}