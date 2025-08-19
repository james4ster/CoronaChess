require('dotenv').config();

// Use your helper from seasonUtils to map sheet rows into objects
const { getSheetRows } = require('./seasonUtils');

// Include row 1 so headers are read correctly
const SEASONS_RANGE = 'Seasons!A1:Z';

async function debugSeasons() {
  // Read rows as objects
  const rows = await getSheetRows(SEASONS_RANGE);

  console.log(`Total rows read: ${rows.length}`);
  console.log('--- All rows ---');
  rows.forEach((row, idx) => {
    console.log(idx + 2, row); // +2 because sheet rows start at 2
  });

  const activeSeasons = rows.filter(season => {
    const active = season['Active?'];
    return active && (active.toString().toLowerCase() === 'yes' || active.toString().toLowerCase() === 'true');
  });

  console.log('--- Active seasons ---');
  if (activeSeasons.length === 0) {
    console.log('No active seasons found.');
  } else {
    activeSeasons.forEach(season => {
      console.log(season.SeasonID, season.SeasonNumber, season['Active?']);
    });
  }
}

debugSeasons().catch(console.error);
