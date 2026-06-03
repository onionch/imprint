export interface BadgeTemplate {
  id: number;
  name: string;
  description?: string;
  is_builtin: boolean;
  paper_size: string;
  width_mm: number;
  height_mm: number;
  template_json: string;
  thumbnail_path?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBadgeTemplateRequest {
  name: string;
  description?: string;
  paper_size?: string;
  width_mm?: number;
  height_mm?: number;
  template_json: string;
}

export interface UpdateBadgeTemplateRequest {
  name?: string;
  description?: string;
  paper_size?: string;
  width_mm?: number;
  height_mm?: number;
  template_json?: string;
}

export interface TemplateSchema {
  version: number;
  canvas: TemplateCanvas;
  elements: TemplateElement[];
}

export interface TemplateCanvas {
  width_mm: number;
  height_mm: number;
  background_color: string;
  background_image?: string;
  border_radius_mm: number;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'qrcode' | 'image' | 'rectangle' | 'line';
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  content?: string;
  style: Record<string, unknown>;
  z_index: number;
}

export const TEMPLATE_VARIABLES = [
  { value: '{{meeting_title}}', label: '会议名称' },
  { value: '{{meeting_location}}', label: '会议地点' },
  { value: '{{meeting_date}}', label: '会议日期' },
  { value: '{{attendee_name}}', label: '参会者姓名' },
  { value: '{{attendee_department}}', label: '部门' },
  { value: '{{attendee_position}}', label: '职位' },
  { value: '{{checkin_time}}', label: '签到时间' },
  { value: '{{checkin_code}}', label: '签到码' },
  { value: '{{qr_data}}', label: '二维码数据' },
];
