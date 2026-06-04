use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => {
            let info = UpdateInfo {
                current_version: update.current_version.clone(),
                latest_version: update.version.clone(),
                body: update.body.clone(),
            };
            Ok(Some(info))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => {
            update
                .download_and_install(|_chunk_len, _content_length| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            // restart() terminates the process
            app.restart();
            Ok(())
        }
        Ok(None) => Err("没有可用的更新".to_string()),
        Err(e) => Err(e.to_string()),
    }
}
