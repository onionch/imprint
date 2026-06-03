use tauri::State;
use crate::commands::lock_db;
use crate::db::DbState;
use crate::db::models::*;
use crate::db::repo_checkin;
use crate::error::AppError;

#[tauri::command]
pub fn checkin(db: State<DbState>, attendee_id: i64, meeting_id: i64, checkin_method: Option<String>) -> Result<CheckinRecord, AppError> {
    let conn = lock_db(&db)?;
    let method = checkin_method.unwrap_or_else(|| "search".to_string());
    repo_checkin::checkin(&conn, attendee_id, meeting_id, &method)
}

#[tauri::command]
pub fn list_checkin_records(db: State<DbState>, meeting_id: i64, limit: Option<i64>, offset: Option<i64>) -> Result<Vec<CheckinRecord>, AppError> {
    let conn = lock_db(&db)?;
    repo_checkin::list_checkin_records(&conn, meeting_id, limit.unwrap_or(100), offset.unwrap_or(0))
}

#[tauri::command]
pub fn update_checkin_record(db: State<DbState>, id: i64, badge_printed: Option<bool>, badge_print_time: Option<String>) -> Result<(), AppError> {
    let conn = lock_db(&db)?;
    repo_checkin::update_checkin_record(&conn, id, badge_printed, badge_print_time)
}

#[tauri::command]
pub fn mark_badge_printed(db: State<DbState>, attendee_id: i64, meeting_id: i64, print_time: String) -> Result<(), AppError> {
    let conn = lock_db(&db)?;
    repo_checkin::mark_badge_printed(&conn, attendee_id, meeting_id, &print_time)
}

#[tauri::command]
pub fn get_meeting_stats(db: State<DbState>, meeting_id: i64) -> Result<MeetingStats, AppError> {
    let conn = lock_db(&db)?;
    repo_checkin::get_meeting_stats(&conn, meeting_id)
}
