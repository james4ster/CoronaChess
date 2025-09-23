// debugRun.js
import 'dotenv/config';
import path from 'path';
import fs from 'fs';

import { getActiveSeasons } from './seasonUtils.js';
import { getCurrentWeekStartDate, getAllScheduledWeekStartDates } from './scheduleUtils.js';
import { getMonthlyGames } from './services/chesscom.js';

async function debug() {
  const allSeasons = await getActiveSeasons();
  console.log('Active seasons:', allSeasons);

  for (const season of allSeasons) {
    console.log(`\nSeasonID: ${season.SeasonID}, GameType: ${season.GameType}`);

    const currentWeekStart = await getCurrentWeekStartDate(season.SeasonID, new Date());
    console.log('Current week start date:', currentWeekStart);

    const allWeeks = await getAllScheduledWeekStartDates(season.SeasonID);
    console.log('All scheduled week start dates:', allWeeks);

    // Optionally check games for one user
    if (season.SeasonID === '14-standard-A') {
      const testUser = 'fgrrghg'; // replace with a username
      try {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const games = await getMonthlyGames(testUser, year, month);
        console.log(`Games fetched for ${testUser}:`, games);
      } catch (err) {
        console.error(`Failed fetching games for ${testUser}:`, err.message);
      }
    }
  }
}

debug();
