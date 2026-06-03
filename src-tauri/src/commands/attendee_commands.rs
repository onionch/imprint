use tauri::State;
use crate::db::DbState;
use crate::db::repo_attendee;
use crate::db::models::*;
use crate::error::AppError;

fn get_conn<'a>(db: &'a State<'a, DbState>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, AppError> {
    db.0.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))
}

#[tauri::command]
pub fn search_attendees(db: State<DbState>, meeting_id: i64, query: String) -> Result<Vec<Attendee>, AppError> {
    let conn = get_conn(&db)?;
    repo_attendee::search_attendees(&conn, meeting_id, &query)
}

#[tauri::command]
pub fn list_attendees(db: State<DbState>, meeting_id: i64, limit: Option<i64>, offset: Option<i64>) -> Result<Vec<Attendee>, AppError> {
    let conn = get_conn(&db)?;
    repo_attendee::list_attendees(&conn, meeting_id, limit.unwrap_or(100), offset.unwrap_or(0))
}

#[tauri::command]
pub fn add_attendee_onsite(db: State<DbState>, req: CreateAttendeeRequest) -> Result<Attendee, AppError> {
    let conn = get_conn(&db)?;
    repo_attendee::add_attendee(&conn, &req)
}

#[tauri::command]
pub fn delete_attendee(db: State<DbState>, id: i64) -> Result<(), AppError> {
    let conn = get_conn(&db)?;
    repo_attendee::delete_attendee(&conn, id)
}

#[tauri::command]
pub fn import_attendees(
    db: State<DbState>,
    meeting_id: i64,
    file_path: String,
    mapping: ColumnMapping,
) -> Result<ImportResult, AppError> {
    let conn = get_conn(&db)?;

    // Read data from file
    let mut attendees = crate::import::read_data_with_mapping(&file_path, &mapping)?;

    // Set meeting_id for all attendees
    for att in attendees.iter_mut() {
        att.meeting_id = meeting_id;
    }

    let row_count = attendees.len() as i64;

    // Create import batch
    let batch_id = repo_attendee::create_import_batch(&conn, meeting_id, &file_path, row_count)?;

    // Import attendees
    let result = repo_attendee::import_attendees_batch(&conn, meeting_id, &attendees, batch_id)?;

    // Update batch record
    let error_json = if result.errors.is_empty() {
        String::new()
    } else {
        serde_json::to_string(&result.errors).unwrap_or_default()
    };
    repo_attendee::update_import_batch(&conn, batch_id, result.success_count, result.fail_count, &error_json)?;

    Ok(result)
}