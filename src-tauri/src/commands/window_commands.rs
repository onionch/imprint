use tauri::Window;

use crate::error::AppError;

#[tauri::command]
pub fn window_minimize(window: Window) -> Result<(), AppError> {
    window
        .minimize()
        .map_err(|error| AppError::Validation(error.to_string()))
}

#[tauri::command]
pub fn window_toggle_maximize(window: Window) -> Result<(), AppError> {
    let is_maximized = window
        .is_maximized()
        .map_err(|error| AppError::Validation(error.to_string()))?;

    if is_maximized {
        window
            .unmaximize()
            .map_err(|error| AppError::Validation(error.to_string()))
    } else {
        window
            .maximize()
            .map_err(|error| AppError::Validation(error.to_string()))
    }
}

#[tauri::command]
pub fn window_is_maximized(window: Window) -> Result<bool, AppError> {
    window
        .is_maximized()
        .map_err(|error| AppError::Validation(error.to_string()))
}

#[tauri::command]
pub fn window_close(window: Window) -> Result<(), AppError> {
    window
        .close()
        .map_err(|error| AppError::Validation(error.to_string()))
}
