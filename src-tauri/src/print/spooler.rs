use crate::db::models::PrinterInfo;
use crate::error::AppError;
use base64::Engine;
use std::io::Write;
use std::path::PathBuf;

/// Escape a string for safe embedding in PowerShell single-quoted strings
fn ps_escape_single(s: &str) -> String {
    s.replace("'", "''")
}

/// Encode a PowerShell script as Base64 UTF-16LE for use with -EncodedCommand
fn encode_ps_command(script: &str) -> String {
    let utf16le: Vec<u8> = script
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    base64::engine::general_purpose::STANDARD.encode(&utf16le)
}

/// List available printers on the system
pub fn list_printers() -> Result<Vec<PrinterInfo>, AppError> {
    // Use [Console]::OutputEncoding to ensure UTF-8 JSON output
    let ps_script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@(Get-Printer | Select-Object Name, PrinterStatus, Type) | ConvertTo-Json -Compress
"#;

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-EncodedCommand", &encode_ps_command(ps_script)])
        .output()
        .map_err(|e| AppError::Print(format!("无法获取打印机列表: {}", e)))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();

    if trimmed.is_empty() || trimmed == "null" {
        return Ok(vec![]);
    }

    let printers: Vec<serde_json::Value> = if trimmed.starts_with('[') {
        serde_json::from_str(trimmed).unwrap_or_default()
    } else {
        match serde_json::from_str::<serde_json::Value>(trimmed) {
            Ok(v) => vec![v],
            Err(_) => return Ok(vec![]),
        }
    };

    let result = printers
        .iter()
        .filter_map(|p| {
            let name = p.get("Name")?.as_str()?.to_string();
            let status_val = p.get("PrinterStatus").and_then(|v| v.as_i64()).unwrap_or(0);
            let status = match status_val {
                0 => "Normal",
                1 => "Paused",
                2 => "Error",
                3 => "Pending Deletion",
                4 => "Paper Jam",
                5 => "Paper Out",
                6 => "Manual Feed",
                7 => "Offline",
                _ => "Unknown",
            };
            let is_network = p.get("Type").and_then(|v| v.as_i64()).unwrap_or(0) == 4;

            Some(PrinterInfo {
                name,
                is_default: false,
                is_network,
                status: status.to_string(),
            })
        })
        .collect();

    Ok(result)
}

/// Get the app data directory for temp files
fn get_app_data_dir() -> Result<PathBuf, AppError> {
    let app_data = std::env::var("APPDATA")
        .map_err(|e| AppError::Print(format!("无法获取APPDATA目录: {}", e)))?;
    let dir = PathBuf::from(app_data).join("com.checkin.app");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| AppError::Print(format!("无法创建应用目录: {}", e)))?;
    }
    Ok(dir)
}

/// Decode base64 PNG data to bytes
fn decode_base64_png(base64_data: &str) -> Result<Vec<u8>, AppError> {
    let base64_data = base64_data
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(base64_data);
    base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| AppError::Print(format!("Base64解码失败: {}", e)))
}

/// Get paper size dimensions in hundredths of an inch (for PrintDocument)
fn get_paper_size_dims(paper_size: &str) -> (i32, i32) {
    match paper_size.to_uppercase().as_str() {
        "CR80" => (213, 339),
        "A4" => (827, 1169),
        _ => (213, 339),
    }
}

/// Print PNG image to the specified printer
pub fn print_image(printer_name: &str, png_data: &[u8], paper_size: &str) -> Result<(), AppError> {
    let app_dir = get_app_data_dir()?;

    let uid = uuid::Uuid::new_v4();
    let temp_png_path = app_dir.join(format!("badge_print_{}.png", uid));

    let mut file = std::fs::File::create(&temp_png_path)
        .map_err(|e| AppError::Print(format!("无法创建临时文件: {}", e)))?;
    file.write_all(png_data)
        .map_err(|e| AppError::Print(format!("写入临时文件失败: {}", e)))?;
    drop(file);

    let (width, height) = get_paper_size_dims(paper_size);

    let png_path_str = ps_escape_single(&temp_png_path.to_string_lossy());
    let printer_escaped = ps_escape_single(printer_name);

    let ps_script = format!(
        r#"
Add-Type -AssemblyName System.Drawing
$imagePath = '{png_path}'
$printerName = '{printer}'
$paperWidth = {width}
$paperHeight = {height}

try {{
    $image = [System.Drawing.Image]::FromFile($imagePath)
    $printDoc = New-Object System.Drawing.Printing.PrintDocument
    $printDoc.PrinterSettings.PrinterName = $printerName

    if (-not $printDoc.PrinterSettings.IsValid) {{
        throw "Printer not available: $printerName"
    }}

    $paperSize = New-Object System.Drawing.Printing.PaperSize("Custom", $paperWidth, $paperHeight)
    $printDoc.DefaultPageSettings.PaperSize = $paperSize
    $printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

    $printDoc.add_PrintPage({{
        param($sender, $e)
        $g = $e.Graphics
        $bounds = $e.PageBounds
        $g.DrawImage($image, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height)
        $e.HasMorePages = $false
    }})

    $printDoc.Print()
    $image.Dispose()
}} catch {{
    Write-Error $_.Exception.Message
    exit 1
}}
"#,
        png_path = png_path_str,
        printer = printer_escaped,
        width = width,
        height = height
    );

    // Use -EncodedCommand to avoid encoding issues with Chinese printer names
    let encoded = encode_ps_command(&ps_script);

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-EncodedCommand", &encoded])
        .output()
        .map_err(|e| AppError::Print(format!("执行打印命令失败: {}", e)))?;

    let _ = std::fs::remove_file(&temp_png_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(AppError::Print(format!("打印失败: {}", stderr.trim())))
    } else {
        Ok(())
    }
}

/// Print badge from base64 PNG data
pub fn print_badge_from_base64(printer_name: &str, base64_data: &str, paper_size: &str) -> Result<(), AppError> {
    let png_data = decode_base64_png(base64_data)?;
    print_image(printer_name, &png_data, paper_size)
}
