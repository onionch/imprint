use tauri::State;
use crate::db::DbState;
use crate::db::repo_checkin;
use crate::db::models::*;
use crate::error::AppError;

fn get_conn<'a>(db: &'a State<'a, DbState>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    db.0.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))
}

#[tauri::command]
pub fn checkin(db: State<DbState>, attendee_id: i64, meeting_id: i64, checkin_method: Option<String>) -> Result<CheckinRecord, AppError> {
    let conn = get_conn(&db)?;
    let method = checkin_method.unwrap_or_else(|| "search".to_string());
    repo_checkin::checkin(&conn, attendee_id, meeting_id, &method)
}

#[tauri::command]
pub fn list_checkin_records(db: State<DbState>, meeting_id: i64, limit: Option<i64>, offset: Option<i64>) -> Result<Vec<CheckinRecord>, AppError> {
    let conn = get_conn(&db)?;
    repo_checkin::list_checkin_records(&conn, meeting_id, limit.unwrap_or(100), offset.unwrap_or(0))
}

#[tauri::command]
pub fn update_checkin_record(db: State<DbState>, id: i64, badge_printed: Option<bool>, badge_print_time: Option<String>) -> Result<(), AppError> {
    let conn = get_conn(&db)?;
    repo_checkin::update_checkin_record(&conn, id, badge_printed, badge_print_time)
}

#[tauri::command]
pub fn mark_badge_printed(db: State<DbState>, attendee_id: i64, meeting_id: i64, print_time: String) -> Result<(), AppError> {
    let conn = get_conn(&db)?;
    repo_checkin::mark_badge_printed(&conn, attendee_id, meeting_id, &print_time)
}

#[tauri::command]
pub fn get_meeting_stats(db: State<DbState>, meeting_id: i64) -> Result<MeetingStats, AppError> {
    let conn = get_conn(&db)?;
    repo_checkin::get_meeting_stats(&conn, meeting_id)
}
