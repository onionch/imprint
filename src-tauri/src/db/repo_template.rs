use rusqlite::{params, Connection};
use crate::db::models::*;
use crate::error::AppError;

pub fn create_badge_template(conn: &Connection, req: &CreateBadgeTemplateRequest) -> Result<BadgeTemplate, AppError> {
    let is_builtin = false;
    conn.execute(
        "INSERT INTO badge_templates (name, description, paper_size, width_mm, height_mm, template_json, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![req.name, req.description, req.paper_size, req.width_mm, req.height_mm, req.template_json, is_builtin],
    )?;
    let id = conn.last_insert_rowid();
    get_badge_template(conn, id)
}

pub fn get_badge_template(conn: &Connection, id: i64) -> Result<BadgeTemplate, AppError> {
    conn.query_row(
        "SELECT id, name, description, paper_size, width_mm, height_mm, template_json, is_builtin, thumbnail_path, created_at, updated_at FROM badge_templates WHERE id = ?1",
        [id],
        |row| {
            Ok(BadgeTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                paper_size: row.get(3)?,
                width_mm: row.get(4)?,
                height_mm: row.get(5)?,
                template_json: row.get(6)?,
                is_builtin: row.get::<_, i32>(7)? != 0,
                thumbnail_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    ).map_err(|e| AppError::NotFound(format!("模板不存在: {}", e)))
}

pub fn list_badge_templates(conn: &Connection) -> Result<Vec<BadgeTemplate>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, paper_size, width_mm, height_mm, template_json, is_builtin, thumbnail_path, created_at, updated_at FROM badge_templates ORDER BY created_at"
    )?;
    let templates = stmt.query_map([], |row| {
        Ok(BadgeTemplate {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            paper_size: row.get(3)?,
            width_mm: row.get(4)?,
            height_mm: row.get(5)?,
            template_json: row.get(6)?,
            is_builtin: row.get::<_, i32>(7)? != 0,
            thumbnail_path: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;
    templates.collect::<Result<Vec<_>, _>>().map_err(AppError::Database)
}

pub fn update_badge_template(conn: &Connection, id: i64, req: &UpdateBadgeTemplateRequest) -> Result<BadgeTemplate, AppError> {
    let existing = get_badge_template(conn, id)?;
    let name = req.name.as_deref().unwrap_or(&existing.name);
    let description = req.description.as_deref().or_else(|| existing.description.as_deref());
    let paper_size = req.paper_size.as_deref().unwrap_or(&existing.paper_size);
    let width_mm = req.width_mm.unwrap_or(existing.width_mm);
    let height_mm = req.height_mm.unwrap_or(existing.height_mm);
    let template_json = req.template_json.as_deref().unwrap_or(&existing.template_json);

    conn.execute(
        "UPDATE badge_templates SET name=?1, description=?2, paper_size=?3, width_mm=?4, height_mm=?5, template_json=?6, updated_at=datetime('now') WHERE id=?7",
        params![name, description, paper_size, width_mm, height_mm, template_json, id],
    )?;
    get_badge_template(conn, id)
}

pub fn delete_badge_template(conn: &Connection, id: i64) -> Result<(), AppError> {
    let template = get_badge_template(conn, id)?;
    if template.is_builtin {
        return Err(AppError::Validation("内置模板不可删除".to_string()));
    }
    conn.execute("DELETE FROM badge_templates WHERE id = ?1", [id])?;
    Ok(())
}
