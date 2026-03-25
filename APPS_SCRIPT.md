
# Google Apps Script Code

Copy the code below into your Google Sheet's Apps Script Editor (Extensions > Apps Script).

File: `Code.gs`

```javascript
/**
 * Handle POST requests from the React App
 */
function doPost(e) {
  try {
    // 1. Parse Data
    var payload = JSON.parse(e.postData.contents);
    var rows = payload.data; 
    var sheetName = payload.sheetName || "sales";
    var primaryKeys = payload.primaryKeys || ['entry_date', 'store', 'sku']; 

    if (!rows || rows.length === 0) {
      return response({ status: 'success', message: 'No data to sync', added: 0, updated: 0 });
    }

    // 2. Open Sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    // Create sheet if not exists
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // 3. Handle Headers
    var lastRow = sheet.getLastRow();
    var existingData = [];
    var headers = [];
    
    if (lastRow > 0) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (lastRow > 1) {
        // Read all existing data
        existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      }
    } else {
      // If sheet is empty, create headers from the first row of incoming data
      headers = Object.keys(rows[0]);
      sheet.appendRow(headers);
    }

    // Map headers to column indices
    var headerMap = {};
    headers.forEach(function(h, i) { headerMap[h] = i; });

    // 4. Build Index of Existing Data for Uniqueness Check
    // Key = Join values of primary keys (entry_date_|_store_|_sku)
    var existingIndexMap = {}; 
    
    // Helper to build a unique string key
    var buildKey = function(rowObjOrArray, isArray) {
      return primaryKeys.map(function(pk) {
        if (isArray) {
           var idx = headerMap[pk];
           return (idx !== undefined) ? String(rowObjOrArray[idx]) : "null";
        } else {
           // We try to match the key loosely since Excel keys might vary slightly or be flexible
           return String(rowObjOrArray[pk] || "null");
        }
      }).join("_|_");
    };

    existingData.forEach(function(row, i) {
      var key = buildKey(row, true);
      existingIndexMap[key] = i; // Store 0-based index of existingData array
    });

    // 5. Process Incoming Data
    var rowsToAppend = [];
    var rowsToDelete = []; // To move updated rows to bottom, we delete old and append new
    var addedCount = 0;
    var updatedCount = 0;

    rows.forEach(function(incomingRow) {
      var key = buildKey(incomingRow, false);
      
      // Convert incoming object to an array matching the header order
      var rowArray = headers.map(function(h) {
        return incomingRow[h] || "";
      });

      if (existingIndexMap.hasOwnProperty(key)) {
        // --- UPDATE LOGIC: MOVE TO BOTTOM ---
        // 1. Identify old row to delete
        var existingRowIdx = existingIndexMap[key];
        // actualSheetRow = 1 (header) + 1 (start index) + existingRowIdx
        var actualSheetRow = existingRowIdx + 2; 
        
        rowsToDelete.push(actualSheetRow);
        
        // 2. Add new version to append list
        rowsToAppend.push(rowArray);
        updatedCount++;
      } else {
        // --- NEW ENTRY ---
        rowsToAppend.push(rowArray);
        addedCount++;
      }
    });

    // 6. Execute Deletions (Must be done from bottom up to avoid index shifts)
    if (rowsToDelete.length > 0) {
      // Sort descending
      rowsToDelete.sort(function(a, b){ return b - a; });
      // Delete rows
      rowsToDelete.forEach(function(rowNum) {
        sheet.deleteRow(rowNum);
      });
    }

    // 7. Batch Append New (and Updated) Rows at the end
    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    return response({ 
      status: 'success', 
      message: 'Sync successful', 
      added: addedCount, 
      updated: updatedCount 
    });

  } catch (err) {
    return response({ status: 'error', message: err.toString() });
  }
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```
