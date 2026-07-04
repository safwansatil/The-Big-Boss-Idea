import './loadEnv'; // Must be first import to load root .env before others resolve
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { generateReply } from './ai';

const token = process.env.DISCORD_BOT_TOKEN;
const backendPort = process.env.BACKEND_PORT || 5000;
const backendUrl = `http://localhost:${backendPort}`;

if (!token) {
  console.error('[Bot] Error: DISCORD_BOT_TOKEN is not defined in the environment.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`===============================================`);
  console.log(`   DISCORD BOT IS ONLINE                       `);
  console.log(`   Logged in as: ${client.user?.tag}          `);
  console.log(`===============================================`);
});

client.on('messageCreate', async (message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const content = message.content.trim();

  // Command: !status
  if (content === '!status') {
    await handleStatus(message);
  }
  // Command: !room <name>
  else if (content.startsWith('!room')) {
    await handleRoom(message, content);
  }
  // Command: !usage
  else if (content === '!usage') {
    await handleUsage(message);
  }
});

/**
 * Handles !status command: Fetches all devices, computes counts, and generates AI reply.
 */
async function handleStatus(message: Message) {
  try {
    const res = await fetch(`${backendUrl}/api/devices`);
    if (!res.ok) throw new Error(`Backend returned status ${res.status}`);
    const devices = (await res.json()) as any[];

    // Structure room summary
    const roomSummary: Record<string, { fansOn: number; lightsOn: number; totalDevices: number }> = {
      'Drawing Room': { fansOn: 0, lightsOn: 0, totalDevices: 0 },
      'Work Room 1': { fansOn: 0, lightsOn: 0, totalDevices: 0 },
      'Work Room 2': { fansOn: 0, lightsOn: 0, totalDevices: 0 },
    };

    for (const d of devices) {
      const displayName = getRoomDisplayName(d.room);
      roomSummary[displayName].totalDevices++;
      if (d.status === 'on') {
        if (d.type === 'fan') roomSummary[displayName].fansOn++;
        if (d.type === 'light') roomSummary[displayName].lightsOn++;
      }
    }

    const systemPrompt = 
      `You are the friendly, slightly quirky AI energy assistant for 'The Big Boss Idea' office. ` +
      `Translate the raw device summary into a warm, natural, and conversational Discord message. ` +
      `Do not output markdown tables. Use bullets or text paragraphs. Be playful, use emojis, and comment on ` +
      `which rooms have devices left ON. Keep it under 150 words.`;

    const aiMessage = await generateReply(systemPrompt, { rooms: roomSummary });
    await message.reply(aiMessage);
  } catch (err) {
    console.error('[Bot] Error in !status command:', err);
    await message.reply('🤖 *Oh no! I couldn\'t fetch the device status from the energy server. Is the backend running?*');
  }
}

/**
 * Handles !room <name> command: Fetches devices filtered by room.
 */
async function handleRoom(message: Message, content: string) {
  const parts = content.split(' ');
  if (parts.length < 2) {
    await message.reply('🤖 *Usage:* `!room <drawing | work1 | work2>`');
    return;
  }

  const rawRoom = parts.slice(1).join(' ').toLowerCase().replace(/\s+/g, '');
  let roomKey = '';

  if (rawRoom.includes('drawing')) {
    roomKey = 'drawing';
  } else if (rawRoom.includes('work1') || (rawRoom.includes('work') && rawRoom.includes('1'))) {
    roomKey = 'work1';
  } else if (rawRoom.includes('work2') || (rawRoom.includes('work') && rawRoom.includes('2'))) {
    roomKey = 'work2';
  } else {
    await message.reply('🤖 *Unknown room.* Please use `drawing`, `work1`, or `work2`.');
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/api/rooms/${roomKey}`);
    if (!res.ok) throw new Error(`Backend returned status ${res.status}`);
    const devices = (await res.json()) as any[];

    const systemPrompt =
      `You are the friendly, slightly cheeky AI energy assistant for 'The Big Boss Idea' office. ` +
      `Translate this list of devices in ${getRoomDisplayName(roomKey)} into a conversational, fun update. ` +
      `If everything is off, praise the room occupants. If things are left on, make a playful, judgey remark. ` +
      `Keep it under 100 words.`;

    const aiMessage = await generateReply(systemPrompt, {
      roomName: getRoomDisplayName(roomKey),
      devices: devices.map(d => ({
        name: d.name,
        status: d.status,
        powerDraw: d.powerDraw,
        lastChanged: d.lastChanged
      }))
    });
    await message.reply(aiMessage);
  } catch (err) {
    console.error('[Bot] Error in !room command:', err);
    await message.reply('🤖 *Oh no! I couldn\'t fetch the room status from the energy server. Is the backend running?*');
  }
}

/**
 * Handles !usage command: Fetches energy usage, calculates estimated daily kWh, and generates AI reply.
 */
async function handleUsage(message: Message) {
  try {
    const res = await fetch(`${backendUrl}/api/usage`);
    if (!res.ok) throw new Error(`Backend returned status ${res.status}`);
    const usageData = (await res.json()) as any;

    const totalWatts = usageData.totalWatts;
    
    // Estimate today's kWh usage: assume current power draw has been constant for the hours elapsed since midnight.
    const now = new Date();
    const hoursElapsed = now.getHours() + now.getMinutes() / 60;
    // kWh = (Watts * hours) / 1000
    const todayKwhEstimate = Number(((totalWatts * hoursElapsed) / 1000).toFixed(2));

    const systemPrompt =
      `You are the friendly, opinionated AI energy assistant for 'The Big Boss Idea' office. ` +
      `Interpret the current power draw and the estimated daily usage (kWh). Provide a playful, conversational response. ` +
      `If usage is high (e.g. > 200W), warn the boss. If it's low, congratulate the team. Keep it under 100 words.`;

    const aiMessage = await generateReply(systemPrompt, {
      totalWatts,
      perRoom: usageData.perRoom,
      todayKwhEstimate,
      timeOfDay: now.toLocaleTimeString(),
    });

    await message.reply(aiMessage);
  } catch (err) {
    console.error('[Bot] Error in !usage command:', err);
    await message.reply('🤖 *Oh no! I couldn\'t fetch the energy usage stats. Is the backend running?*');
  }
}

function getRoomDisplayName(room: string): string {
  switch (room) {
    case 'drawing': return 'Drawing Room';
    case 'work1': return 'Work Room 1';
    case 'work2': return 'Work Room 2';
    default: return room;
  }
}

// Log in to Discord
client.login(token);
