const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const tpsPlugin = require("mineflayer-tps")
const Vec3 = require("vec3")
const fs = require("fs")
const { Client, GatewayIntentBits } = require("discord.js")

const config = require("./config.json")

/* ───── DISCORD ───── */

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

function dcSend(msg, targets) {
  for (const name of targets) {
    const ch = discord.channels.cache.find(c => c.name === name)
    if (ch) ch.send(msg).catch(() => {})
  }
}

/* ───── RANDOM MESSAGES (RESTORED) ───── */

const randomMessages = [
  "&aHello &f{player}&a!",
  "&bFree kits available! &fUse &e!kit",
  "&dJoin our Discord!",
  "&eNeed items? &aType !kit",
  "&9TPS: &f{tps}",
  "&6Bot online &a24/7",
  "&cNo scam, real shulkers",
  "&5Powered by Mineflayer"
]

/* ───── KITS SYSTEM (IN CODE) ───── */

const KITS = {
  basic: {
    name: "&aBasic Kit",
    chest: { x: 120, y: 64, z: -340, radius: 2 }
  },
  pvp: {
    name: "&cPvP Kit",
    chest: { x: 140, y: 65, z: -350, radius: 2 }
  },
  rich: {
    name: "&6Rich Kit",
    chest: { x: 200, y: 70, z: -500, radius: 3 }
  }
}

/* ───── BOT CREATION ───── */

function startBot() {
  const bot = mineflayer.createBot(config)
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(tpsPlugin)

  let queue = []
  let busy = false
  let waitingTPA = false
  let currentUser = null
  let startPos = null

  const cooldowns = new Map()

  function hasCooldown(user) {
    const t = cooldowns.get(user) || 0
    return Date.now() < t
  }

  function setCooldown(user) {
    cooldowns.set(user, Date.now() + config.cooldown * 1000)
  }

  async function clearInventory() {
    for (const item of bot.inventory.items()) {
      await bot.tossStack(item).catch(() => {})
    }
  }

  bot.once("spawn", () => {
    bot.pathfinder.setMovements(new Movements(bot))
    console.log("Bot spawned")
  })

  /* ───── CHAT COMMANDS ───── */

  bot.on("chat", (username, message) => {
    if (username === bot.username) return

    if (message === "!kit") {
      if (hasCooldown(username)) {
        return bot.chat(`&cYou are on cooldown`)
      }

      if (queue.includes(username)) {
        return bot.chat(`&eYou are already queued`)
      }

      queue.push(username)
      setCooldown(username)

      bot.chat(`&aYou have been added to the queue`)
      dcSend(`📦 ${username} requested a shulker`, config.discord.channels.kits)
    }

    if (message === "!ping") {
      const p = bot.players[username]?.ping
      bot.chat(`&9Ping: &f${p ?? "?"} ms`)
    }

    if (message === "!tps") {
      bot.chat(`&9TPS: &f${bot.getTps()}`)
    }

    if (message === "!players") {
      bot.chat(`&aPlayers online: &f${Object.keys(bot.players).length}`)
    }
  })

  /* ───── MAIN LOOP (SAME SYSTEM) ───── */

  bot.on("physicsTick", async () => {
    if (busy || queue.length === 0) return

    busy = true
    currentUser = queue.shift()

    try {
      await clearInventory()

      const target = new Vec3(
        config.chest.x,
        config.chest.y,
        config.chest.z
      )

      await bot.pathfinder.goto(
        new goals.GoalNear(target.x, target.y, target.z, config.chest.radius)
      )

      const chestBlock = bot.findBlock({
        matching: b => b.name === "chest" || b.name === "trapped_chest",
        maxDistance: 3
      })

      if (!chestBlock) throw new Error("Chest not found")

      const chest = await bot.openContainer(chestBlock)

      const shulker = chest
        .containerItems()
        .find(i => i.name.includes("shulker_box"))

      if (!shulker) {
        chest.close()
        throw new Error("No shulker inside")
      }

      await chest.withdraw(shulker.type, null, 1)
      chest.close()

      startPos = bot.entity.position.clone()
      waitingTPA = true

      bot.chat(`/tpa ${currentUser}`)
      bot.chat(`&ePlease accept TPA`)

      const check = setInterval(() => {
        if (!waitingTPA) return clearInterval(check)

        if (bot.entity.position.distanceTo(startPos) > 4) {
          clearInterval(check)

          const p = bot.entity.position
          const line = `x=${Math.round(p.x)} y=${Math.round(p.y)} z=${Math.round(p.z)} by ${currentUser}\n`
          fs.appendFileSync("coord.txt", line)

          dcSend(
            `📍 ${line}`,
            config.discord.channels.coords
          )

          bot.chat("&aDelivery complete")
          bot.chat("/kill")

          waitingTPA = false
          busy = false
        }
      }, 1000)

      setTimeout(() => {
        if (waitingTPA) {
          bot.chat("&cTPA expired")
          bot.chat("/kill")
          waitingTPA = false
          busy = false
        }
      }, config.cooldown * 1000)
    } catch (e) {
      console.log("Error:", e.message)
      busy = false
    }
  })

  /* ───── RANDOM CHAT ───── */

  setInterval(() => {
    const players = Object.keys(bot.players).filter(p => p !== bot.username)
    if (!players.length) return

    const p = players[Math.floor(Math.random() * players.length)]
    const msg = randomMessages[
      Math.floor(Math.random() * randomMessages.length)
    ]
      .replace("{player}", p)
      .replace("{tps}", bot.getTps())

    bot.chat(msg)
  }, 30000)

  /* ───── LOGIN / RECONNECT ───── */

  bot.on("messagestr", msg => {
    if (msg.includes("/login")) {
      bot.chat(`/login ${config.auth_password}`)
    }
  })

  bot.on("end", () => {
    console.log("Reconnecting...")
    setTimeout(startBot, 5000)
  })
}

/* ───── DISCORD CONTROL ───── */

discord.on("messageCreate", msg => {
  if (msg.author.bot) return
  if (msg.channel.name !== "controlbot") return
  if (!msg.content) return
  bot?.chat(msg.content)
})

discord.once("ready", () => {
  console.log("Discord connected")
  startBot()
})

discord.login(config.discord.token)
