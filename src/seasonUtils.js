const { readRange } = require('./services/sheets');

const SCHEDULE_RANGE = 'Schedule!A2:Z';
const SEASONS_RANGE = 'Seasons!A1:Z';

/**
 * Map a row array to a sheet object using headers from the first row
 * @param {Array} row
 * @param {Array} headers
 * @param {number} rowNumber
 */
function mapRowToObject(row, headers, rowNumber) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i];
  });
  obj.rowNumber = rowNumber;
  return obj;
}

/**
 * Fetch all rows from a sheet and return as array of objects
 * @param {string} range
 */
async function getSheetRows(range) {
  const rows = await readRange(range);
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];       // first row = actual headers
  const dataRows = rows.slice(1); // rest = data
  return dataRows.map((r, idx) => mapRowToObject(r, headers, idx + 2));
}

/**
 * Finds the earliest matchup in the schedule for two players on or before a given date.
 * @param {string|number} seasonId
 * @param {string} tier
 * @param {string} player1
 * @param {string} player2
 * @param {string} resultDateStr - Date string of the game result (ISO or similar)
 * @returns {Promise<Object|null>} The schedule row object of earliest matchup or null if none found
 */
async function findScheduledMatchupDate(seasonId, tier, player1, player2, resultDateStr) {
  const rows = await getSheetRows(SCHEDULE_RANGE);
  const resultDate = new Date(resultDateStr);
  let matchDates = [];

  for (const row of rows) {
    const rowSeason = parseInt(row['SeasonID']);
    const rowTier = row['Tier'];
    const rowPlayer1 = row['Player1']?.trim();
    const rowPlayer2 = row['Player2']?.trim();
    const weekStartStr = row['WeekStart'];
    const weekStart = new Date(weekStartStr);

    const isMatchup =
      (rowPlayer1 === player1 && rowPlayer2 === player2) ||
      (rowPlayer1 === player2 && rowPlayer2 === player1);

    if (
      rowSeason === parseInt(seasonId) &&
      rowTier === tier &&
      isMatchup &&
      weekStart <= resultDate
    ) {
      matchDates.push({ weekStart, row });
    }
  }

  if (matchDates.length === 0) return null;

  // Sort ascending by weekStart, return earliest
  matchDates.sort((a, b) => a.weekStart - b.weekStart);
  return matchDates[0].row;
}

/**
 * Get the currently active seasons (Active? column should be 'Yes' or 'TRUE')
 * @returns {Promise<Array>} active season row objects
 */
async function getActiveSeasons() {
  const rows = await getSheetRows(SEASONS_RANGE);
  return rows.filter(season => {
    const active = season['Active?'];
    return active && (active.toString().toLowerCase() === 'yes' || active.toString().toLowerCase() === 'true');
  });
}

module.exports = {
  findScheduledMatchupDate,
  getActiveSeasons,
  getSheetRows
};