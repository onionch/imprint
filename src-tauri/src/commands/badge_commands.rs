use tauri::State;
use crate::commands::lock_db;
use crate::db::DbState;
use crate::db::repo_meeting;
use crate::db::repo_template;
use crate::db::models::*;
use crate::error::AppError;

#[tauri::command]
pub fn list_badge_templates(db: State<DbState>) -> Result<Vec<BadgeTemplate>, AppError> {
    let conn = lock_db(&db)?;
    repo_template::list_badge_templates(&conn)
}

#[tauri::command]
pub fn get_badge_template(db: State<DbState>, id: i64) -> Result<BadgeTemplate, AppError> {
    let conn = lock_db(&db)?;
    repo_template::get_badge_template(&conn, id)
}

#[tauri::command]
pub fn create_badge_template(db: State<DbState>, req: CreateBadgeTemplateRequest) -> Result<BadgeTemplate, AppError> {
    let conn = lock_db(&db)?;
    repo_template::create_badge_template(&conn, &req)
}

#[tauri::command]
pub fn update_badge_template(db: State<DbState>, id: i64, req: UpdateBadgeTemplateRequest) -> Result<BadgeTemplate, AppError> {
    let conn = lock_db(&db)?;
    repo_template::update_badge_template(&conn, id, &req)
}

#[tauri::command]
pub fn delete_badge_template(db: State<DbState>, id: i64) -> Result<(), AppError> {
    let conn = lock_db(&db)?;
    repo_template::delete_badge_template(&conn, id)
}

#[tauri::command]
pub fn render_badge_html(
    db: State<DbState>,
    template_id: i64,
    attendee_id: i64,
    meeting_id: i64,
) -> Result<String, AppError> {
    let conn = lock_db(&db)?;

    let template = repo_template::get_badge_template(&conn, template_id)?;
    let attendee = conn.query_row(
        "SELECT name, id_card, phone, department, position, email, checkin_code FROM attendees WHERE id = ?1",
        [attendee_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        },
    ).map_err(AppError::Database)?;

    let meeting = repo_meeting::get_meeting(&conn, meeting_id)?;

    let qr_data = format!("BADGE:{}:{}:{}", meeting_id, attendee_id, chrono::Utc::now().timestamp());

    crate::badge::render_badge_html(
        &template.template_json,
        &meeting.title,
        meeting.location.as_deref().unwrap_or(""),
        &meeting.start_time,
        &attendee.0,
        attendee.3.as_deref().unwrap_or(""),
        attendee.4.as_deref().unwrap_or(""),
        &chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        attendee.6.as_deref().unwrap_or(""),
        &qr_data,
    )
}

#[tauri::command]
pub fn render_badge_html_preview(template_json: String) -> Result<String, AppError> {
    crate::badge::render_badge_html(
        &template_json,
        "2026年度工作会议",
        "北京国际会议中心",
        "2026-06-03",
        "张三",
        "技术研发部",
        "高级工程师",
        "2026-06-03 08:30:00",
        "A20260603001",
        "BADGE:1:1:1748937600",
    )
}
