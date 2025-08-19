/*============
ORIGINAL STANDINGS LOGIC BUT GOING TO USE GOOGLE SHEETS TO SHOW THE STANDINGS AND NOT THIS
============*/

/*

function calculateStandings(games, playersMap = {}, seasonFilter = null, tierFilter = null) {
  const stats = {};

  games.forEach(game => {
    const season = game.season || null;
    if (seasonFilter && season !== seasonFilter) return;

    const white = game.white.username.toLowerCase();
    const black = game.black.username.toLowerCase();

    const whiteTier = playersMap[white]?.tier || '';
    const blackTier = playersMap[black]?.tier || '';

    if (tierFilter && whiteTier !== tierFilter && blackTier !== tierFilter) return;

    const winner = game.white.result === 'win' ? white
      : game.black.result === 'win' ? black
      : 'draw';

    [white, black].forEach(player => {
      if (!stats[player]) {
        stats[player] = { W: 0, L: 0, D: 0, Points: 0, Games: 0 };
      }
    });

    stats[white].Games++;
    stats[black].Games++;

    if (winner === 'draw') {
      stats[white].D++;
      stats[black].D++;
      stats[white].Points += 0.5;
      stats[black].Points += 0.5;
    } else {
      stats[winner].W++;
      const loser = winner === white ? black : white;
      stats[loser].L++;
      stats[winner].Points += 1;
    }
  });

  return stats;
}

module.exports = { calculateStandings };
*/