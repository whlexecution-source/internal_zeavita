import { DataRow } from '../types';

export interface Anomaly {
  key: string;
  entry_date: string;
  store_code: string;
  item_product_name: string;
  raw_sale: number;
  raw_qty: number;
  ref_sale: number;
  ref_qty: number;
  diff_sale: number;
  diff_qty: number;
  reason: string;
}

interface AggregatedRecord {
  entry_date: string;
  store_code: string;
  item_product_name: string;
  sale: number;
  qty: number;
}

const normalizeKey = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const normalizeDate = (val: any): string => {
  if (val === null || val === undefined || val === '') return '';

  // 1. Handle Excel Serial Date (Number)
  if (typeof val === 'number') {
    // Excel base date: Dec 30, 1899. 
    // (val - 25569) converts to Unix timestamp (days since 1970-01-01)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let str = String(val).trim();

  // 2. Handle ISO String with Time (e.g., 2026-02-22T17:00:00.000Z)
  // We must convert this to Local Time to account for timezone shifts (e.g. UTC to Thai Time)
  if (str.includes('T') && str.match(/\d{4}-\d{2}-\d{2}T/)) {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
  }

  // 3. Handle DD/MM/YYYY or MM/DD/YYYY
  // Regex to match D/M/YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    let day = parseInt(ddmmyyyy[1], 10);
    let month = parseInt(ddmmyyyy[2], 10);
    const year = ddmmyyyy[3];

    // Auto-detect US format (MM/DD/YYYY) if month > 12
    if (month > 12 && day <= 12) {
        const temp = day;
        day = month;
        month = temp;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 4. Handle YYYY-MM-DD (Simple ISO without time)
  const yyyymmdd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 5. Fallback: Try standard Date parse
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
};

const parseNumber = (val: any): number => {
  if (typeof val === 'string') {
    val = val.replace(/,/g, ''); // Remove commas
  }
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

// Aggregate Raw Data (System A - Zeavita Raw Export)
export const aggregateRawData = (rows: DataRow[]): Map<string, AggregatedRecord> => {
  const grouped = new Map<string, AggregatedRecord>();

  // Filter only relevant rows (similar to ETL)
  const filtered = rows.filter(row => {
    const formName = row['form_name'] ? String(row['form_name']) : '';
    return formName.includes("ยอดขายรายชิ้น");
  });

  filtered.forEach(row => {
    // Skip 'option' property as per ETL logic
    const itemPropRaw = row['item_property'] ? String(row['item_property']) : '';
    if (itemPropRaw.toLowerCase() === 'option') return;

    // Extract Keys
    const entry_date = normalizeDate(row['entry_date']);
    const store_code = normalizeKey(row['store_code'] || row['store']); 
    // Use item_product_name instead of sku
    const item_product_name = normalizeKey(row['item_product_name'] || row['product_name'] || row['sku']);

    if (!entry_date || !store_code || !item_product_name) return; // Skip if key missing

    const key = `${entry_date}|${store_code}|${item_product_name}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        entry_date,
        store_code,
        item_product_name,
        sale: 0,
        qty: 0
      });
    }

    const record = grouped.get(key)!;
    
    // Extract Value based on item_property
    const itemProperty = itemPropRaw.toLowerCase();
    const value = parseNumber(row['value']);

    // Map property names to metrics
    if (itemProperty === 'quantity' || itemProperty === 'qty' || itemProperty.includes('จำนวน')) {
      record.qty += value;
    } else if (itemProperty === 'total_sales' || itemProperty === 'sale' || itemProperty === 'price' || itemProperty.includes('ยอดขาย') || itemProperty.includes('ราคา') || itemProperty.includes('amount')) {
      record.sale += value;
    }
  });

  return grouped;
};

// Aggregate Reference Data (System B - from uploaded file)
export const aggregateReferenceData = (rows: DataRow[]): Map<string, AggregatedRecord> => {
  const grouped = new Map<string, AggregatedRecord>();

  rows.forEach(row => {
    // Extract Keys
    const entry_date = normalizeDate(row['entry_date'] || row['Date'] || row['date']);
    const store_code = normalizeKey(row['store_code'] || row['Store Code'] || row['store'] || row['Store']);
    // Use item_product_name instead of sku
    const item_product_name = normalizeKey(row['item_product_name'] || row['Item Product Name'] || row['product_name'] || row['Product Name'] || row['sku']);

    if (!entry_date || !store_code || !item_product_name) return;

    const key = `${entry_date}|${store_code}|${item_product_name}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        entry_date,
        store_code,
        item_product_name,
        sale: 0,
        qty: 0
      });
    }

    const record = grouped.get(key)!;

    // Extract Metrics
    // Flexible column names for metrics
    // Prioritize explicit "Total" or "Amount" fields over "Price" (which might be unit price)
    const sale = parseNumber(
        row['Total Sales'] || row['total_sales'] || 
        row['Amount'] || row['amount'] || 
        row['Sale'] || row['sale'] || 
        row['Price'] || row['price']
    );
    
    const qty = parseNumber(
        row['Total Quantity'] || row['total_quantity'] || 
        row['Quantity'] || row['quantity'] || 
        row['Qty'] || row['qty']
    );

    record.sale += sale;
    record.qty += qty;
  });

  return grouped;
};

