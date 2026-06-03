import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Attendee } from '@/shared/types/attendee';

interface ExportAttendeesOptions {
  attendees: Attendee[];
  filename?: string;
  format?: 'xlsx' | 'csv';
}

interface TemplateOptions {
  filename?: string;
}

async function saveWorkbook(wb: XLSX.WorkBook, defaultName: string, format: 'xlsx' | 'csv') {
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const filePath = await save({
    defaultPath: `${defaultName}.${ext}`,
    filters: [
      {
        name: format === 'csv' ? 'CSV 文件' : 'Excel 文件',
        extensions: [ext],
      },
    ],
  });

  if (!filePath) return;

  const output = XLSX.write(wb, { bookType: format, type: 'array' });
  await writeFile(filePath, new Uint8Array(output));
}

function buildColumnWidths(rows: Array<Record<string, string | number>>) {
  const firstRow = rows[0] || {};
  return Object.keys(firstRow).map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...rows.map((row) => String(row[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 36) };
  });
}

export async function exportAttendees({ attendees, filename, format = 'xlsx' }: ExportAttendeesOptions) {
  const rows = attendees.map((attendee, index) => ({
    序号: index + 1,
    姓名: attendee.name,
    手机号: attendee.phone || '',
    身份证号: attendee.id_card || '',
    部门: attendee.department || '',
    职位: attendee.position || '',
    邮箱: attendee.email || '',
    签到码: attendee.checkin_code || '',
    来源: attendee.source === 'import' ? 'Excel 导入' : '手动录入',
    签到状态: attendee.checked_in ? '已签到' : '未签到',
    备注: attendee.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = buildColumnWidths(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '参会者');

  await saveWorkbook(wb, filename || `参会者名单_${new Date().toISOString().slice(0, 10)}`, format);
}

export async function downloadAttendeeImportTemplate({ filename }: TemplateOptions = {}) {
  const rows = [
    {
      姓名: '张三',
      手机号: '13800138000',
      身份证号: '110101199001011234',
      部门: '市场部',
      职位: '产品经理',
      邮箱: 'zhangsan@example.com',
      签到码: 'VIP001',
    },
    {
      姓名: '李四',
      手机号: '13900139000',
      身份证号: '110101199202022345',
      部门: '技术部',
      职位: '工程师',
      邮箱: 'lisi@example.com',
      签到码: 'DEV002',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = buildColumnWidths(rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '参会者导入模板');

  await saveWorkbook(wb, filename || '参会者导入模板', 'xlsx');
}
