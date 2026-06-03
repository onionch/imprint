use crate::db::models::PrinterInfo;
use crate::error::AppError;
use crate::print;

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, AppError> {
    print::list_printers()
}

#[tauri::command]
pub fn print_badge(printer_name: String, png_base64: String, paper_size: String) -> Result<(), AppError> {
    print::print_badge_from_base64(&printer_name, &png_base64, &paper_size)
}

#[tauri::command]
pub fn test_print(printer_name: String) -> Result<(), AppError> {
    // Generate a simple test badge PNG (1x1 white pixel as minimal valid PNG)
    let test_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    print::print_badge_from_base64(&printer_name, test_png_b64, "A4")
}
