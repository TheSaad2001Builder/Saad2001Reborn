/* ─────────────────────────────
 * Saad2001Reborn Bot
 * Full Professional Bot.js
 * ───────────────────────────── */

const mineflayer = require('mineflayer');
const tpsPlugin = require('mineflayer-tps')(mineflayer);
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const Vec3 = require('vec3').Vec3;
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

/* ───────── DISCORD CLIENT ───────── */
const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

async function sendDiscordMessage(message, channels) {
    for (const name of channels) {
        const ch = discord.channels.cache.find(c => c.name === name && c.isTextBased());
        if (ch) await ch.send(message).catch(() => {});
    }
}

/* ───────── KITS CONFIG ───────── */
// Add all kits with coordinates
const KITS = {
    survival: { chest: { x: 100, y: 64, z: -200 }, msgName: 'Survival Kit' },
    pvp: { chest: { x: 120, y: 65, z: -220 }, msgName: 'PvP Kit' },
    illegal: { chest: { x: 140, y: 66, z: -240 }, msgName: 'Illegal Kit' },
    redstone: { chest: { x: 160, y: 67, z: -260 }, msgName: 'Redstone Kit' },
    raid: { chest: { x: 180, y: 68, z: -280 }, msgName: 'Raid Kit' },
    // Add up to 100 kits here with coords and friendly name
};

/* ───────── RANDOM CHAT MESSAGES ───────── */
const randomMessages = [
    "Hello {player}, use !kit to get amazing kits!",
    "Bot reborn! Type !help to see all commands.",
    "Join our Discord group for news and updates!",
    "Saad2001Reborn is now online and ready to serve!",
    "Free kits available! Type !kit"
];

