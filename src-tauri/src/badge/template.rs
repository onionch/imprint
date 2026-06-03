use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateSchema {
    pub version: i32,
    pub canvas: Canvas,
    pub elements: Vec<TemplateElement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canvas {
    pub width_mm: f64,
    pub height_mm: f64,
    #[serde(default = "default_white")]
    pub background_color: String,
    pub background_image: Option<String>,
    #[serde(default)]
    pub border_radius_mm: f64,
}

fn default_white() -> String {
    "#FFFFFF".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateElement {
    pub id: String,
    #[serde(rename = "type")]
    pub element_type: String,
    pub x_mm: f64,
    pub y_mm: f64,
    pub width_mm: f64,
    pub height_mm: f64,
    pub content: String,
    #[serde(default)]
    pub style: serde_json::Value,
    #[serde(default)]
    pub z_index: i32,
}

pub fn parse_template(json: &str) -> Result<TemplateSchema, String> {
    serde_json::from_str(json).map_err(|e| format!("模板解析失败: {}", e))
}
