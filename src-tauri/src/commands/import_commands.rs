use crate::error::AppError;

#[tauri::command]
pub fn read_excel_headers(file_path: String) -> Result<Vec<String>, AppError> {
    crate::import::read_headers(&file_path)
}
