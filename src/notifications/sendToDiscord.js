const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel] // Needed for DMs
});

client.once('ready', () => {
  console.log(`Discord client logged in as ${client.user.tag}`);
});

client.login(process.env.CHESS_BOT_DISCORD_TOKEN);

/**
 * Send a DM to one or more users with game details
 * @param {Object} game - the game object (white/black usernames, scores, result)
 * @param {string} seasonId 
 * @param {string} gameType 
 * @param {string|Date} weekStart
 * @param {string[]} discordUserIds - array of Discord IDs to notify
 */
async function notifyUsers(game, seasonId, gameType, weekStart, discordUserIds) {
  const player1Name = usernameToDisplayName.get(game.white.username.toLowerCase()) || game.white.username;
  const player2Name = usernameToDisplayName.get(game.black.username.toLowerCase()) || game.black.username;

  const weekStartStr = weekStart instanceof Date
    ? weekStart.toISOString().slice(0, 10)
    : weekStart;

  const message = `♟️ **Chess Result**
Season: ${seasonId}
Game Type: ${gameType}
Week Start: ${weekStartStr}
Player 1: ${player1Name} — ${game.white.result || 'N/A'}
Player 2: ${player2Name} — ${game.black.result || 'N/A'}`;

  for (const id of discordUserIds) {
    try {
      const user = await client.users.fetch(id);
      if (user) await user.send(message);
    } catch (err) {
      console.error(`Failed to send DM to ${id}:`, err.message);
    }
  }
}


module.exports = { notifyUsers, client };
