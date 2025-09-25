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
  const weekStartStr = weekStart instanceof Date
    ? weekStart.toISOString().slice(0, 10)
    : weekStart;

  // Use API result directly
  const player1Result = game.white?.result || 'N/A';
  const player2Result = game.black?.result || 'N/A';

  const message = `♟️ Chess Score Update
Season: ${seasonId}
Game Type: ${gameType}
Week Start: ${weekStartStr}
Player 1: ${game.white.username} — ${player1Result}
Player 2: ${game.black.username} — ${player2Result}`;

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