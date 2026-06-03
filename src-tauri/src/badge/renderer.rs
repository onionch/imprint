use crate::badge::template::{parse_template, TemplateElement};
use crate::error::AppError;

/// Render badge template JSON + data into HTML string for printing/preview
pub fn render_badge_html(
    template_json: &str,
    meeting_title: &str,
    meeting_location: &str,
    meeting_date: &str,
    attendee_name: &str,
    attendee_department: &str,
    attendee_position: &str,
    checkin_time: &str,
    checkin_code: &str,
    qr_data: &str,
) -> Result<String, AppError> {
    let schema = parse_template(template_json)
        .map_err(|e| AppError::Template(e))?;

    let dpi = 300.0;
    let mm_to_px = dpi / 25.4;
    let width_px = (schema.canvas.width_mm * mm_to_px) as i32;
    let height_px = (schema.canvas.height_mm * mm_to_px) as i32;

    let mut elements_html = String::new();

    for el in &schema.elements {
        let x_px = (el.x_mm * mm_to_px) as i32;
        let y_px = (el.y_mm * mm_to_px) as i32;
        let w_px = (el.width_mm * mm_to_px) as i32;
        let h_px = (el.height_mm * mm_to_px) as i32;

        let content = replace_variables(&el.content, meeting_title, meeting_location, meeting_date, attendee_name, attendee_department, attendee_position, checkin_time, checkin_code, qr_data);

        let html = match el.element_type.as_str() {
            "text" => render_text_element(&el, &content, x_px, y_px, w_px, h_px),
            "qrcode" => render_qrcode_placeholder(&el, &content, x_px, y_px, w_px, h_px),
            "rectangle" => render_rectangle(&el, x_px, y_px, w_px, h_px),
            "image" => render_image_placeholder(&el, x_px, y_px, w_px, h_px),
            "line" => render_line(&el, x_px, y_px, w_px, h_px),
            _ => String::new(),
        };

        elements_html.push_str(&html);
    }

    let border_radius = (schema.canvas.border_radius_mm * mm_to_px) as i32;

    Ok(format!(r#"<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {{
    size: {}mm {}mm;
    margin: 0;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: {}px;
    height: {}px;
    overflow: hidden;
    font-family: "Microsoft YaHei", "SimHei", "Noto Sans SC", sans-serif;
  }}
  .badge {{
    position: relative;
    width: {}px;
    height: {}px;
    background-color: {};
    border-radius: {}px;
    overflow: hidden;
  }}
  .element {{
    position: absolute;
    overflow: hidden;
  }}
</style>
</head>
<body>
<div class="badge">
{}
</div>
</body>
</html>"#,
        schema.canvas.width_mm, schema.canvas.height_mm,
        width_px, height_px,
        width_px, height_px,
        schema.canvas.background_color,
        border_radius,
        elements_html
    ))
}

fn replace_variables(
    content: &str,
    meeting_title: &str,
    meeting_location: &str,
    meeting_date: &str,
    attendee_name: &str,
    attendee_department: &str,
    attendee_position: &str,
    checkin_time: &str,
    checkin_code: &str,
    qr_data: &str,
) -> String {
    content
        .replace("{{meeting_title}}", meeting_title)
        .replace("{{meeting_location}}", meeting_location)
        .replace("{{meeting_date}}", meeting_date)
        .replace("{{attendee_name}}", attendee_name)
        .replace("{{attendee_department}}", attendee_department)
        .replace("{{attendee_position}}", attendee_position)
        .replace("{{checkin_time}}", checkin_time)
        .replace("{{checkin_code}}", checkin_code)
        .replace("{{qr_data}}", qr_data)
}

