require('dotenv').config();
const fs = require('fs');
const { getActiveSeasons } = require('./seasonUtils');
const { getCurrentWeekStartDate, getMatchupsForWeek, getAllScheduledWeekStartDates } = require('./scheduleUtils');
const { transformGameToResultsRow } = require('./utils');
const { readRange, appendRows, updateScheduleCheckmarks } = require('./services/sheets');
const { getMonthlyGames } = require('./services/chesscom');
const { notifyCommissioner } = require('./notifications/commissioner');

const isBackfill = process.env.BACKFILL === 'true';
const backfillSeasonId = process.env.BACKFILL_SEASON_ID;

console.log('BACKFILL is:', process.env.BACKFILL);
console.log('BACKFILL_SEASON_ID is:', process.env.BACKFILL_SEASON_ID);

async function run() {
  const allSeasons = await getActiveSeasons();
  if (!allSeasons || allSeasons.length === 0) return console.error('No active seasons found.');

  let seasonsToProcess = [];

  if (isBackfill && backfillSeasonId) {
    const targetSeason = allSeasons.find(s => String(s.SeasonID) === backfillSeasonId);
    if (!targetSeason) return console.error(`SeasonID ${backfillSeasonId} not found.`);
    seasonsToProcess = [targetSeason];
  } else {
    seasonsToProcess = allSeasons;
  }

  for (const season of seasonsToProcess) {
    const currentSeasonId = season.SeasonID;
    const currentGameType = season.GameType;

    let weekStartDates = [];
    if (isBackfill) {
      weekStartDates = await getAllScheduledWeekStartDates(currentSeasonId);
      if (!weekStartDates.length) {
        console.warn(`No scheduled weeks found for backfill SeasonID ${currentSeasonId}. Skipping.`);
        continue;
      }
    } else {
      const currentWeekStartDate = await getCurrentWeekStartDate(currentSeasonId, new Date());
      if (!currentWeekStartDate) {
        console.warn(`No valid current week start date found for SeasonID ${currentSeasonId}. Skipping.`);
        continue;
      }
      weekStartDates = [currentWeekStartDate];
    }

    for (const currentWeekStartDate of weekStartDates) {
      const scheduleForWeek = await getMatchupsForWeek(currentSeasonId, currentWeekStartDate);
      if (!scheduleForWeek || scheduleForWeek.length === 0) continue;

      const existingResultsRows = await readRange('Results!A2:H') || [];
      const existingGameIDs = new Set(
        existingResultsRows
          .map(r => `${(r[2] || '').toLowerCase()}|${r[0] || ''}|${r[1] || ''}`)
          .filter(id => id && id.trim() !== '')
      );

      const scheduledMatchups = new Set();
      const scheduledUsernames = new Set();

      scheduleForWeek.forEach(match => {
        const p1 = match.Player1Username?.toLowerCase().trim();
        const p2 = match.Player2Username?.toLowerCase().trim();
        if (p1 && p2) {
          scheduledMatchups.add([p1, p2].sort().join('|'));
          scheduledUsernames.add(p1);
          scheduledUsernames.add(p2);
        }
      });

      const allGames = [];
      for (const username of scheduledUsernames) {
        try {
          const date = new Date(currentWeekStartDate);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthsToFetch = [
            { year, month },
            { year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1 }
          ];

          for (const m of monthsToFetch) {
            const games = await getMonthlyGames(username, m.year, m.month);
            const filtered = games.filter(g => {
              const white = g.white?.username?.toLowerCase().trim();
              const black = g.black?.username?.toLowerCase().trim();
              const rulesMatch =
                (currentGameType === 'chess' && g.rules === 'chess') ||
                (currentGameType === 'chess960' && g.rules === 'chess960');
              return white && black && scheduledUsernames.has(white) && scheduledUsernames.has(black) && rulesMatch;
            });
            allGames.push(...filtered);
          }
        } catch (err) {
          console.error(`Failed fetching games for ${username}:`, err.message);
        }
      }

      fs.writeFileSync(`./data/games_${currentSeasonId}_${currentGameType}_${currentWeekStartDate}.json`, JSON.stringify(allGames, null, 2));

      const matchupToFirstGame = new Map();
      for (const game of allGames) {
        const gameDate = game.end_time ? new Date(game.end_time * 1000) : null;
        if (!gameDate) continue;

        const white = game.white?.username?.toLowerCase().trim();
        const black = game.black?.username?.toLowerCase().trim();
        if (!white || !black) continue;

        const sortedPlayers = [white, black].sort();
        const matchupKey = sortedPlayers.join('|');
        if (!scheduledMatchups.has(matchupKey)) continue;

        const scheduledMatch = scheduleForWeek.find(match =>
          [match.Player1Username?.toLowerCase().trim(), match.Player2Username?.toLowerCase().trim()].sort().join('|') === matchupKey
        );
        if (!scheduledMatch) continue;

        const earlyFlag = (scheduledMatch.EarlyFlag || '').toUpperCase() === 'Y';
        const key = `${matchupKey}|${new Date(currentWeekStartDate).toISOString().slice(0, 10)}`;
        const existing = matchupToFirstGame.get(key);

        if (earlyFlag) {
          if (gameDate >= new Date(currentWeekStartDate)) continue;
          if (!existing || gameDate > new Date(existing.end_time * 1000)) {
            matchupToFirstGame.set(key, game);
            game._scheduleRowNumber = scheduledMatch.rowNumber;
          }
        } else {
          if (gameDate < new Date(currentWeekStartDate)) continue;
          if (!existing || gameDate < new Date(existing.end_time * 1000)) {
            matchupToFirstGame.set(key, game);
            game._scheduleRowNumber = scheduledMatch.rowNumber;
          }
        }
      }

      const scheduledGames = Array.from(matchupToFirstGame.values());

      const newGames = scheduledGames.filter(game => {
        const dedupKey = `${(game.uuid || '').trim().toLowerCase()}|${currentSeasonId}|${currentGameType}`;
        if (existingGameIDs.has(dedupKey)) return false;
        existingGameIDs.add(dedupKey);
        return true;
      });

      const resultsRows = newGames.map(game => {
        return transformGameToResultsRow(game, currentSeasonId, currentWeekStartDate, currentGameType);
      });

      if (resultsRows.length > 0) {
        await appendRows('Results!A3', resultsRows);
        console.log(`Appended ${resultsRows.length} new games to Results tab for SeasonID ${currentSeasonId}, GameType ${currentGameType}.`);

        const checkmarkUpdates = newGames
          .filter(g => g._scheduleRowNumber)
          .map(g => ({ row: g._scheduleRowNumber, value: '✓' }));

        if (checkmarkUpdates.length > 0) {
          await updateScheduleCheckmarks(checkmarkUpdates);
          console.log(`Updated checkmarks on Schedule tab for ${checkmarkUpdates.length} games.`);
        }
      } else {
        console.log(`No new games to append for SeasonID ${currentSeasonId}, GameType ${currentGameType}, Week Start ${currentWeekStartDate}.`);
      }

      notifyCommissioner(`Results updated for Season ${currentSeasonId} (${currentGameType}) Week ${currentWeekStartDate} with ${resultsRows.length} new games.`);
    }
  }
}

run().catch(console.error);