use rusqlite::{params, Connection};
use crate::db::models::*;
use crate::error::AppError;

pub fn checkin(conn: &Connection, attendee_id: i64, meeting_id: i64, method: &str) -> Result<CheckinRecord, AppError> {
    let exists: i32 = conn.query_row(
        "SELECT COUNT(*) FROM checkin_records WHERE attendee_id = ?1 AND meeting_id = ?2",
        params![attendee_id, meeting_id],
        |row| row.get(0),
    )?;
    if exists > 0 {
        return Err(AppError::Validation("该参会者已签到".to_string()));
    }

    conn.execute(
        "INSERT INTO checkin_records (attendee_id, meeting_id, checkin_method) VALUES (?1, ?2, ?3)",
        params![attendee_id, meeting_id, method],
    )?;
    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT cr.id, cr.attendee_id, cr.meeting_id, cr.checkin_time, cr.checkin_method, cr.badge_printed, cr.badge_print_time, cr.badge_image_path, cr.reprint_count, cr.notes, cr.created_at, a.name, a.department, a.phone, a.position, a.checkin_code FROM checkin_records cr JOIN attendees a ON cr.attendee_id = a.id WHERE cr.id = ?1",
        [id],
        |row| {
            Ok(CheckinRecord {
                id: row.get(0)?,
                attendee_id: row.get(1)?,
                meeting_id: row.get(2)?,
                checkin_time: row.get(3)?,
                checkin_method: row.get(4)?,
                badge_printed: row.get::<_, i32>(5)? != 0,
                badge_print_time: row.get(6)?,
                badge_image_path: row.get(7)?,
                reprint_count: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
                attendee_name: row.get(11)?,
                attendee_department: row.get(12)?,
                attendee_phone: row.get(13)?,
                attendee_position: row.get(14)?,
                checkin_code: row.get(15)?,
            })
        },
    ).map_err(AppError::Database)
}

pub fn list_checkin_records(conn: &Connection, meeting_id: i64, limit: i64, offset: i64) -> Result<Vec<CheckinRecord>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT cr.id, cr.attendee_id, cr.meeting_id, cr.checkin_time, cr.checkin_method, cr.badge_printed, cr.badge_print_time, cr.badge_image_path, cr.reprint_count, cr.notes, cr.created_at, a.name, a.department, a.phone, a.position, a.checkin_code FROM checkin_records cr JOIN attendees a ON cr.attendee_id = a.id WHERE cr.meeting_id = ?1 ORDER BY cr.checkin_time DESC LIMIT ?2 OFFSET ?3"
    )?;
    let records = stmt.query_map(params![meeting_id, limit, offset], |row| {
        Ok(CheckinRecord {
            id: row.get(0)?,
            attendee_id: row.get(1)?,
            meeting_id: row.get(2)?,
            checkin_time: row.get(3)?,
            checkin_method: row.get(4)?,
            badge_printed: row.get::<_, i32>(5)? != 0,
            badge_print_time: row.get(6)?,
            badge_image_path: row.get(7)?,
            reprint_count: row.get(8)?,
            notes: row.get(9)?,
            created_at: row.get(10)?,
            attendee_name: row.get(11)?,
            attendee_department: row.get(12)?,
            attendee_phone: row.get(13)?,
            attendee_position: row.get(14)?,
            checkin_code: row.get(15)?,
        })
    })?;
    records.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

pub fn update_checkin_record(conn: &Connection, id: i64, badge_printed: Option<bool>, badge_print_time: Option<String>) -> Result<(), AppError> {
    if let Some(printed) = badge_printed {
        conn.execute(
            "UPDATE checkin_records SET badge_printed = ?1, badge_print_time = ?2, reprint_count = reprint_count + 1 WHERE id = ?3",
            params![printed as i32, badge_print_time, id],
        )?;
    }
    Ok(())
}

/// Mark badge as printed by attendee_id + meeting_id (for print flow)
pub fn mark_badge_printed(conn: &Connection, attendee_id: i64, meeting_id: i64, print_time: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE checkin_records SET badge_printed = 1, badge_print_time = ?1, reprint_count = reprint_count + 1 WHERE attendee_id = ?2 AND meeting_id = ?3",
        params![print_time, attendee_id, meeting_id],
    )?;
    Ok(())
}

pub fn get_meeting_stats(conn: &Connection, meeting_id: i64) -> Result<MeetingStats, AppError> {
    let total_attendees: i64 = conn.query_row(
        "SELECT COUNT(*) FROM attendees WHERE meeting_id = ?1",
        [meeting_id],
        |row| row.get(0),
    )?;
    let checked_in: i64 = conn.query_row(
        "SELECT COUNT(*) FROM checkin_records WHERE meeting_id = ?1",
        [meeting_id],
        |row| row.get(0),
    )?;
    let badges_printed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM checkin_records WHERE meeting_id = ?1 AND badge_printed = 1",
        [meeting_id],
        |row| row.get(0),
    )?;

    Ok(MeetingStats {
        total_attendees,
        checked_in,
        not_checked_in: total_attendees - checked_in,
        badges_printed,
        badges_not_printed: checked_in - badges_printed,
    })
}