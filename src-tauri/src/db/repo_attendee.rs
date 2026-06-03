use rusqlite::{params, Connection};
use crate::db::models::*;
use crate::error::AppError;

pub fn search_attendees(conn: &Connection, meeting_id: i64, query: &str) -> Result<Vec<Attendee>, AppError> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT a.id, a.meeting_id, a.name, a.id_card, a.phone, a.department, a.position, a.email, a.checkin_code, a.source, a.import_batch_id, a.notes, a.created_at, a.updated_at, CASE WHEN cr.id IS NOT NULL THEN 1 ELSE 0 END as checked_in FROM attendees a LEFT JOIN checkin_records cr ON a.id = cr.attendee_id AND a.meeting_id = cr.meeting_id WHERE a.meeting_id = ?1 AND (a.name LIKE ?2 OR a.id_card LIKE ?2 OR a.phone LIKE ?2 OR a.checkin_code LIKE ?2) ORDER BY CASE WHEN a.name = ?3 THEN 0 WHEN a.name LIKE ?4 THEN 1 ELSE 2 END, a.name LIMIT 20"
    )?;
    let attendees = stmt.query_map(params![meeting_id, pattern, query, format!("{}%", query)], |row| {
        Ok(Attendee {
            id: row.get(0)?,
            meeting_id: row.get(1)?,
            name: row.get(2)?,
            id_card: row.get(3)?,
            phone: row.get(4)?,
            department: row.get(5)?,
            position: row.get(6)?,
            email: row.get(7)?,
            checkin_code: row.get(8)?,
            source: row.get(9)?,
            import_batch_id: row.get(10)?,
            notes: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
            checked_in: Some(row.get::<_, i32>(14)? != 0),
        })
    })?;
    attendees.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

pub fn list_attendees(conn: &Connection, meeting_id: i64, limit: i64, offset: i64) -> Result<Vec<Attendee>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.meeting_id, a.name, a.id_card, a.phone, a.department, a.position, a.email, a.checkin_code, a.source, a.import_batch_id, a.notes, a.created_at, a.updated_at, CASE WHEN cr.id IS NOT NULL THEN 1 ELSE 0 END as checked_in FROM attendees a LEFT JOIN checkin_records cr ON a.id = cr.attendee_id AND a.meeting_id = cr.meeting_id WHERE a.meeting_id = ?1 ORDER BY a.name LIMIT ?2 OFFSET ?3"
    )?;
    let attendees = stmt.query_map(params![meeting_id, limit, offset], |row| {
        Ok(Attendee {
            id: row.get(0)?,
            meeting_id: row.get(1)?,
            name: row.get(2)?,
            id_card: row.get(3)?,
            phone: row.get(4)?,
            department: row.get(5)?,
            position: row.get(6)?,
            email: row.get(7)?,
            checkin_code: row.get(8)?,
            source: row.get(9)?,
            import_batch_id: row.get(10)?,
            notes: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
            checked_in: Some(row.get::<_, i32>(14)? != 0),
        })
    })?;
    attendees.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

pub fn add_attendee(conn: &Connection, req: &CreateAttendeeRequest) -> Result<Attendee, AppError> {
    let source = "onsite";
    conn.execute(
        "INSERT INTO attendees (meeting_id, name, id_card, phone, department, position, email, checkin_code, source, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![req.meeting_id, req.name, req.id_card, req.phone, req.department, req.position, req.email, req.checkin_code, source, req.notes],
    )?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, meeting_id, name, id_card, phone, department, position, email, checkin_code, source, import_batch_id, notes, created_at, updated_at FROM attendees WHERE id = ?1",
        [id],
        |row| {
            Ok(Attendee {
                id: row.get(0)?,
                meeting_id: row.get(1)?,
                name: row.get(2)?,
                id_card: row.get(3)?,
                phone: row.get(4)?,
                department: row.get(5)?,
                position: row.get(6)?,
                email: row.get(7)?,
                checkin_code: row.get(8)?,
                source: row.get(9)?,
                import_batch_id: row.get(10)?,
                notes: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                checked_in: None,
            })
        },
    ).map_err(AppError::Database)
}

pub fn delete_attendee(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM attendees WHERE id = ?1", [id])?;
    Ok(())
}

pub fn import_attendees_batch(conn: &Connection, meeting_id: i64, attendees: &[CreateAttendeeRequest], batch_id: i64) -> Result<ImportResult, AppError> {
    let mut success_count = 0i64;
    let mut errors = Vec::new();

    for (i, att) in attendees.iter().enumerate() {
        match conn.execute(
            "INSERT INTO attendees (meeting_id, name, id_card, phone, department, position, email, checkin_code, source, import_batch_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'import', ?9)",
            params![meeting_id, att.name, att.id_card, att.phone, att.department, att.position, att.email, att.checkin_code, batch_id],
        ) {
            Ok(_) => success_count += 1,
            Err(e) => errors.push(ImportError {
                row: i as i64 + 1,
                field: "name".to_string(),
                message: e.to_string(),
            }),
        }
    }

    let fail_count = errors.len() as i64;
    Ok(ImportResult { batch_id, success_count, fail_count, errors })
}

pub fn create_import_batch(conn: &Connection, meeting_id: i64, file_name: &str, row_count: i64) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO import_batches (meeting_id, file_name, row_count, success_count, fail_count) VALUES (?1, ?2, ?3, 0, 0)",
        params![meeting_id, file_name, row_count],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_import_batch(conn: &Connection, batch_id: i64, success_count: i64, fail_count: i64, error_details: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE import_batches SET success_count = ?1, fail_count = ?2, error_details = ?3 WHERE id = ?4",
        params![success_count, fail_count, error_details, batch_id],
    )?;
    Ok(())
}