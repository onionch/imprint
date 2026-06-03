use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meeting {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub checkin_code: Option<String>,
    pub badge_template_id: Option<i64>,
    pub printer_name: Option<String>,
    pub paper_size: String,
    pub auto_print: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMeetingRequest {
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub checkin_code: Option<String>,
    pub badge_template_id: Option<i64>,
    pub printer_name: Option<String>,
    pub paper_size: Option<String>,
    pub auto_print: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMeetingRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub checkin_code: Option<String>,
    pub badge_template_id: Option<i64>,
    pub printer_name: Option<String>,
    pub paper_size: Option<String>,
    pub auto_print: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attendee {
    pub id: i64,
    pub meeting_id: i64,
    pub name: String,
    pub id_card: Option<String>,
    pub phone: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub email: Option<String>,
    pub checkin_code: Option<String>,
    pub source: String,
    pub import_batch_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checked_in: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAttendeeRequest {
    pub meeting_id: i64,
    pub name: String,
    pub id_card: Option<String>,
    pub phone: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub email: Option<String>,
    pub checkin_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAttendeeRequest {
    pub name: Option<String>,
    pub id_card: Option<String>,
    pub phone: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub email: Option<String>,
    pub checkin_code: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckinRecord {
    pub id: i64,
    pub attendee_id: i64,
    pub meeting_id: i64,
    pub checkin_time: String,
    pub checkin_method: String,
    pub badge_printed: bool,
    pub badge_print_time: Option<String>,
    pub badge_image_path: Option<String>,
    pub reprint_count: i64,
    pub notes: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendee_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendee_department: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendee_phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attendee_position: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkin_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckinRequest {
    pub attendee_id: i64,
    pub meeting_id: i64,
    pub checkin_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingStats {
    pub total_attendees: i64,
    pub checked_in: i64,
    pub not_checked_in: i64,
    pub badges_printed: i64,
    pub badges_not_printed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgeTemplate {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_builtin: bool,
    pub paper_size: String,
    pub width_mm: f64,
    pub height_mm: f64,
    pub template_json: String,
    pub thumbnail_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBadgeTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub paper_size: Option<String>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub template_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBadgeTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub paper_size: Option<String>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub template_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportBatch {
    pub id: i64,
    pub meeting_id: i64,
    pub file_name: Option<String>,
    pub row_count: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub error_details: Option<String>,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub skipped_count: i64,
    pub errors: Vec<ImportError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportError {
    pub row: i64,
    pub field: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMapping {
    pub name: Option<String>,
    pub id_card: Option<String>,
    pub phone: Option<String>,
    pub department: Option<String>,
    pub position: Option<String>,
    pub email: Option<String>,
    pub checkin_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportDuplicateStrategy {
    KeepAll,
    SkipDuplicates,
    OverwriteDuplicates,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
    pub is_network: bool,
    pub status: String,
}
