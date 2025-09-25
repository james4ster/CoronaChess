require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { getActiveSeasons } = require('./seasonUtils');
const { getCurrentWeekStartDate, getMatchupsForWeek } = require('./scheduleUtils');
const { transformGameToResultsRow } = require('./utils');
const { readRange, appendRows, updateScheduleCheckmarks } = require('./services/sheets');
const { getMonthlyGames } = require('./services/chesscom');
const { notifyCommissioner } = require('./notifications/commissioner');
const { notifyUsers } = require('./notifications/sendToDiscord');

const express = require('express');

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

async function run() {
  const allSeasons = await getActiveSeasons();
  if (!allSeasons || allSeasons.length === 0) {
    console.error('No active seasons found.');
    return;
  }

  // --- Read all players to map usernames -> display names
  const playersRows = await readRange('Players!A2:B'); // Column A = Username, B = DisplayName
  const usernameToDisplayName = new Map();
  playersRows.forEach(row => {
    const username = row[0]?.toLowerCase().trim();
    const displayName = row[1]?.trim();
    if (username && displayName) usernameToDisplayName.set(username, displayName);
  });

  for (const season of allSeasons) {
    const currentSeasonId = season.SeasonID;
    const currentGameType = season.GameType;

    const currentWeekStartDate = await getCurrentWeekStartDate(currentSeasonId, new Date());
    if (!currentWeekStartDate) {
      console.warn(`No valid current week start date found for SeasonID ${currentSeasonId}. Skipping.`);
      continue;
    }

    const scheduleForWeek = await getMatchupsForWeek(currentSeasonId, currentWeekStartDate);
    if (!scheduleForWeek || scheduleForWeek.length === 0) continue;

    const existingResultsRows = await readRange('Results!A2:H') || [];
    const existingGameIDs = new Set(
      existingResultsRows.map(r => {
        const seasonId = r[0] || '';
        const tier = r[1] || '';
        const weekStart = r[3] || '';
        const player1 = (r[4] || '').toLowerCase();
        const player2 = (r[5] || '').toLowerCase();
        return `${seasonId}|${tier}|${weekStart}|${player1}|${player2}`;
      })
    );

    function makeKeys(seasonId, tier, weekStart, white, black) {
      const p1 = white.toLowerCase();
      const p2 = black.toLowerCase();
      return [
        `${seasonId}|${tier}|${weekStart}|${p1}|${p2}`,
        `${seasonId}|${tier}|${weekStart}|${p2}|${p1}`
      ];
    }

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
        if (!err.response || err.response.status !== 404) {
          console.error(`Failed fetching games for ${username}:`, err.message);
        }
      }
    }

    const outputPath = path.join(dataDir, `games_${currentSeasonId}_${currentGameType}_${currentWeekStartDate}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allGames, null, 2));

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

    const scheduleRowsToCheck = scheduledGames
      .map(g => g._scheduleRowNumber)
      .filter(r => r != null);

    const scheduleValues = await readRange(`Schedule!J2:J`);
    const checkmarkMap = new Map();
    scheduleRowsToCheck.forEach(row => {
      const idx = row - 2;
      const val = scheduleValues[idx]?.[0] || '';
      checkmarkMap.set(row, val);
    });

    const newGames = scheduledGames.filter(game => {
      const keys = makeKeys(
        currentSeasonId,
        currentGameType,
        currentWeekStartDate,
        game.white.username,
        game.black.username
      );

      if (keys.some(k => existingGameIDs.has(k))) return false;

      const rowCheckmark = game._scheduleRowNumber ? checkmarkMap.get(game._scheduleRowNumber) : '';
      if (rowCheckmark === '✓') return false;

      keys.forEach(k => existingGameIDs.add(k));
      return true;
    });

    const resultsRows = newGames.map(game => {
      const row = transformGameToResultsRow(game, currentSeasonId, currentWeekStartDate, currentGameType);

      // --- Add DisplayNames for Results columns AC (28) and AD (29)
      row[28] = usernameToDisplayName.get(game.white.username?.toLowerCase()?.trim()) || game.white.username;
      row[29] = usernameToDisplayName.get(game.black.username?.toLowerCase()?.trim()) || game.black.username;

      return row;
    });

    if (resultsRows.length > 0) {
      await appendRows('Results!A3', resultsRows);
      console.log(`Appended ${resultsRows.length} new games for SeasonID ${currentSeasonId}, GameType ${currentGameType}.`);

      // --- NOTIFY DISCORD USERS FOR EACH GAME
      for (const game of newGames) {
        await notifyUsers(
          game,
          currentSeasonId,
          currentGameType,
          currentWeekStartDate,
          [
            process.env.JAMIE_DISCORD_ID,
            process.env.NATHAN_DISCORD_ID
          ]
        );
      }

      const checkmarkUpdates = newGames
        .filter(g => g._scheduleRowNumber)
        .map(g => ({ row: g._scheduleRowNumber, value: '✓' }));

      if (checkmarkUpdates.length > 0) await updateScheduleCheckmarks(checkmarkUpdates);
    } else {
      console.log(`No new games to append for SeasonID ${currentSeasonId}, GameType ${currentGameType}, Week Start ${currentWeekStartDate}.`);
    }

    notifyCommissioner(`Results updated for Season ${currentSeasonId} (${currentGameType}) Week ${currentWeekStartDate} with ${resultsRows.length} new games.`);
  }
}

// --- Express server block ---
const app = express();
app.get('/run', async (req, res) => {
  try {
    await run();
    res.status(200).send('Chess bot run complete');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error running chess bot');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