export const detectAnomalies = (rawRows: DataRow[], refRows: DataRow[]): Anomaly[] => {
  const rawMap = aggregateRawData(rawRows);
  const refMap = aggregateReferenceData(refRows);

  const anomalies: Anomaly[] = [];
  
  // 1. Identify valid dates from Raw Data
  const validDates = new Set<string>();
  for (const k of rawMap.keys()) {
      const [date] = k.split('|');
      if (date) validDates.add(date);
  }

  // 2. Get all unique keys from both maps
  const allKeys = new Set<string>();
  for (const k of rawMap.keys()) allKeys.add(k);
  for (const k of refMap.keys()) allKeys.add(k);

  allKeys.forEach(key => {
    const [date, store, productName] = key.split('|');

    // FILTER: Only process if the date exists in Raw Data
    if (!validDates.has(date)) return; 

    const raw = rawMap.get(key);
    const ref = refMap.get(key);

    const raw_sale = raw ? raw.sale : 0;
    const raw_qty = raw ? raw.qty : 0;
    const ref_sale = ref ? ref.sale : 0;
    const ref_qty = ref ? ref.qty : 0;

    // Ignore if all values are effectively zero
    if (Math.abs(raw_sale) < 0.01 && Math.abs(ref_sale) < 0.01 && 
        Math.abs(raw_qty) < 0.01 && Math.abs(ref_qty) < 0.01) {
        return;
    }

    const diff_sale = raw_sale - ref_sale;
    const diff_qty = raw_qty - ref_qty;

    let reason = "";
    let isAnomaly = false;

    // Logic 1: Sales Mismatch (ยอดขายไม่ตรงกัน)
    if (Math.abs(diff_sale) > 0.01) {
        isAnomaly = true;
        reason = `ยอดขายไม่ตรงกัน (Raw: ${raw_sale.toLocaleString()}, Ref: ${ref_sale.toLocaleString()})`;
    }

    // Logic 2: Quantity Mismatch (จำนวนสินค้าไม่ตรงกัน)
    if (Math.abs(diff_qty) > 0.01) {
        isAnomaly = true;
        const qtyReason = `จำนวนไม่ตรงกัน (Raw: ${raw_qty}, Ref: ${ref_qty})`;
        reason = reason ? `${reason}, ${qtyReason}` : qtyReason;
    }

    // Logic 3: Missing Data (ข้อมูลขาดหาย)
    if (!raw && ref) {
        isAnomaly = true;
        reason = "มีใน Reference แต่ไม่มีใน Raw Data";
    } else if (raw && !ref) {
        isAnomaly = true;
        reason = "มีใน Raw Data แต่ไม่มีใน Reference";
    }

    if (isAnomaly) {
      anomalies.push({
        key,
        entry_date: date,
        store_code: store,
        item_product_name: productName,
        raw_sale,
        raw_qty,
        ref_sale,
        ref_qty,
        diff_sale,
        diff_qty,
        reason
      });
    }
  });

  return anomalies;
};
