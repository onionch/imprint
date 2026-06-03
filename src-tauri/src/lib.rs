pub mod db;
pub mod import;
pub mod badge;
pub mod print;
pub mod commands;
pub mod error;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("checkin.db");
            let conn = db::init_db(&db_path).expect("failed to initialize database");
            app.manage(db::DbState(std::sync::Mutex::new(conn)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::meeting_commands::list_meetings,
            commands::meeting_commands::get_meeting,
            commands::meeting_commands::create_meeting,
            commands::meeting_commands::update_meeting,
            commands::meeting_commands::delete_meeting,
            commands::attendee_commands::search_attendees,
            commands::attendee_commands::import_attendees,
            commands::attendee_commands::add_attendee_onsite,
            commands::attendee_commands::list_attendees,
            commands::attendee_commands::delete_attendee,
            commands::checkin_commands::checkin,
            commands::checkin_commands::list_checkin_records,
            commands::checkin_commands::update_checkin_record,
            commands::checkin_commands::mark_badge_printed,
            commands::checkin_commands::get_meeting_stats,
            commands::badge_commands::list_badge_templates,
            commands::badge_commands::get_badge_template,
            commands::badge_commands::create_badge_template,
            commands::badge_commands::update_badge_template,
            commands::badge_commands::delete_badge_template,
            commands::badge_commands::render_badge_html,
            commands::print_commands::list_printers,
            commands::print_commands::print_badge,
            commands::print_commands::test_print,
            commands::import_commands::read_excel_headers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
