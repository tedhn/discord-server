// Registers the slash commands with Discord. Run once after changing them:
//   DISCORD_TOKEN=... DISCORD_APP_ID=... npm run register
// Add DISCORD_GUILD_ID to register in a single server (updates instantly,
// instead of the ~1h propagation for global commands).

const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !APP_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_APP_ID env var.');
  process.exit(1);
}

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
    type: 1,
  },
  {
    name: 'echo',
    description: 'Repeats your text back to you',
    type: 1,
    options: [
      {
        name: 'text',
        description: 'What to repeat',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${APP_ID}/commands`;

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    authorization: `Bot ${TOKEN}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(commands),
});

const body = await res.text();

if (!res.ok) {
  console.error(`Registration failed (${res.status}):`, body);
  process.exit(1);
}

console.log(`Registered ${commands.length} command(s) ${GUILD_ID ? `in guild ${GUILD_ID}` : 'globally'}.`);
