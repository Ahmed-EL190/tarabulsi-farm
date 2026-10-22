/** columns: [{key,label}], rows: objects. Adds export timestamp + filter note. */
export async function exportRows({ filename, sheet = 'Data', columns, rows, note }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet.slice(0, 31), { views: [{ rightToLeft: true }] })
  ws.addRow(columns.map((c) => c.label)).font = { bold: true }
  rows.forEach((r) => ws.addRow(columns.map((c) => { const v = r[c.key]; return v === undefined ? null : v })))
  ws.columns.forEach((c) => (c.width = 18))
  const info = wb.addWorksheet('Info'); info.addRow(['تاريخ التصدير', new Date().toISOString()]); if (note) info.addRow(['الفلاتر', note]); info.addRow(['عدد السجلات', rows.length])
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url)
}
