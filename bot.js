/* ─────────────────────────────
 * KIT BOT (Mineflayer)
 * Rewritten & Improved
 * ───────────────────────────── */

const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const tpsPlugin = require("mineflayer-tps")
const Vec3 = require("vec3")
const fs = require("fs")
const { Client, GatewayIntentBits } = require("discord.js")
const config = require("./config.json")

/* ───── KITS CONFIG (EDIT HERE) ─────
 * You ONLY add kits here.
 * !kit list updates automatically.
 */

const KITS = {
  starter: { chest: { x: 100, y: 64, z: -200 } },
  pvp: { chest: { x: 120, y: 65, z: -220 } },
  32k: { chest: { x: 150, y: 70, z: -260 } },
  illegals: { chest: { x: 180, y: 72, z: -300 } },
  books: { chest: { x: 210, y: 75, z: -330 } }
}

/* ───── RANDOM PUBLIC MESSAGES ─────
 * NO color codes
 * Starts with "> " (server green)
 */

const randomMessages = [
  "> free kits available",
  "> type !kit",
  "> automatic kit delivery",
  "> bot online",
  "> fast and simple"
]

/* ───── DISCORD CLIENT ───── */

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

function dcSend(message, channels) {
  for (const name of channels) {
    const ch = discord.channels.cache.find(c => c.name === name)
    if (ch) ch.send(message).catch(() => {})
  }
}

/* ───── BOT START ───── */

function startBot() {
  const bot = mineflayer.createBot(config.bot)
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(tpsPlugin)

  const movements = new Movements(bot)
  movements.canDig = false
  bot.pathfinder.setMovements(movements)

  let queue = []
  let busy = false
  let waitingTPA = false
  let lastUser = null
  let startPos = null

  const cooldowns = new Map()

  const isAdmin = name => config.admins.includes(name)

  bot.once("spawn", () => {
    dcSend("🟢 Bot online", config.discord.log_channels.status)
  })

  /* ───── CHAT HANDLER ───── */

  bot.on("chat", (username, message) => {
    if (username === bot.username) return
    if (message.startsWith("/msg")) return

    /* ─── !kit LIST ─── */
    if (message === "!kit") {
      return bot.chat(
        `&aAvailable kits: &f${Object.keys(KITS).join(", ")}`
      )
    }

    /* ─── !kit <name> ─── */
    if (message.startsWith("!kit ")) {
      const kitName = message.split(" ")[1]

      if (!KITS[kitName])
        return bot.chat("&cInvalid kit name")

      if (cooldowns.get(username) > Date.now())
        return bot.chat("&cYou are on cooldown")

      queue.push({ user: username, kit: kitName })
      cooldowns.set(
        username,
        Date.now() + config.cooldown_seconds * 1000
      )

      bot.chat(`&aKit &f${kitName} &aadded to queue`)
      dcSend(
        `📦 ${username} requested ${kitName}`,
        config.discord.log_channels.kits
      )
    }

    /* ─── INFO COMMANDS (10+) ─── */

    const commands = {
      "!help": "&aCommands: !kit, !kits, !tps, !players, !version, !server, !ping, !queue",
      "!kits": `&aKits: &f${Object.keys(KITS).join(", ")}`,
      "!tps": `&aTPS: &f${bot.getTps()}`,
      "!players": `&aPlayers: &f${Object.keys(bot.players).length}`,
      "!version": `&aBot version: &f${config.meta.version}`,
      "!server": `&aServer: &f${config.meta.server_name}`,
      "!author": `&aAuthor: &f${config.meta.author}`,
      "!queue": `&aQueue size: &f${queue.length}`
    }

    if (commands[message]) bot.chat(commands[message])

    /* ─── ADMIN MC COMMANDS ─── */

    if (message === "!stop") {
      if (!isAdmin(username))
        return bot.chat("&cYou cannot use admin commands")

      bot.chat("&cBot shutting down")
      process.exit(0)
    }
  })

  /* ───── KIT DELIVERY LOOP ───── */

  bot.on("physicsTick", async () => {
    if (busy || queue.length === 0) return
    busy = true

    const job = queue.shift()
    lastUser = job.user
    const chestPos = KITS[job.kit].chest

    try {
      const target = new Vec3(
        chestPos.x,
        chestPos.y,
        chestPos.z
      )

      /* ── WALK MAX 60 BLOCKS ── */
      if (bot.entity.position.distanceTo(target) > 60) {
        bot.chat("&cChest too far, cancelling")
        busy = false
        return
      }

      await bot.pathfinder.goto(
        new goals.GoalBlock(
          target.x,
          target.y,
          target.z
        )
      )

      const chestBlock = bot.findBlock({
        matching: b =>
          b.name === "chest" || b.name === "trapped_chest",
        maxDistance: 3
      })

      const chest = await bot.openContainer(chestBlock)

      /* ── TAKE RANDOM ITEM (SHULKER INCLUDED) ── */
      const items = chest.containerItems()
      const randomItem =
        items[Math.floor(Math.random() * items.length)]

      await chest.withdraw(randomItem.type, null, 1)
      chest.close()

      startPos = bot.entity.position.clone()
      waitingTPA = true
      bot.chat(`/tpa ${lastUser}`)

      const check = setInterval(() => {
        if (!waitingTPA) return clearInterval(check)

        if (bot.entity.position.distanceTo(startPos) > 4) {
          const p = bot.entity.position
          const dim = bot.game.dimension

          fs.appendFileSync(
            "coords.txt",
            `${p.x} ${p.y} ${p.z} | ${dim} | ${lastUser}\n`
          )

          dcSend(
            `📍 ${lastUser} @ ${dim}`,
            config.discord.log_channels.coords
          )

          bot.chat("/kill")
          waitingTPA = false
          busy = false
          clearInterval(check)
        }
      }, 1000)
    } catch {
      busy = false
    }
  })

  /* ───── RANDOM PUBLIC CHAT ───── */

  setInterval(() => {
    if (Object.keys(bot.players).length > 1)
      bot.chat(
        randomMessages[Math.floor(Math.random() * randomMessages.length)]
      )
  }, 30000)

  /* ───── AUTH ───── */

  bot.on("messagestr", msg => {
    if (msg.includes("/login"))
      bot.chat(`/login ${config.bot.password}`)
  })

  bot.on("end", () => setTimeout(startBot, 5000))
}

/* ───── DISCORD ADMIN ───── */

discord.on("messageCreate", msg => {
  if (msg.author.bot) return
  if (msg.channel.name !== config.discord.admin_channel) return
  if (msg.content === "!stop") process.exit(0)
})

discord.once("ready", () => startBot())
discord.login(config.discord.token)
