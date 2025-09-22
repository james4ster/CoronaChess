function transformGameToResultsRow(game, seasonId, weekStartDate, gameType) {
  const whiteUsername = game.white?.username || 'Anonymous';
  const blackUsername = game.black?.username || 'Anonymous';

  const seasonParts = seasonId ? seasonId.split('-') : [];
  const seasonNumber = seasonParts[0] || '';
  const tier = seasonParts[2] || '';

  const scheduleKey1 = [seasonId, tier, weekStartDate, whiteUsername, blackUsername].join('|');
  const scheduleKey2 = [seasonId, tier, weekStartDate, blackUsername, whiteUsername].join('|');

  return [
    seasonId || '',           
    gameType || '',           
    weekStartDate || '',      
    game.uuid || '',          
    game.url || '',           
    game.end_time ? new Date(game.end_time * 1000).toISOString() : '', 
    whiteUsername,            
    game.white?.rating || '', 
    game.white?.result || '', 
    blackUsername,            
    game.black?.rating || '', 
    game.black?.result || '', 
    game.time_class || '',    
    game.time_control || '',  
    game.rated ? 'Yes' : 'No',
    game.pgn || '',           
    '',                       
    '',                       
    tier,                     
    weekStartDate || '',      
    scheduleKey1,             
    scheduleKey2,             
    seasonNumber,             
    tier,                     
    '',                       
    '',                       
    '',                       
    '',                       
  ];
}

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

module.exports = { transformGameToResultsRow, transformGameToRow };
