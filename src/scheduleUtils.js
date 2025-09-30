const { readRange } = require('./services/sheets');

const SCHEDULE_RANGE = 'Schedule!A2:Z'; // adjust columns if needed

/**
 * Map a row array to a schedule object
 * Correct column mapping based on your Schedule tab:
 * 0: SeasonID
 * 1: GameType
 * 2: Tier
 * 3: WeekStart
 * 4: Player1 (display name)
 * 5: Player1Username (Chess.com username)
 * 6: Player2 (display name)
 * 7: Player2Username (Chess.com username)
 * 8: EarlyFlag
 * 9: ResultsFlag
 * 10: Notes
 */
function mapRowToScheduleObject(row, rowNumber) {
  return {
    rowNumber,
    SeasonID: row[0],
    GameType: row[1],
    Tier: row[2],
    WeekStart: row[3],
    Player1: row[4],           // display name
    Player1Username: row[5],   // Chess.com username
    Player2: row[6],           // display name
    Player2Username: row[7],   // Chess.com username
    EarlyFlag: row[8],
    ResultsFlag: row[9],
    Notes: row[10],
    // add other columns as needed
  };
}

function getWeekStartDateFromRow(row) {
  if (!row.WeekStart) return null;
  const d = new Date(row.WeekStart);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // always 'YYYY-MM-DD'
}

async function getScheduleForSeason(seasonId) {
  const rows = await readRange(SCHEDULE_RANGE);
  if (!rows) return [];
  return rows
    .map((r, idx) => mapRowToScheduleObject(r, idx + 2))
    .filter(r => String(r.SeasonID) === String(seasonId));
}

async function getMatchupsForWeek(seasonId, weekStartDate) {
  const schedule = await getScheduleForSeason(seasonId);
  return schedule.filter(row => getWeekStartDateFromRow(row) === weekStartDate);
}

async function getMatchupsForPlayer(seasonId, playerUsername) {
  const schedule = await getScheduleForSeason(seasonId);
  const lowerUsername = playerUsername.toLowerCase();
  return schedule.filter(row => {
    const p1 = (row.Player1Username || '').toLowerCase();
    const p2 = (row.Player2Username || '').toLowerCase();
    return p1 === lowerUsername || p2 === lowerUsername;
  });
}

async function getCompletedMatches(seasonId) {
  const schedule = await getScheduleForSeason(seasonId);
  return schedule.filter(row => row.GameID || row.ResultsFlag);
}

function getYearMonthFromDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date)) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

async function getWeekStartDate(seasonId, weekNumber) {
  const schedule = await getScheduleForSeason(seasonId);
  const weekRow = schedule.find(row => String(row.Week) === String(weekNumber));
  return weekRow ? getWeekStartDateFromRow(weekRow) : null;
}

async function getCurrentWeekStartDate(seasonId, referenceDate = new Date()) {
  const schedule = await getScheduleForSeason(seasonId);
  const refTime = referenceDate.getTime();

  const validWeeks = schedule.filter(row => {
    const ws = getWeekStartDateFromRow(row);
    if (!ws) return false;
    const weekTime = new Date(ws).getTime();
    return !isNaN(weekTime) && weekTime <= refTime;
  });

  if (!validWeeks.length) return null;

  const latestWeek = validWeeks.reduce((maxRow, curr) => {
    const currTime = new Date(getWeekStartDateFromRow(curr)).getTime();
    const maxTime = new Date(getWeekStartDateFromRow(maxRow)).getTime();
    return currTime > maxTime ? curr : maxRow;
  });

  return getWeekStartDateFromRow(latestWeek);
}

async function getAllScheduledWeekStartDates(seasonId) {
  const schedule = await getScheduleForSeason(seasonId);
  const dateSet = new Set();

  schedule.forEach(row => {
    const ws = getWeekStartDateFromRow(row);
    console.log('Row:', row, 'Parsed week start:', ws); // debug
    if (ws) dateSet.add(ws);
  });

  return [...dateSet].sort((a, b) => new Date(a) - new Date(b));
}

module.exports = {
  getScheduleForSeason,
  getMatchupsForWeek,
  getMatchupsForPlayer,
  getCompletedMatches,
  getYearMonthFromDate,
  getWeekStartDate,
  getCurrentWeekStartDate,
  getAllScheduledWeekStartDates,
};
