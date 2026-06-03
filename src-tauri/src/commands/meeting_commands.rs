use tauri::State;
use crate::db::DbState;
use crate::db::repo_meeting;
use crate::db::models::*;
use crate::error::AppError;

fn get_conn<'a>(db: &'a State<'a, DbState>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    db.0.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))
}

#[tauri::command]
pub fn list_meetings(db: State<DbState>) -> Result<Vec<Meeting>, AppError> {
    let conn = get_conn(&db)?;
    repo_meeting::list_meetings(&conn)
}

#[tauri::command]
pub fn get_meeting(db: State<DbState>, id: i64) -> Result<Meeting, AppError> {
    let conn = get_conn(&db)?;
    repo_meeting::get_meeting(&conn, id)
}

#[tauri::command]
pub fn create_meeting(db: State<DbState>, req: CreateMeetingRequest) -> Result<Meeting, AppError> {
    let conn = get_conn(&db)?;
    repo_meeting::create_meeting(&conn, &req)
}

#[tauri::command]
pub fn update_meeting(db: State<DbState>, id: i64, req: UpdateMeetingRequest) -> Result<Meeting, AppError> {
    let conn = get_conn(&db)?;
    repo_meeting::update_meeting(&conn, id, &req)
}

#[tauri::command]
pub fn delete_meeting(db: State<DbState>, id: i64) -> Result<(), AppError> {
    let conn = get_conn(&db)?;
    repo_meeting::delete_meeting(&conn, id)
}