fn render_text_element(el: &TemplateElement, content: &str, x: i32, y: i32, w: i32, h: i32) -> String {
    let style = &el.style;
    let font_family = style.get("font_family").and_then(|v| v.as_str()).unwrap_or("Microsoft YaHei");
    let font_size_pt = style.get("font_size_pt").and_then(|v| v.as_f64()).unwrap_or(12.0);
    let font_weight = style.get("font_weight").and_then(|v| v.as_str()).unwrap_or("normal");
    let color = style.get("color").and_then(|v| v.as_str()).unwrap_or("#000000");
    let text_align = style.get("text_align").and_then(|v| v.as_str()).unwrap_or("left");
    let vertical_align = style.get("vertical_align").and_then(|v| v.as_str()).unwrap_or("top");

    // Convert pt to px at 300dpi: 1pt = 1/72 inch, 1 inch = 300px
    let font_size_px = (font_size_pt * 300.0 / 72.0) as i32;

    let vertical_css = match vertical_align {
        "middle" => "display: flex; align-items: center;",
        "bottom" => "display: flex; align-items: flex-end;",
        _ => "",
    };

    format!(
        r#"<div class="element" style="left:{}px;top:{}px;width:{}px;height:{}px;font-family:'{}';font-size:{}px;font-weight:{};color:{};text-align:{};{}"><span>{}</span></div>"#,
        x, y, w, h, font_family, font_size_px, font_weight, color, text_align, vertical_css, html_escape(content)
    )
}

fn render_qrcode_placeholder(el: &TemplateElement, content: &str, x: i32, y: i32, w: i32, h: i32) -> String {
    let style = &el.style;
    let fg_color = style.get("foreground_color").and_then(|v| v.as_str()).unwrap_or("#000000");
    let bg_color = style.get("background_color").and_then(|v| v.as_str()).unwrap_or("#FFFFFF");

    // Generate a simple QR code using SVG-based approach
    // For actual printing, this will be replaced with a real QR code image
    let qr_svg = generate_qr_svg(content, w, h, fg_color, bg_color);

    format!(
        r#"<div class="element" style="left:{}px;top:{}px;width:{}px;height:{}px;">{}</div>"#,
        x, y, w, h, qr_svg
    )
}

fn generate_qr_svg(data: &str, width: i32, height: i32, fg: &str, bg: &str) -> String {
    use qrcode::QrCode;
    use qrcode::render::svg;

    match QrCode::new(data.as_bytes()) {
        Ok(code) => {
            let svg_str = code
                .render()
                .min_dimensions(width as u32, height as u32)
                .dark_color(svg::Color(fg))
                .light_color(svg::Color(bg))
                .build();

            // Wrap in a sized container
            format!(
                r#"<div style="width:{}px;height:{}px;display:flex;align-items:center;justify-content:center;">{}</div>"#,
                width, height, svg_str
            )
        }
        Err(_) => format!(
            r#"<div style="width:{}px;height:{}px;background:{};display:flex;align-items:center;justify-content:center;color:{};font-size:10px;">QR Error</div>"#,
            width, height, bg, fg
        ),
    }
}

fn render_rectangle(el: &TemplateElement, x: i32, y: i32, w: i32, h: i32) -> String {
    let style = &el.style;
    let fill_color = style.get("fill_color").and_then(|v| v.as_str()).unwrap_or("#CCCCCC");
    let border_radius = style.get("border_radius_mm").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let dpi = 300.0;
    let border_radius_px = (border_radius * dpi / 25.4) as i32;

    format!(
        r#"<div class="element" style="left:{}px;top:{}px;width:{}px;height:{}px;background-color:{};border-radius:{}px;"></div>"#,
        x, y, w, h, fill_color, border_radius_px
    )
}

fn render_image_placeholder(el: &TemplateElement, x: i32, y: i32, w: i32, h: i32) -> String {
    let style = &el.style;
    let opacity = style.get("opacity").and_then(|v| v.as_f64()).unwrap_or(1.0);

    format!(
        r#"<div class="element" style="left:{}px;top:{}px;width:{}px;height:{}px;opacity:{};"></div>"#,
        x, y, w, h, opacity
    )
}

fn render_line(el: &TemplateElement, x: i32, y: i32, w: i32, h: i32) -> String {
    let style = &el.style;
    let color = style.get("color").and_then(|v| v.as_str()).unwrap_or("#CCCCCC");
    let stroke_width_mm = style.get("stroke_width").and_then(|v| v.as_f64()).unwrap_or(0.5);
    let stroke_width_px = ((stroke_width_mm * 300.0 / 25.4) as i32).max(1);
    let height_px = h.max(stroke_width_px);

    format!(
        r#"<div class="element" style="left:{}px;top:{}px;width:{}px;height:{}px;border-top:{}px solid {};"></div>"#,
        x, y, w.max(1), height_px, stroke_width_px, color
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
