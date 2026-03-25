export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface SheetData {
  name: string;
  rows: DataRow[];
  columns: string[];
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PREVIEW = 'PREVIEW',
  PROCESSED = 'PROCESSED'
}

export interface SyncResult {
  success: boolean;
  message: string;
  added?: number;
  updated?: number;
}

export interface Anomaly {
  key: string; // Composite key (date-store-sku)
  entry_date: string;
  store_code: string;
  sku: string;
  
  // Raw Data (System A)
  raw_sale: number;
  raw_qty: number;

  // Reference Data (System B)
  ref_sale: number;
  ref_qty: number;

  // Diff
  diff_sale: number;
  diff_qty: number;
}
