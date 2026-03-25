// @ts-ignore
import * as XLSX from 'https://esm.sh/xlsx';
import { DataRow, SheetData } from '../types';

export const parseExcelFile = async (file: File): Promise<SheetData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let allRows: DataRow[] = [];
        let allColumns: string[] = [];

        // Iterate through ALL sheets to gather data
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            // defval: "" ensures empty cells are empty strings, not undefined
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as DataRow[];
            
            if (jsonData.length > 0) {
                // If we haven't defined columns yet, take them from this sheet
                if (allColumns.length === 0) {
                    allColumns = Object.keys(jsonData[0]);
                }
                
                // Optional: We could tag rows with the sheet name if needed for debugging
                // const rowsWithSource = jsonData.map(row => ({ ...row, _sourceSheet: sheetName }));
                // For now, we just merge them raw as the ETL filters will handle separation.
                allRows = [...allRows, ...jsonData];
            }
        });
        
        if (allRows.length === 0) {
          reject(new Error("File appears empty (no data found in any sheet)"));
          return;
        }

        resolve({
          name: file.name.replace(/\.[^/.]+$/, ""),
          rows: allRows,
          columns: allColumns
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const exportToCSV = (data: DataRow[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_cleaned.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const copyToClipboardForSheets = (data: DataRow[]) => {
    // TSV format is best for pasting into Google Sheets
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const tsvContent = [
        headers.join('\t'),
        ...data.map(row => headers.map(fieldName => {
            const val = row[fieldName];
            if (val === null || val === undefined) return '';
            return String(val).replace(/\t/g, '    '); // Escape tabs
        }).join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(tsvContent);
};
