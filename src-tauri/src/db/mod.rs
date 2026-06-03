pub mod schema;
pub mod models;
pub mod repo_meeting;
pub mod repo_attendee;
pub mod repo_checkin;
pub mod repo_template;

// Re-export all repository functions from the old module path for backward compatibility
pub use repo_meeting::*;
pub use repo_attendee::*;
pub use repo_checkin::*;
pub use repo_template::*;

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(db_path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    schema::run_migrations(&conn)?;
    Ok(conn)
}
