export interface Meeting {
  id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  checkin_code?: string;
  badge_template_id?: number;
  printer_name?: string;
  paper_size: string;
  auto_print: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  checkin_code?: string;
  badge_template_id?: number;
  printer_name?: string;
  paper_size?: string;
  auto_print?: boolean;
}

export interface UpdateMeetingRequest {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  checkin_code?: string;
  badge_template_id?: number;
  printer_name?: string;
  paper_size?: string;
  auto_print?: boolean;
  status?: string;
}
