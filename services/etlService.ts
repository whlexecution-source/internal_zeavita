import { DataRow } from '../types';

export const runZeavitaETL = (data: DataRow[]): { cleanedData: DataRow[], summary: string } => {
  // --- SALES ETL LOGIC ---
  // 1. Initial Filtering: form_name contains "ยอดขายรายชิ้น"
  const filteredByForm = data.filter(row => {
    const formName = row['form_name'] ? String(row['form_name']) : '';
    return formName.includes("ยอดขายรายชิ้น");
  });

  const initialCount = data.length;
  const step1Count = filteredByForm.length;

  // 2. Drop unnecessary columns
  const colsToDrop = new Set([
    'id', 'entry_id', 'user_mobile', 'user_pc_code', 
    'campaign_name', 'form_name', 'item_type', 'item_promotion_name', 
    'content', 'analytics_key', 'is_multiple', 'created_at', 'updated_at'
  ]);

  // 3. Filter "option" out of item_property
  const filteredData = filteredByForm.filter(row => {
    const itemProp = row['item_property'] ? String(row['item_property']).toLowerCase() : '';
    return itemProp !== 'option';
  });

  // 4 & 5. Pivot: Transform item_property into columns
  const groupedData = new Map<string, DataRow>();

  filteredData.forEach(row => {
    const indexKeyObj: DataRow = {};
    let itemProperty = '';
    let value = 0;

    Object.keys(row).forEach(key => {
      if (colsToDrop.has(key)) return;

      if (key === 'item_property') {
        itemProperty = String(row[key]);
      } else if (key === 'value') {
        const num = Number(row[key]);
        value = isNaN(num) ? 0 : num;
      } else {
        indexKeyObj[key] = row[key];
      }
    });

    // Create signature based on index columns
    const signature = JSON.stringify(Object.keys(indexKeyObj).sort().map(k => [k, indexKeyObj[k]]));

    if (!groupedData.has(signature)) {
      groupedData.set(signature, { ...indexKeyObj });
    }

    const currentGroup = groupedData.get(signature)!;

    if (itemProperty) {
      if (typeof currentGroup[itemProperty] === 'number') {
        (currentGroup[itemProperty] as number) += value;
      } else {
        currentGroup[itemProperty] = value;
      }
    }
  });

  const finalRows = Array.from(groupedData.values());

  const summary = `Sales ETL:
- Filtered 'ยอดขายรายชิ้น' (${step1Count}/${initialCount} total rows scanned)
- Pivoted 'item_property'
- Result: ${finalRows.length} unique sales records.`;

  return { cleanedData: finalRows, summary };
};

export const runCustomerETL = (data: DataRow[]): { cleanedData: DataRow[], summary: string } => {
  // --- CUSTOMER ETL LOGIC ---
  
  // 1. Label Mapping
  const labelMapping: Record<string, string> = {
    'HT ZEAVITA เข้าหาลูกค้า ทั้งหมดกี่คน': 'approach',
    'ปิดการขายได้ ทั้งหมดกี่คน': 'close_sales',
    'ลูกค้าที่เข้ามาในแผนกยาและอาหารเสริม ทั้งหมดกี่คน': 'traffic'
  };

  // 2. Filter rows containing these labels and Rename
  const filtered = data.filter(row => {
    // We trim() the string to avoid issues with trailing/leading spaces in the Excel cell
    const label = row['item_label'] ? String(row['item_label']).trim() : '';
    return labelMapping.hasOwnProperty(label);
  });
  
  const step1Count = filtered.length;

  // 3. Drop Columns
  const colsToDrop = new Set([
    'id', 'entry_id', 'user_mobile', 'user_pc_code', 
    'campaign_name', 'form_name', 'item_type', 'item_property', 
    'item_product_name', 'item_promotion_name', 'content', 
    'analytics_key', 'is_multiple', 'created_at', 'updated_at'
  ]);

  // 4. Pivot Logic
  // Index = Everything except 'item_label' and 'value' (and dropped cols)
  // Columns = 'item_label' (mapped)
  // Values = 'value' (sum)

  const groupedData = new Map<string, DataRow>();

  filtered.forEach(row => {
    const indexKeyObj: DataRow = {};
    // Use the trimmed label for mapping as well
    let itemLabelRaw = row['item_label'] ? String(row['item_label']).trim() : '';
    let itemLabel = labelMapping[itemLabelRaw]; // Get mapped name
    let value = 0;

    Object.keys(row).forEach(key => {
      // Logic: Drop columns in list OR if it's the pivot column or value column
      if (colsToDrop.has(key)) return;
      
      if (key === 'item_label') {
        // handled above
      } else if (key === 'value') {
        const num = Number(row[key]);
        value = isNaN(num) ? 0 : num;
      } else {
        // This is an index column
        indexKeyObj[key] = row[key];
      }
    });

    const signature = JSON.stringify(Object.keys(indexKeyObj).sort().map(k => [k, indexKeyObj[k]]));

    if (!groupedData.has(signature)) {
      groupedData.set(signature, { ...indexKeyObj });
    }

    const currentGroup = groupedData.get(signature)!;

    if (itemLabel) {
       // Initialize with 0 if undefined, then add
       const currentVal = (currentGroup[itemLabel] as number) || 0;
       currentGroup[itemLabel] = currentVal + value;
    }
  });

  const finalRows = Array.from(groupedData.values());

  const summary = `Customer ETL:
- Scanned all sheets.
- Filtered specific labels (${step1Count} matches found)
- Renamed labels (approach, close_sales, traffic)
- Pivoted by item_label
- Result: ${finalRows.length} unique customer records.`;

  return { cleanedData: finalRows, summary };
};

export const syncToGoogleSheets = async (
    data: any[], 
    scriptUrl: string, 
    sheetName: string, 
    primaryKeys: string[],
    mode: 'upsert' | 'overwrite' = 'upsert'
): Promise<{ success: boolean; message: string; added?: number; updated?: number }> => {
    try {
        const payload = {
            sheetName: sheetName,
            data: data,
            primaryKeys: primaryKeys,
            mode: mode
        };

        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error("Sync Error:", error);
        return { success: false, message: error.message };
    }
};
