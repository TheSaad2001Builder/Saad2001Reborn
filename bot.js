/* ─────────────────────────────
 * SAAD2001 REBORN BOT (Mineflayer)
 * Rewritten & Pro Version
 * ───────────────────────────── */

const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const tpsPlugin = require("mineflayer-tps")
const Vec3 = require("vec3")
const fs = require("fs")
const { Client, GatewayIntentBits } = require("discord.js")
const config = require("./config.json")

/* ───── KITS CONFIG ───── */
const KITS = {
  starter: { chest: { x: 100, y: 64, z: -200 } },
  pvp: { chest: { x: 120, y: 65, z: -220 } },
  "32k": { chest: { x: 150, y: 70, z: -260 } },
  illegals: { chest: { x: 180, y: 72, z: -300 } },
  books: { chest: { x: 210, y: 75, z: -330 } },
  // 100 more example kits
  kit1: { chest: { x: 220, y: 75, z: -340 } },
  kit2: { chest: { x: 230, y: 75, z: -350 } },
  kit3: { chest: { x: 240, y: 75, z: -360 } },
  kit4: { chest: { x: 250, y: 75, z: -370 } },
  kit5: { chest: { x: 260, y: 75, z: -380 } },
  kit6: { chest: { x: 270, y: 75, z: -390 } },
  kit7: { chest: { x: 280, y: 75, z: -400 } },
  kit8: { chest: { x: 290, y: 75, z: -410 } },
  kit9: { chest: { x: 300, y: 75, z: -420 } },
  kit10: { chest: { x: 310, y: 75, z: -430 } }
}

/* ───── RANDOM PUBLIC MESSAGES ───── */
const randomMessages = [
  "> free kits available",
  "> type !kit",
  "> automatic kit delivery",
  "> bot online",
  "> fast and simple",
  "> check out our server",
  "> enjoy the bot",
  "> kits ready 24/7",
  "> follow rules",
  "> server updates"
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

    if (message === "!kit") {
      return bot.chat(`&aAvailable kits: &f${Object.keys(KITS).join(", ")}`)
    }

    if (message.startsWith("!kit ")) {
      const kitName = message.split(" ")[1]
      if (!KITS[kitName]) return bot.chat("&cInvalid kit name")
      if (cooldowns.get(username) > Date.now())
        return bot.chat("&cYou are on cooldown")

      queue.push({ user: username, kit: kitName })
      cooldowns.set(username, Date.now() + config.cooldown_seconds * 1000)
      bot.chat(`&aKit &f${kitName} &aadded to queue`)
      dcSend(`📦 ${username} requested ${kitName}`, config.discord.log_channels.kits)
    }

    /* ───── INFO COMMANDS ───── */
    const commands = {
      "!help": "&aCommands: !kit, !kits, !tps, !players, !version, !server, !ping, !queue, !author",
      "!kits": `&aKits: &f${Object.keys(KITS).join(", ")}`,
      "!tps": `&aTPS: &f${bot.getTps()}`,
      "!players": `&aPlayers: &f${Object.keys(bot.players).length}`,
      "!version": `&aBot version: &f${config.meta.version}`,
      "!server": `&aServer: &f${config.meta.server_name}`,
      "!author": `&aAuthor: &f${config.meta.author}`,
      "!queue": `&aQueue size: &f${queue.length}`
    }
    if (commands[message]) bot.chat(commands[message])

    /* ───── ADMIN MC COMMANDS ───── */
    const adminCommands = ["!stop", "!restart", "!status", "!say"]
    if (adminCommands.some(c => message.startsWith(c))) {
      if (!isAdmin(username)) return bot.chat("&cYou cannot use admin commands")

      if (message === "!stop") {
        bot.chat("&cBot shutting down")
        process.exit(0)
      } else if (message === "!restart") {
        bot.chat("&aRestarting bot...")
        bot.quit()
        setTimeout(() => {
          require("child_process").spawn(process.argv[0], process.argv.slice(1), { detached: true, stdio: "inherit" })
        }, 1000)
        process.exit(0)
      } else if (message === "!status") {
        bot.chat(`&aStatus - Players: ${Object.keys(bot.players).length}, Queue: ${queue.length}, TPS: ${bot.getTps()}`)
      } else if (message.startsWith("!say ")) {
        const msg = message.slice(5)
        bot.chat(`(${username}) ${msg}`)
      }
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
      const target = new Vec3(chestPos.x, chestPos.y, chestPos.z)

      if (bot.entity.position.distanceTo(target) > 60) {
        bot.chat("&cChest too far, cancelling")
        busy = false
        return
      }

      await bot.pathfinder.goto(new goals.GoalBlock(target.x, target.y, target.z))

      const chestBlock = bot.findBlock({
        matching: b => b.name === "chest" || b.name === "trapped_chest",
        maxDistance: 3
      })

      const chest = await bot.openContainer(chestBlock)
      const items = chest.containerItems()
      const randomItem = items[Math.floor(Math.random() * items.length)]
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
          fs.appendFileSync("coords.txt", `${p.x} ${p.y} ${p.z} | ${dim} | ${lastUser}\n`)
          dcSend(`📍 ${lastUser} @ ${dim}`, config.discord.log_channels.coords)
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
      bot.chat(randomMessages[Math.floor(Math.random() * randomMessages.length)])
  }, 30000)

  /* ───── AUTH ───── */
  bot.on("messagestr", msg => {
    if (msg.includes("/login")) bot.chat(`/login ${config.bot.password}`)
  })

  bot.on("end", () => setTimeout(startBot, 5000))
}

/* ───── DISCORD ADMIN COMMANDS ───── */
discord.on("messageCreate", async msg => {
  if (msg.author.bot) return
  if (msg.channel.name !== config.discord.admin_channel) return

  const args = msg.content.trim().split(/\s+/)
  const cmd = args.shift().toLowerCase()
  if (!msg.member.roles.cache.some(r => r.name === config.discord.admin_role)) {
    return msg.reply("&cYou cannot use admin commands")
  }

  switch (cmd) {
    case "!stop":
      await msg.reply("&cBot stopping...")
      process.exit(0)
      break
    case "!restart":
      await msg.reply("&aRestarting bot...")
      process.exit(0)
      break
    case "!status":
      await msg.reply(`&aQueue: ${queue.length}, Players: ${Object.keys(bot.players || {}).length}, TPS: ${bot.getTps ? bot.getTps() : 'unknown'}`)
      break
    case "!say":
      const sayMsg = args.join(" ")
      if (sayMsg) bot.chat(`(${msg.author.username}) ${sayMsg}`)
      break
    case "!kits":
      await msg.reply(`&aKits: &f${Object.keys(KITS).join(", ")}`)
      break
  }
})

discord.once("ready", () => startBot())
discord.login(config.discord.token)
