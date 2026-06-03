export interface Attendee {
  id: number;
  meeting_id: number;
  name: string;
  id_card?: string;
  phone?: string;
  department?: string;
  position?: string;
  email?: string;
  checkin_code?: string;
  source: string;
  import_batch_id?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  checked_in?: boolean;
}

export interface CreateAttendeeRequest {
  meeting_id: number;
  name: string;
  id_card?: string;
  phone?: string;
  department?: string;
  position?: string;
  email?: string;
  checkin_code?: string;
  notes?: string;
}

export interface UpdateAttendeeRequest {
  name?: string;
  id_card?: string;
  phone?: string;
  department?: string;
  position?: string;
  email?: string;
  checkin_code?: string;
  notes?: string;
}

export interface ColumnMapping {
  name?: string;
  id_card?: string;
  phone?: string;
  department?: string;
  position?: string;
  email?: string;
  checkin_code?: string;
}

export type ImportDuplicateStrategy = 'keep_all' | 'skip_duplicates' | 'overwrite_duplicates';

export interface AttendeeImportError {
  row: number;
  field: string;
  message: string;
}

export interface AttendeeImportResult {
  batch_id: number;
  success_count: number;
  fail_count: number;
  skipped_count: number;
  errors: AttendeeImportError[];
}
