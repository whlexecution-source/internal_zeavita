/**
 * Universal Google Apps Script for Zeavita ETL
 * 
 * This script handles:
 * 1. doPost: Upserting data (Sales, Customer, Anomalies, Logs)
 * 2. doGet: Reading data (Reference Data)
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this entire code into Code.gs.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Description: "v1".
 * 7. Execute as: "Me".
 * 8. Who has access: "Anyone" (IMPORTANT).
 * 9. Click "Deploy" and copy the Web App URL.
 * 10. Paste the URL into the Zeavita ETL Settings.
 * 
 * Repeat this for each spreadsheet if you are using multiple (e.g., one for Sales, one for Logs).
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheetName;
    var data = payload.data; // Array of objects
    var primaryKeys = payload.primaryKeys; // Array of strings
    var mode = payload.mode || "upsert"; // "upsert" (default) or "overwrite"

    if (!data || data.length === 0) {
      if (mode === "overwrite") {
        // If overwrite mode and no data, clear the sheet (except headers if you want, but usually overwrite implies replacing content)
        // Let's keep headers if possible, or just clear content.
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName(sheetName);
        if (sheet) {
           var lastRow = sheet.getLastRow();
           if (lastRow > 1) {
             sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
           }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "message": "No data to sync",
        "added": 0,
        "updated": 0
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // 1. Get Headers
    var lastRow = sheet.getLastRow();
    var headers = [];
    
    // If overwrite mode, clear existing data first
    if (mode === "overwrite") {
       sheet.clear();
       SpreadsheetApp.flush();
       lastRow = 0;
    }

    if (lastRow === 0) {
      // New sheet, create headers from first data row
      headers = Object.keys(data[0]);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      SpreadsheetApp.flush(); // Ensure headers are written
    } else {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // Map headers to column indices
    var headerMap = {};
    headers.forEach(function(h, i) {
      headerMap[h] = i;
    });

    // Check for new columns in incoming data and add them if missing
    var incomingKeys = Object.keys(data[0]);
    var newColumns = [];
    incomingKeys.forEach(function(k) {
      if (!headerMap.hasOwnProperty(k)) {
        newColumns.push(k);
        headers.push(k);
        headerMap[k] = headers.length - 1;
      }
    });

    if (newColumns.length > 0) {
      sheet.getRange(1, headers.length - newColumns.length + 1, 1, newColumns.length).setValues([newColumns]);
    }

    // 2. Read Existing Data for Upsert
    var existingData = [];
    if (lastRow > 1) {
      existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    }

    // Build Map of Primary Key -> Row Index (in existingData array)
    var pkMap = {};
    existingData.forEach(function(row, index) {
      var pkValue = primaryKeys.map(function(k) {
        var colIdx = headerMap[k];
        return row[colIdx];
      }).join("|");
      pkMap[pkValue] = index;
    });

    // 3. Process Incoming Data
    var rowsToAdd = [];
    var updatedCount = 0;
    var addedCount = 0;

    data.forEach(function(rowObj) {
      var pkValue = primaryKeys.map(function(k) {
        return rowObj[k];
      }).join("|");

      // Prepare row array based on headers
      var rowArray = headers.map(function(h) {
        return rowObj[h] !== undefined ? rowObj[h] : "";
      });

      if (pkMap.hasOwnProperty(pkValue)) {
        // Update existing row
        var rowIndex = pkMap[pkValue];
        existingData[rowIndex] = rowArray;
        updatedCount++;
      } else {
        // Add new row
        rowsToAdd.push(rowArray);
        // Add to map to prevent duplicates within the same batch
        pkMap[pkValue] = existingData.length + rowsToAdd.length - 1; 
        addedCount++;
      }
    });

    // 4. Write Data Back
    // Write updated existing data
    if (existingData.length > 0) {
      sheet.getRange(2, 1, existingData.length, headers.length).setValues(existingData);
    }

    // Append new rows
    if (rowsToAdd.length > 0) {
      sheet.getRange(existingData.length + 2, 1, rowsToAdd.length, headers.length).setValues(rowsToAdd);
    }

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Sync successful",
      "added": addedCount,
      "updated": updatedCount
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var action = e.parameter.action;
    var sheetName = e.parameter.sheetName;

    if (action !== "read") {
      throw new Error("Invalid action. Only 'read' is supported via GET.");
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error("Sheet '" + sheetName + "' not found.");
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < 2) {
       return ContentService.createTextOutput(JSON.stringify({
        "status": "success",
        "data": []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var range = sheet.getRange(1, 1, lastRow, lastCol);
    var values = range.getValues();
    var headers = values[0];
    var dataRows = values.slice(1);

    var result = dataRows.map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = row[i];
      });
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "data": result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
