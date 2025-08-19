function transformGameToResultsRow(game, seasonId, weekStartDate, gameType) {
  const whiteUsername = game.white?.username || 'Anonymous';
  const blackUsername = game.black?.username || 'Anonymous';

  // Derive Tier and SeasonNumber from SeasonID (e.g., "13-standard-A")
  const seasonParts = seasonId ? seasonId.split('-') : [];
  const seasonNumber = seasonParts[0] || '';
  const tier = seasonParts[2] || '';

  // Generate schedule keys
  const scheduleKey1 = [seasonId, tier, weekStartDate, whiteUsername, blackUsername].join('|');
  const scheduleKey2 = [seasonId, tier, weekStartDate, blackUsername, whiteUsername].join('|');

  return [
    seasonId || '',           // SeasonID
    gameType || '',           // GameType (chess/chess960)
    weekStartDate || '',      // WeekStartDate
    game.uuid || '',          // GameID
    game.url || '',           // GameURL
    game.end_time ? new Date(game.end_time * 1000).toISOString() : '', // EndTime
    whiteUsername,            // WhiteUsername
    game.white?.rating || '', // WhiteRating
    game.white?.result || '', // WhiteResult
    blackUsername,            // BlackUsername
    game.black?.rating || '', // BlackRating
    game.black?.result || '', // BlackResult
    game.time_class || '',    // TimeClass
    game.time_control || '',  // TimeControl
    game.rated ? 'Yes' : 'No',// Rated
    game.pgn || '',           // PGN
    '',                       // WhiteUserHelper
    '',                       // BlackUserHelper
    tier,                     // TierHelper
    weekStartDate || '',      // WeekStartDateHelper
    scheduleKey1,             // ScheduleKey1
    scheduleKey2,             // ScheduleKey2
    seasonNumber,             // SeasonNumber
    tier,                     // Tier
    '',                       // P1Result
    '',                       // P2Result
    '',                       // WhiteDisplayName
    '',                       // BlackDisplayName
  ];
}

// Optional: transform for Lichess games if needed
function transformGameToRow(game) {
  const getResult = (playerColor) => {
    if (game.status === 'draw') return 'draw';
    return game.winner === playerColor ? 'win' : 'loss';
  };

  return [
    game.id || '',
    game.id ? `https://lichess.org/${game.id}` : '',
    game.createdAt ? new Date(game.createdAt).toISOString() : '',
    game.players?.white?.user?.name || 'Anonymous',
    game.players?.white?.rating || '',
    getResult('white'),
    game.players?.black?.user?.name || 'Anonymous',
    game.players?.black?.rating || '',
    getResult('black'),
    game.speed || '',
    game.clock ? `${game.clock.initial || 0}+${game.clock.increment || 0}` : '',
    game.rated ? 'Yes' : 'No',
    game.pgn || ''
  ];
}

module.exports = { 
  transformGameToResultsRow, 
  transformGameToRow 
};


// Optional: transform for Lichess games if needed
function transformGameToRow(game) {
  const getResult = (playerColor) => {
    if (game.status === 'draw') return 'draw';
    return game.winner === playerColor ? 'win' : 'loss';
  };

  return [
    game.id || '',
    game.id ? `https://lichess.org/${game.id}` : '',
    game.createdAt ? new Date(game.createdAt).toISOString() : '',
    game.players?.white?.user?.name || 'Anonymous',
    game.players?.white?.rating || '',
    getResult('white'),
    game.players?.black?.user?.name || 'Anonymous',
    game.players?.black?.rating || '',
    getResult('black'),
    game.speed || '',
    game.clock ? `${game.clock.initial || 0}+${game.clock.increment || 0}` : '',
    game.rated ? 'Yes' : 'No',
    game.pgn || ''
  ];
}

module.exports = { 
  transformGameToResultsRow, 
  transformGameToRow 
};
