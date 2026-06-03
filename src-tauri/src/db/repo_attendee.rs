use rusqlite::{params, Connection};
use crate::db::models::*;
use crate::error::AppError;

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn find_duplicate_attendee_id(conn: &Connection, meeting_id: i64, attendee: &CreateAttendeeRequest) -> Result<Option<i64>, AppError> {
    let checkin_code = normalize_optional_text(attendee.checkin_code.clone());
    if let Some(code) = checkin_code {
        let mut stmt = conn.prepare("SELECT id FROM attendees WHERE meeting_id = ?1 AND checkin_code = ?2 LIMIT 1")?;
        let mut rows = stmt.query(params![meeting_id, code])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }
    }

    let id_card = normalize_optional_text(attendee.id_card.clone());
    if let Some(card) = id_card {
        let mut stmt = conn.prepare("SELECT id FROM attendees WHERE meeting_id = ?1 AND id_card = ?2 LIMIT 1")?;
        let mut rows = stmt.query(params![meeting_id, card])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }
    }

    let phone = normalize_optional_text(attendee.phone.clone());
    if let Some(phone) = phone {
        let mut stmt = conn.prepare("SELECT id FROM attendees WHERE meeting_id = ?1 AND phone = ?2 LIMIT 1")?;
        let mut rows = stmt.query(params![meeting_id, phone])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }
    }

    Ok(None)
}

fn overwrite_attendee_from_import(conn: &Connection, attendee_id: i64, attendee: &CreateAttendeeRequest, batch_id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE attendees
         SET name = ?1,
             id_card = ?2,
             phone = ?3,
             department = ?4,
             position = ?5,
             email = ?6,
             checkin_code = ?7,
             source = 'import',
             import_batch_id = ?8,
             updated_at = datetime('now')
         WHERE id = ?9",
        params![
            attendee.name.trim(),
            normalize_optional_text(attendee.id_card.clone()),
            normalize_optional_text(attendee.phone.clone()),
            normalize_optional_text(attendee.department.clone()),
            normalize_optional_text(attendee.position.clone()),
            normalize_optional_text(attendee.email.clone()),
            normalize_optional_text(attendee.checkin_code.clone()),
            batch_id,
            attendee_id
        ],
    )?;
    Ok(())
}

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
    let name = req.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("参会者姓名不能为空".to_string()));
    }
    conn.execute(
        "INSERT INTO attendees (meeting_id, name, id_card, phone, department, position, email, checkin_code, source, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            req.meeting_id,
            name,
            normalize_optional_text(req.id_card.clone()),
            normalize_optional_text(req.phone.clone()),
            normalize_optional_text(req.department.clone()),
            normalize_optional_text(req.position.clone()),
            normalize_optional_text(req.email.clone()),
            normalize_optional_text(req.checkin_code.clone()),
            source,
            normalize_optional_text(req.notes.clone())
        ],
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

pub fn update_attendee(conn: &Connection, id: i64, req: &UpdateAttendeeRequest) -> Result<Attendee, AppError> {
    let existing = conn.query_row(
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
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("参会者 {} 不存在", id)),
        other => AppError::Database(other),
    })?;

    let name = req.name.clone().unwrap_or(existing.name);
    if name.trim().is_empty() {
        return Err(AppError::Validation("参会者姓名不能为空".to_string()));
    }

    let id_card = match &req.id_card {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.id_card,
    };
    let phone = match &req.phone {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.phone,
    };
    let department = match &req.department {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.department,
    };
    let position = match &req.position {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.position,
    };
    let email = match &req.email {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.email,
    };
    let checkin_code = match &req.checkin_code {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.checkin_code,
    };
    let notes = match &req.notes {
        Some(value) => normalize_optional_text(Some(value.clone())),
        None => existing.notes,
    };

    conn.execute(
        "UPDATE attendees SET name = ?1, id_card = ?2, phone = ?3, department = ?4, position = ?5, email = ?6, checkin_code = ?7, notes = ?8, updated_at = datetime('now') WHERE id = ?9",
        params![name.trim(), id_card, phone, department, position, email, checkin_code, notes, id],
    )?;

    conn.query_row(
        "SELECT a.id, a.meeting_id, a.name, a.id_card, a.phone, a.department, a.position, a.email, a.checkin_code, a.source, a.import_batch_id, a.notes, a.created_at, a.updated_at, CASE WHEN cr.id IS NOT NULL THEN 1 ELSE 0 END as checked_in FROM attendees a LEFT JOIN checkin_records cr ON a.id = cr.attendee_id AND a.meeting_id = cr.meeting_id WHERE a.id = ?1",
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
                checked_in: Some(row.get::<_, i32>(14)? != 0),
            })
        },
    ).map_err(AppError::Database)
}

pub fn delete_attendee(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute("DELETE FROM attendees WHERE id = ?1", [id])?;
    Ok(())
}

pub fn import_attendees_batch(
    conn: &Connection,
    meeting_id: i64,
    attendees: &[CreateAttendeeRequest],
    batch_id: i64,
    duplicate_strategy: ImportDuplicateStrategy,
) -> Result<ImportResult, AppError> {
    let mut success_count = 0i64;
    let mut skipped_count = 0i64;
    let mut errors = Vec::new();

    for (i, att) in attendees.iter().enumerate() {
        if att.name.trim().is_empty() {
            errors.push(ImportError {
                row: i as i64 + 1,
                field: "name".to_string(),
                message: "姓名不能为空".to_string(),
            });
            continue;
        }

        if let Some(existing_id) = find_duplicate_attendee_id(conn, meeting_id, att)? {
            match duplicate_strategy {
                ImportDuplicateStrategy::KeepAll => {}
                ImportDuplicateStrategy::SkipDuplicates => {
                    skipped_count += 1;
                    continue;
                }
                ImportDuplicateStrategy::OverwriteDuplicates => {
                    if let Err(e) = overwrite_attendee_from_import(conn, existing_id, att, batch_id) {
                        errors.push(ImportError {
                            row: i as i64 + 1,
                            field: "duplicate".to_string(),
                            message: e.to_string(),
                        });
                    } else {
                        success_count += 1;
                    }
                    continue;
                }
            }
        }

        match conn.execute(
            "INSERT INTO attendees (meeting_id, name, id_card, phone, department, position, email, checkin_code, source, import_batch_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'import', ?9)",
            params![
                meeting_id,
                att.name.trim(),
                normalize_optional_text(att.id_card.clone()),
                normalize_optional_text(att.phone.clone()),
                normalize_optional_text(att.department.clone()),
                normalize_optional_text(att.position.clone()),
                normalize_optional_text(att.email.clone()),
                normalize_optional_text(att.checkin_code.clone()),
                batch_id
            ],
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
    Ok(ImportResult { batch_id, success_count, fail_count, skipped_count, errors })
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
