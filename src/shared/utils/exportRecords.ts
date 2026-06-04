import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { CheckinRecord } from '@/shared/types/checkin';

interface ExportOptions {
  records: CheckinRecord[];
  filename?: string;
  format?: 'xlsx' | 'csv';
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN');
}

export async function exportRecords({
  records,
  filename,
  format = 'xlsx',
}: ExportOptions) {
  const data = records.map((record, index) => ({
    序号: index + 1,
    姓名: record.attendee_name || '',
    部门: record.attendee_department || '',
    职位: record.attendee_position || '',
    手机: record.attendee_phone || '',
    签到码: record.checkin_code || '',
    签到状态: '已签到',
    签到时间: formatTime(record.checkin_time),
    签到方式: record.checkin_method || '',
    胸牌打印: record.badge_printed ? '已打印' : '未打印',
    打印时间: formatTime(record.badge_print_time),
    补打次数: record.reprint_count || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '签到记录');

  const colWidths = Object.keys(data[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...data.map((row) => String(row[key as keyof typeof row] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 30) };
  });
  ws['!cols'] = colWidths;

  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const defaultName = filename || `签到记录_${new Date().toISOString().slice(0, 10)}`;

  const filePath = await save({
    defaultPath: `${defaultName}.${ext}`,
    filters: [
      {
        name: format === 'csv' ? 'CSV 文件' : 'Excel 文件',
        extensions: [ext],
      },
    ],
  });

  if (!filePath) {
    return;
  }

  const bookType = format === 'csv' ? 'csv' : 'xlsx';
  const outputData = XLSX.write(wb, { bookType, type: 'array' });
  const uint8 = new Uint8Array(outputData);

  await writeFile(filePath, uint8);
}
