use rusqlite::{params, Connection};
use crate::db::models::*;
use crate::error::AppError;

pub fn list_meetings(conn: &Connection) -> Result<Vec<Meeting>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, location, start_time, end_time, checkin_code, badge_template_id, printer_name, paper_size, auto_print, status, created_at, updated_at FROM meetings ORDER BY created_at DESC"
    )?;
    let meetings = stmt.query_map([], |row| {
        Ok(Meeting {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            location: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
            checkin_code: row.get(6)?,
            badge_template_id: row.get(7)?,
            printer_name: row.get(8)?,
            paper_size: row.get(9)?,
            auto_print: row.get::<_, i32>(10)? != 0,
            status: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    })?;
    meetings.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

pub fn get_meeting(conn: &Connection, id: i64) -> Result<Meeting, AppError> {
    conn.query_row(
        "SELECT id, title, description, location, start_time, end_time, checkin_code, badge_template_id, printer_name, paper_size, auto_print, status, created_at, updated_at FROM meetings WHERE id = ?1",
        [id],
        |row| {
            Ok(Meeting {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                location: row.get(3)?,
                start_time: row.get(4)?,
                end_time: row.get(5)?,
                checkin_code: row.get(6)?,
                badge_template_id: row.get(7)?,
                printer_name: row.get(8)?,
                paper_size: row.get(9)?,
                auto_print: row.get::<_, i32>(10)? != 0,
                status: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        },
    ).map_err(|e| AppError::NotFound(format!("会议不存在: {}", e)))
}

pub fn create_meeting(conn: &Connection, req: &CreateMeetingRequest) -> Result<Meeting, AppError> {
    let paper_size = req.paper_size.as_deref().unwrap_or("CR80");
    let auto_print = req.auto_print.unwrap_or(true) as i32;
    conn.execute(
        "INSERT INTO meetings (title, description, location, start_time, end_time, checkin_code, badge_template_id, printer_name, paper_size, auto_print) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![req.title, req.description, req.location, req.start_time, req.end_time, req.checkin_code, req.badge_template_id, req.printer_name, paper_size, auto_print],
    )?;
    let id = conn.last_insert_rowid();
    get_meeting(conn, id)
}

pub fn update_meeting(conn: &Connection, id: i64, req: &UpdateMeetingRequest) -> Result<Meeting, AppError> {
    let existing = get_meeting(conn, id)?;
    let title = req.title.as_deref().unwrap_or(&existing.title);
    let description = req.description.as_deref().or_else(|| existing.description.as_deref());
    let location = req.location.as_deref().or_else(|| existing.location.as_deref());
    let start_time = req.start_time.as_deref().unwrap_or(&existing.start_time);
    let end_time = req.end_time.as_deref().unwrap_or(&existing.end_time);
    let checkin_code = req.checkin_code.as_deref().or_else(|| existing.checkin_code.as_deref());
    let badge_template_id = req.badge_template_id.or(existing.badge_template_id);
    let printer_name = req.printer_name.as_deref().or_else(|| existing.printer_name.as_deref());
    let paper_size = req.paper_size.as_deref().unwrap_or(&existing.paper_size);
    let auto_print = req.auto_print.unwrap_or(existing.auto_print) as i32;
    let status = req.status.as_deref().unwrap_or(&existing.status);

    conn.execute(
        "UPDATE meetings SET title=?1, description=?2, location=?3, start_time=?4, end_time=?5, checkin_code=?6, badge_template_id=?7, printer_name=?8, paper_size=?9, auto_print=?10, status=?11, updated_at=datetime('now') WHERE id=?12",
        params![title, description, location, start_time, end_time, checkin_code, badge_template_id, printer_name, paper_size, auto_print, status, id],
    )?;
    get_meeting(conn, id)
}

pub fn delete_meeting(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM meetings WHERE id = ?1", [id])?;
    Ok(())
}