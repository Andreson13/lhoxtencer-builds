import * as XLSX from 'xlsx';

export async function exportToExcel(data: any[], filename: string, sheetName: string) {
  if (!data.length) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const maxWidth = 30;
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(
      Math.max(key.length, ...data.map((row) => String(row[key] ?? '').length)),
      maxWidth
    ),
  }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportAllToExcel(
  sheets: Array<{ sheetName: string; data: any[] }>,
  filename: string,
) {
  const workbook = XLSX.utils.book_new();
  const maxWidth = 30;

  sheets.forEach((sheet) => {
    const rows = sheet.data || [];
    const worksheet = rows.length
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.json_to_sheet([{ message: 'Aucune donnée' }]);

    if (rows.length) {
      const colWidths = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.min(
          Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length)),
          maxWidth,
        ),
      }));
      worksheet['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName.slice(0, 31));
  });

  XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
}
