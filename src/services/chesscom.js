const axios = require('axios');

// Fetch games for a user for a given year and month
async function getMonthlyGames(username, year, month) {
  const url = `https://api.chess.com/pub/player/${username}/games/${year}/${String(month).padStart(2, '0')}`;
  const res = await axios.get(url);
  return res.data.games || [];
}

module.exports = { getMonthlyGames };
