use calamine::{open_workbook_auto, Data, Reader};
use crate::db::models::{ColumnMapping, CreateAttendeeRequest};
use crate::error::AppError;

pub fn read_headers(file_path: &str) -> Result<Vec<String>, AppError> {
    let mut workbook = open_workbook_auto(file_path)
        .map_err(|e| AppError::Import(format!("无法打开文件: {}", e)))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let sheet_name = sheet_names.first()
        .ok_or_else(|| AppError::Import("文件中没有工作表".to_string()))?
        .clone();

    let range = workbook.worksheet_range(&sheet_name)
        .map_err(|e| AppError::Import(format!("无法读取工作表: {}", e)))?;

    let mut headers = Vec::new();
    if let Some(row) = range.rows().next() {
        for cell in row {
            let header = match cell {
                Data::String(s) => s.clone(),
                Data::Float(f) => format!("{}", f),
                Data::Int(i) => format!("{}", i),
                _ => String::new(),
            };
            headers.push(header);
        }
    }

    Ok(headers)
}

pub fn read_data_with_mapping(
    file_path: &str,
    mapping: &ColumnMapping,
) -> Result<Vec<CreateAttendeeRequest>, AppError> {
    let mut workbook = open_workbook_auto(file_path)
        .map_err(|e| AppError::Import(format!("无法打开文件: {}", e)))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let sheet_name = sheet_names.first()
        .ok_or_else(|| AppError::Import("文件中没有工作表".to_string()))?
        .clone();

    let range = workbook.worksheet_range(&sheet_name)
        .map_err(|e| AppError::Import(format!("无法读取工作表: {}", e)))?;

    let rows: Vec<Vec<Data>> = range.rows().map(|r| r.to_vec()).collect();
    if rows.is_empty() {
        return Err(AppError::Import("文件为空".to_string()));
    }

    // Get header row
    let headers: Vec<String> = rows[0].iter().map(|cell| cell_to_string(cell)).collect();

    // Build column index mapping
    let name_col = mapping.name.as_ref().and_then(|h| headers.iter().position(|x| x == h));
    let id_card_col = mapping.id_card.as_ref().and_then(|h| headers.iter().position(|x| x == h));
    let phone_col = mapping.phone.as_ref().and_then(|h| headers.iter().position(|x| x == h));
    let dept_col = mapping.department.as_ref().and_then(|h| headers.iter().position(|x| x == h));
    let pos_col = mapping.position.as_ref().and_then(|h| headers.iter().position(|x| x == h));
    let email_col = mapping.email.as_ref().and_then(|h| headers.iter().position(|x| x == h));
    let code_col = mapping.checkin_code.as_ref().and_then(|h| headers.iter().position(|x| x == h));

    if name_col.is_none() {
        return Err(AppError::Import("必须映射姓名列".to_string()));
    }

    let mut attendees = Vec::new();
    for row in rows.iter().skip(1) {
        let name = name_col.and_then(|c| row.get(c)).map(cell_to_string).unwrap_or_default();
        if name.trim().is_empty() {
            continue;
        }

        attendees.push(CreateAttendeeRequest {
            meeting_id: 0,
            name: name.trim().to_string(),
            id_card: id_card_col.and_then(|c| row.get(c)).map(cell_to_string),
            phone: phone_col.and_then(|c| row.get(c)).map(cell_to_string),
            department: dept_col.and_then(|c| row.get(c)).map(cell_to_string),
            position: pos_col.and_then(|c| row.get(c)).map(cell_to_string),
            email: email_col.and_then(|c| row.get(c)).map(cell_to_string),
            checkin_code: code_col.and_then(|c| row.get(c)).map(cell_to_string),
            notes: None,
        });
    }

    Ok(attendees)
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::String(s) => s.clone(),
        Data::Float(f) => {
            if *f == (*f as i64) as f64 {
                format!("{}", *f as i64)
            } else {
                format!("{}", f)
            }
        }
        Data::Int(i) => format!("{}", i),
        Data::Bool(b) => format!("{}", b),
        Data::DateTime(dt) => format!("{}", dt),
        _ => String::new(),
    }
}