/* ───────── START BOT FUNCTION ───────── */
function startBot() {
    const bot = mineflayer.createBot(config.bot);
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(tpsPlugin);

    const movements = new Movements(bot);
    movements.canDig = false;
    bot.pathfinder.setMovements(movements);

    let queue = [];
    let busy = false;
    let waitingTPA = false;
    let lastUser = null;
    let startPos = null;
    const cooldowns = new Map();

    const isAdmin = name => config.admins.includes(name);

    /* ───────── BOT SPAWN ───────── */
    bot.once('spawn', () => {
        sendDiscordMessage('🟢 Saad2001Reborn is online!', config.discord.log_channels.status);
    });

    /* ───────── CHAT HANDLER ───────── */
    bot.on('chat', (username, message) => {
        if (username === bot.username) return;

        // --- KIT LIST ---
        if (message === '!kit') {
            bot.chat(`/msg ${username} &aHere are all the kits Saad2001B0T has to offer: ${Object.keys(KITS).map(k=>KITS[k].msgName).join(', ')}. Join our Discord for news!`);
        }

        // --- KIT REQUEST ---
        if (message.startsWith('!kit ')) {
            const kitName = message.split(' ')[1];
            if (!KITS[kitName]) return bot.chat(`/msg ${username} &cInvalid kit name`);

            if (cooldowns.get(username) > Date.now()) return bot.chat(`/msg ${username} &cYou're on cooldown!`);

            queue.push({ user: username, kit: kitName });
            cooldowns.set(username, Date.now() + config.cooldown_seconds * 1000);
            bot.chat(`/msg ${username} &aKit ${KITS[kitName].msgName} added to the queue!`);
            sendDiscordMessage(`📦 ${username} requested ${KITS[kitName].msgName}`, config.discord.log_channels.kits);
        }

        // --- BASIC COMMANDS ---
        const commands = {
            '!help': '&aCommands: !kit, !kits, !tps, !players, !version, !server, !queue',
            '!kits': `&aKits: &f${Object.keys(KITS).map(k=>KITS[k].msgName).join(', ')}`,
            '!tps': `&aTPS: &f${bot.getTps()}`,
            '!players': `&aPlayers: &f${Object.keys(bot.players).length}`,
            '!version': `&aBot version: &f${config.meta.version}`,
            '!server': `&aServer: &f${config.meta.server_name}`,
            '!queue': `&aQueue size: &f${queue.length}`,
        };
        if (commands[message]) bot.chat(`/msg ${username} ${commands[message]}`);

        // --- ADMIN COMMANDS ---
        if (message === '!stop' && isAdmin(username)) {
            bot.chat(`/msg ${username} &cShutting down`);
            process.exit(0);
        }

        // --- RANDOM FUN COMMANDS ---
        if (message.startsWith('!ping')) bot.chat(`/msg ${username} Your ping: ${bot.players[username]?.ping || 'N/A'} ms`);
        if (message.startsWith('!discord')) bot.chat(`/msg ${username} Join our Discord: ${config.discord.invite_link}`);
        if (message.startsWith('!hello')) bot.chat(`/msg ${username} Hello ${username}! Welcome to Saad2001Reborn Bot!`);
    });

    /* ───────── KIT DELIVERY LOOP ───────── */
    bot.on('physicsTick', async () => {
        if (busy || queue.length === 0) return;
        busy = true;

        const job = queue.shift();
        lastUser = job.user;
        const chestPos = KITS[job.kit].chest;
        const target = new Vec3(chestPos.x, chestPos.y, chestPos.z);

        try {
            if (bot.entity.position.distanceTo(target) > 60) {
                bot.chat(`/msg ${lastUser} &cChest too far, cancelling`);
                busy = false;
                return;
            }

            await bot.pathfinder.goto(new goals.GoalBlock(target.x, target.y, target.z));
            const chestBlock = bot.findBlock({ matching: b => b.name === 'chest' || b.name === 'trapped_chest', maxDistance: 3 });
            const chest = await bot.openContainer(chestBlock);
            const items = chest.containerItems();
            const randomItem = items[Math.floor(Math.random() * items.length)];
            await chest.withdraw(randomItem.type, null, 1);
            chest.close();

            startPos = bot.entity.position.clone();
            waitingTPA = true;
            bot.chat(`/tpa ${lastUser}`);

            const check = setInterval(() => {
                if (!waitingTPA) return clearInterval(check);
                if (bot.entity.position.distanceTo(startPos) > 4) {
                    const p = bot.entity.position;
                    const dim = bot.game.dimension;
                    fs.appendFileSync('coords.txt', `${p.x} ${p.y} ${p.z} | ${dim} | ${lastUser}\n`);
                    sendDiscordMessage(`📍 ${lastUser} @ ${dim}`, config.discord.log_channels.coords);
                    bot.chat('/kill');
                    waitingTPA = false;
                    busy = false;
                    clearInterval(check);
                }
            }, 1000);
        } catch {
            busy = false;
        }
    });

    /* ───────── RANDOM CHAT MESSAGES ───────── */
    setInterval(() => {
        const players = Object.keys(bot.players).filter(p => p !== bot.username);
        if (players.length > 0) {
            const player = players[Math.floor(Math.random() * players.length)];
            const msg = randomMessages[Math.floor(Math.random() * randomMessages.length)].replace('{player}', player);
            bot.chat(msg);
        }
    }, 30000);

    /* ───────── LOGIN / REGISTER ───────── */
    bot.on('messagestr', msg => {
        if (msg.includes('/register')) bot.chat(`/register ${config.bot.password} ${config.bot.password}`);
        if (msg.includes('/login')) bot.chat(`/login ${config.bot.password}`);
    });

    /* ───────── BOT RECONNECT ───────── */
    bot.on('end', () => setTimeout(startBot, 5000));
}

/* ───────── DISCORD ADMIN COMMANDS ───────── */
discord.on('messageCreate', msg => {
    if (msg.author.bot) return;
    if (msg.channel.name !== config.discord.admin_channel) return;
    if (msg.content === '/stop') process.exit(0);
});

/* ───────── START BOT ───────── */
discord.once('ready', () => startBot());
discord.login(config.discord.token);
