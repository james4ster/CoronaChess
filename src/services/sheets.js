const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Use the service account JSON from env variable
async function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function readRange(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range,
  });
  return res.data.values;
}

async function writeRange(range, values) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return res.data;
}

// Append rows to a sheet
async function appendRows(range, values) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return res.data;
}

/**
 * Update checkmark cells in Schedule tab.
 * 
 * @param {Array<{row: number, value: string}>} updates - Array of objects containing
 *     row number (1-based sheet row, e.g. 2 for row 2) and value to write (e.g. "✓").
 */
async function updateScheduleCheckmarks(updates) {
  const sheets = await getSheetsClient();

  const data = updates.map(({ row, value }) => ({
    range: `Schedule!J${row}`, // Col J is checkmark column
    values: [[value]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });
}

module.exports = {
  readRange,
  writeRange,
  appendRows,
  updateScheduleCheckmarks,
};
