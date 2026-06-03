use tauri::State;
use crate::commands::lock_db;
use crate::db::DbState;
use crate::db::models::*;
use crate::db::repo_meeting;
use crate::error::AppError;

#[tauri::command]
pub fn list_meetings(db: State<DbState>) -> Result<Vec<Meeting>, AppError> {
    let conn = lock_db(&db)?;
    repo_meeting::list_meetings(&conn)
}

#[tauri::command]
pub fn get_meeting(db: State<DbState>, id: i64) -> Result<Meeting, AppError> {
    let conn = lock_db(&db)?;
    repo_meeting::get_meeting(&conn, id)
}

#[tauri::command]
pub fn create_meeting(db: State<DbState>, req: CreateMeetingRequest) -> Result<Meeting, AppError> {
    let conn = lock_db(&db)?;
    repo_meeting::create_meeting(&conn, &req)
}

#[tauri::command]
pub fn update_meeting(db: State<DbState>, id: i64, req: UpdateMeetingRequest) -> Result<Meeting, AppError> {
    let conn = lock_db(&db)?;
    repo_meeting::update_meeting(&conn, id, &req)
}

#[tauri::command]
pub fn delete_meeting(db: State<DbState>, id: i64) -> Result<(), AppError> {
    let conn = lock_db(&db)?;
    repo_meeting::delete_meeting(&conn, id)
}
