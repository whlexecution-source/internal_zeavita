import { DataRow, SyncResult } from '../types';

export const fetchFromGoogleSheets = async (
  scriptUrl: string,
  sheetName: string
): Promise<{ success: boolean; data?: DataRow[]; message?: string }> => {
  try {
    // GET request to fetch data
    // We append query params to the script URL
    const url = new URL(scriptUrl);
    url.searchParams.append('sheetName', sheetName);
    url.searchParams.append('action', 'read');

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error: any) {
    console.error("Fetch failed:", error);
    return {
      success: false,
      message: error.message || "Unknown error during fetch"
    };
  }
};
export const syncToGoogleSheets = async (
  data: DataRow[], 
  scriptUrl: string,
  sheetName: string,
  primaryKeys: string[]
): Promise<SyncResult> => {
  try {
    // Payload identifies the Primary Keys for the Upsert Logic
    const payload = {
      data: data,
      sheetName: sheetName,
      primaryKeys: primaryKeys
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      // Using text/plain avoids the preflight OPTIONS request which GAS doesn't handle well in simple mode
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 'error') {
        throw new Error(result.message);
    }

    return {
      success: true,
      message: result.message || "Sync complete",
      added: result.added,
      updated: result.updated
    };

  } catch (error: any) {
    console.error("Sync failed:", error);
    return {
      success: false,
      message: error.message || "Unknown error during sync"
    };
  }
};
