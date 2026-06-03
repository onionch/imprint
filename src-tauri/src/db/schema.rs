use rusqlite::Connection;

const MIGRATIONS: &[&str] = &[
    r#"
CREATE TABLE IF NOT EXISTS meetings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    location        TEXT,
    start_time      TEXT NOT NULL,
    end_time        TEXT NOT NULL,
    checkin_code    TEXT,
    badge_template_id INTEGER,
    printer_name    TEXT,
    paper_size      TEXT DEFAULT 'CR80',
    auto_print      INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'draft',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendees (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id      INTEGER NOT NULL,
    name            TEXT NOT NULL,
    id_card         TEXT,
    phone           TEXT,
    department      TEXT,
    position        TEXT,
    email           TEXT,
    checkin_code    TEXT,
    source          TEXT DEFAULT 'import',
    import_batch_id INTEGER,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendees_meeting ON attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_attendees_name ON attendees(meeting_id, name);
CREATE INDEX IF NOT EXISTS idx_attendees_id_card ON attendees(meeting_id, id_card);
CREATE INDEX IF NOT EXISTS idx_attendees_phone ON attendees(meeting_id, phone);
CREATE INDEX IF NOT EXISTS idx_attendees_checkin_code ON attendees(meeting_id, checkin_code);

CREATE TABLE IF NOT EXISTS checkin_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    attendee_id     INTEGER NOT NULL,
    meeting_id      INTEGER NOT NULL,
    checkin_time    TEXT NOT NULL DEFAULT (datetime('now')),
    checkin_method  TEXT DEFAULT 'search',
    badge_printed   INTEGER DEFAULT 0,
    badge_print_time TEXT,
    badge_image_path TEXT,
    reprint_count   INTEGER DEFAULT 0,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    UNIQUE(attendee_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_meeting ON checkin_records(meeting_id);
CREATE INDEX IF NOT EXISTS idx_checkin_attendee ON checkin_records(attendee_id);

CREATE TABLE IF NOT EXISTS badge_templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    is_builtin      INTEGER DEFAULT 0,
    paper_size      TEXT DEFAULT 'CR80',
    width_mm        REAL DEFAULT 54.0,
    height_mm       REAL DEFAULT 86.0,
    template_json   TEXT NOT NULL,
    thumbnail_path  TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_batches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id      INTEGER NOT NULL,
    file_name       TEXT,
    row_count       INTEGER,
    success_count   INTEGER,
    fail_count      INTEGER,
    error_details   TEXT,
    imported_at     TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY
);
"#,
];

struct BuiltinTemplate {
    name: &'static str,
    description: &'static str,
    paper_size: &'static str,
    width_mm: f64,
    height_mm: f64,
    template_json: &'static str,
}

const BUILTIN_TEMPLATES: &[BuiltinTemplate] = &[
    BuiltinTemplate {
        name: "标准版",
        description: "蓝色顶栏，居中姓名，部门，底部二维码",
        paper_size: "CR80",
        width_mm: 54.0,
        height_mm: 86.0,
        template_json: include_str!("../../builtin_templates/standard.json"),
    },
    BuiltinTemplate {
        name: "简约版",
        description: "白底，大号姓名居中，右下角小二维码",
        paper_size: "CR80",
        width_mm: 54.0,
        height_mm: 86.0,
        template_json: include_str!("../../builtin_templates/minimal.json"),
    },
    BuiltinTemplate {
        name: "VIP版",
        description: "金色顶栏带VIP标识，姓名，职位",
        paper_size: "CR80",
        width_mm: 54.0,
        height_mm: 86.0,
        template_json: include_str!("../../builtin_templates/vip.json"),
    },
    BuiltinTemplate {
        name: "演讲者版",
        description: "深蓝顶栏带SPEAKER标识，大号姓名",
        paper_size: "CR80",
        width_mm: 54.0,
        height_mm: 86.0,
        template_json: include_str!("../../builtin_templates/speaker.json"),
    },
    BuiltinTemplate {
        name: "A4排版",
        description: "适合普通打印机，含裁切线",
        paper_size: "A4",
        width_mm: 210.0,
        height_mm: 297.0,
        template_json: include_str!("../../builtin_templates/a4.json"),
    },
];

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Migration: add auto_print column to meetings if missing
    let has_auto_print: bool = {
        let mut stmt = conn.prepare("PRAGMA table_info(meetings)")?;
        let rows: Vec<String> = stmt.query_map([], |row| row.get(1))?.filter_map(|r| r.ok()).collect();
        rows.iter().any(|c| c == "auto_print")
    };
    if !has_auto_print {
        conn.execute("ALTER TABLE meetings ADD COLUMN auto_print INTEGER NOT NULL DEFAULT 1", [])?;
    }
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    for (i, migration) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i32;
        if version > current_version {
            conn.execute_batch(migration)?;
            conn.execute(
                "INSERT INTO _migrations (version) VALUES (?1)",
                [version],
            )?;
        }
    }

    // Seed built-in templates if none exist
    let template_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM badge_templates WHERE is_builtin = 1", [], |row| {
            row.get(0)
        })?;

    if template_count == 0 {
        for tpl in BUILTIN_TEMPLATES {
            conn.execute(
                "INSERT INTO badge_templates (name, description, is_builtin, paper_size, width_mm, height_mm, template_json) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6)",
                [tpl.name, tpl.description, tpl.paper_size, &tpl.width_mm.to_string(), &tpl.height_mm.to_string(), tpl.template_json],
            )?;
        }
    }

    Ok(())
}

