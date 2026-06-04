pub mod meeting_commands;
pub mod attendee_commands;
pub mod checkin_commands;
pub mod badge_commands;
pub mod print_commands;
pub mod import_commands;
pub mod update_commands;

use std::sync::MutexGuard;

use rusqlite::Connection;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

pub(crate) fn lock_db<'a>(
    db: &'a State<'a, DbState>,
) -> Result<MutexGuard<'a, Connection>, AppError> {
    db.0.lock().map_err(|error| {
        AppError::Database(rusqlite::Error::InvalidParameterName(error.to_string()))
    })
}

macro_rules! command_handlers {
    () => {
        tauri::generate_handler![
            crate::commands::meeting_commands::list_meetings,
            crate::commands::meeting_commands::get_meeting,
            crate::commands::meeting_commands::create_meeting,
            crate::commands::meeting_commands::update_meeting,
            crate::commands::meeting_commands::delete_meeting,
            crate::commands::attendee_commands::search_attendees,
            crate::commands::attendee_commands::import_attendees,
            crate::commands::attendee_commands::add_attendee_onsite,
            crate::commands::attendee_commands::list_attendees,
            crate::commands::attendee_commands::update_attendee,
            crate::commands::attendee_commands::delete_attendee,
            crate::commands::checkin_commands::checkin,
            crate::commands::checkin_commands::list_checkin_records,
            crate::commands::checkin_commands::update_checkin_record,
            crate::commands::checkin_commands::mark_badge_printed,
            crate::commands::checkin_commands::get_meeting_stats,
            crate::commands::badge_commands::list_badge_templates,
            crate::commands::badge_commands::get_badge_template,
            crate::commands::badge_commands::create_badge_template,
            crate::commands::badge_commands::update_badge_template,
            crate::commands::badge_commands::delete_badge_template,
            crate::commands::badge_commands::render_badge_html,
            crate::commands::badge_commands::render_badge_html_preview,
            crate::commands::print_commands::list_printers,
            crate::commands::print_commands::print_badge,
            crate::commands::print_commands::test_print,
            crate::commands::import_commands::read_excel_headers,
            crate::commands::update_commands::check_update,
            crate::commands::update_commands::install_update,
        ]
    };
}

pub(crate) use command_handlers;
