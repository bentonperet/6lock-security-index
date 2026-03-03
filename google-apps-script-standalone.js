// ============================================================
// Google Apps Script - 6lock PE Security Index Sheets Logger
// STANDALONE VERSION (deployed from personal Gmail account)
// ============================================================
// DEPLOYMENT INSTRUCTIONS:
// 1. Go to script.google.com (logged into benperet@gmail.com)
// 2. Click "New project"
// 3. Paste this entire file
// 4. Click Deploy > New deployment > Web app
//    - Execute as: Me
//    - Who has access: Anyone
//    - Click Deploy > copy the URL
// 5. Paste the URL into app.js CONFIG.sheetsWebhookUrl
//
// NOTE: The crossvine.ai sheet must be shared with benperet@gmail.com
// (Editor access) for this script to write to it.
// ============================================================

// Target spreadsheet on crossvine.ai (shared with benperet@gmail.com)
var SPREADSHEET_ID = '1AmTaaWVu5gpvR-AB-aWfnZYA_yy2it_Te69b33B4o_w';

// Shared secret - must match CONFIG.webhookToken in app.js
var VALID_TOKEN = '6lock-secidx-2026-pv8w3n';

var PARTIAL_SHEET_NAME = 'Partial Responses';

var PARTIAL_HEADERS = [
  'Session ID',
  'First Seen',
  'Last Updated',
  'Status',
  'Q1 - Wire Transfer Verification',
  'Q2 - Banking Detail Changes',
  'Q3 - Banking Info Storage',
  'Q4 - LP Authentication',
  'Q5 - Authorization & Separation',
  'Q6 - Capital Event Security',
  'Q7 - Communication Security',
  'Q8 - Incident Preparedness',
  'Score',
  'Grade',
  'Source'
];

var COMPLETE_HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Company',
  'Role',
  'Q1 - Wire Transfer Verification',
  'Q2 - Banking Detail Changes',
  'Q3 - Banking Info Storage',
  'Q4 - LP Authentication',
  'Q5 - Authorization & Separation',
  'Q6 - Capital Event Security',
  'Q7 - Communication Security',
  'Q8 - Incident Preparedness',
  'Score',
  'Grade',
  'Pillar Scores',
  'Mailing List',
  'Source'
];

// Strip formula injection characters from user input
function sanitize(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/^[=+\-@\t\r]+/, '');
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Token validation - reject requests without valid token
    if (data.token !== VALID_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'invalid token' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.isPartial === true) {
      return handlePartialSave(data);
    } else if (data.isPartial === false) {
      return handlePartialComplete(data);
    } else {
      return handleCompleteSubmission(data);
    }
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Upsert partial answers to "Partial Responses" sheet
function handlePartialSave(data) {
  var sheet = getOrCreatePartialSheet();
  var sessionId = data.sessionId;
  var now = new Date().toISOString();

  var answerValues = [];
  for (var i = 1; i <= 8; i++) {
    answerValues.push(sanitize(data['q' + i] || ''));
  }
  answerValues.push(data.score || 0);
  answerValues.push(sanitize(data.grade || ''));
  answerValues.push(sanitize(data.source || ''));

  // Look for existing row with this sessionId
  var lastRow = sheet.getLastRow();
  var rowIndex = -1;
  if (lastRow > 1) {
    var sessionCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < sessionCol.length; r++) {
      if (sessionCol[r][0] === sessionId) {
        rowIndex = r + 2;
        break;
      }
    }
  }

  if (rowIndex > 0) {
    // Update existing row
    sheet.getRange(rowIndex, 3).setValue(now); // Last Updated
    sheet.getRange(rowIndex, 4).setValue('partial'); // Status
    sheet.getRange(rowIndex, 5, 1, answerValues.length).setValues([answerValues]); // Q1-Q8 + Score + Grade
  } else {
    // Append new row
    sheet.appendRow([sessionId, now, now, 'partial'].concat(answerValues));
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', action: 'partial_saved' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Mark a partial session as completed
function handlePartialComplete(data) {
  var sheet = getOrCreatePartialSheet();
  var sessionId = data.sessionId;

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var sessionCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < sessionCol.length; r++) {
      if (sessionCol[r][0] === sessionId) {
        var rowIndex = r + 2;
        sheet.getRange(rowIndex, 3).setValue(new Date().toISOString()); // Last Updated
        sheet.getRange(rowIndex, 4).setValue('completed'); // Status
        break;
      }
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', action: 'partial_completed' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Append complete submission to the active sheet
function handleCompleteSubmission(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Complete Submissions') || ss.getSheets()[0];

  // Create header row if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COMPLETE_HEADERS);
    sheet.getRange(1, 1, 1, COMPLETE_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var answerValues = [];
  for (var i = 1; i <= 8; i++) {
    answerValues.push(sanitize(data['q' + i] || ''));
  }

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    sanitize(data.name || ''),
    sanitize(data.email || ''),
    sanitize(data.company || ''),
    sanitize(data.role || ''),
  ].concat(answerValues).concat([
    data.score || 0,
    sanitize(data.grade || ''),
    sanitize(data.pillarScores || ''),
    sanitize(data.mailingList || ''),
    sanitize(data.source || '')
  ]));

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get or auto-create the "Partial Responses" sheet with headers
function getOrCreatePartialSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(PARTIAL_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(PARTIAL_SHEET_NAME);
    sheet.appendRow(PARTIAL_HEADERS);
    sheet.getRange(1, 1, 1, PARTIAL_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}
