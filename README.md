# 📦 Trojan KitBot & Coord Sniffer (Mineflayer)

![NodeJS](https://img.shields.io/badge/Node.js-v16.x+-green?style=for-the-badge&logo=node.js)
![Mineflayer](https://img.shields.io/badge/Mineflayer-Active-blue?style=for-the-badge)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord)
![Status](https://img.shields.io/badge/Mode-Base%20Hunter-red?style=for-the-badge)

A powerful, high-performance Mineflayer script designed for Anarchy servers. This bot acts as a "Trojan Horse": it gains player trust by offering free kit deliveries, then automatically captures and logs their base coordinates the moment they accept a TPA.

---

## ⚡ CORE FEATURES

### 🎮 In-Game Mechanics
* **Automatic Kit Delivery:** Full pathfinding to specific chest locations using `mineflayer-pathfinder`.
* **Smart Queue System:** Handles multiple kit requests sequentially without overlapping.
* **Looting Logic:** Automatically opens chests, withdraws a random item (shulkers, kits, etc.), and closes the container.
* **TPA Tracking:** Sends a TPA to the player and monitors for teleportation movement (>4 blocks).
* **Auto-Kill Reset:** Immediately runs `/kill` after logging coordinates to return to spawn and hide its presence.
* **Global Advertisements:** Broadcasts randomized messages every 30 seconds to attract new targets.

### 🤖 Discord Integration
* **Status Logs:** Real-time updates when the bot spawns or goes offline.
* **Request Logs:** Track which players are requesting kits through Discord.
* **Coord Leaker:** Captured `X Y Z` coordinates and `Dimension` data are sent directly to your private Discord channel.
* **Remote Shutdown:** Full control to kill the bot process via Discord admin channels.

---

## 🧠 HOW IT WORKS (THE LOGIC FLOW)

The bot operates on a "Trust & Trap" cycle. Unlike standard kit bots, this script is fully automated to handle pathfinding, looting, and coordinate sniffing without manual input.

1.  **The Bait:**
    Every 30 seconds, the bot sends a random message from the `randomMessages` array (e.g., "> free kits available") to the global chat to attract players.

2.  **The Request:**
    A player types `!kit <name>`. The bot checks if the kit exists and if the player is on cooldown. If cleared, the player is added to the **Internal Queue**.

3.  **The Retrieval:**
    The bot identifies the coordinates for the requested kit. It uses `mineflayer-pathfinder` to walk to the chest. 
    * *Note: If the chest is further than 60 blocks, the bot cancels to prevent getting lost.*

4.  **The Looting:**
    Once at the chest, the bot opens it, selects a **random item** (ideal for shulker boxes), withdraws it, and closes the chest immediately.

5.  **The Sniff (The Trap):**
    The bot sends a `/tpa` request to the player. It then enters a "waiting" state where it monitors its own coordinates every second.
    
6.  **The Leak & Reset:**
    The moment the player accepts the TPA, the bot detects a sudden position change (teleportation). 
    * **Action:** It captures the `X, Y, Z`, `Dimension`, and `Username`.
    * **Logging:** It saves this data to `coords.txt` and pings your Discord channel.
    * **Escape:** It instantly executes `/kill` to return to spawn and reset its state for the next person in queue.

---

## 📜 COMMAND LIST

The bot features a comprehensive command system for both regular players and bot administrators.

### ⛏️ In-Game Minecraft Commands
| Command | Description |
| :--- | :--- |
| `!kit` | Lists all available kits defined in the script. |
| `!kit <name>` | Adds you to the delivery queue for a specific kit. |
| `!help` | Shows a list of all utility commands. |
| `!tps` | Checks the current server performance (TPS). |
| `!players` | Shows how many players are currently online. |
| `!queue` | Shows how many people are currently waiting for kits. |
| `!ping` | Shows the bot's current latency. |
| `!version` | Displays the current bot version. |
| `!stop` | **(Admin Only)** Shuts down the bot immediately. |

### 💬 Discord Integration & Commands
The bot monitors specific channels defined in your `config.json`.

| Feature | Description |
| :--- | :--- |
| **Admin !stop** | Typing `!stop` in the Discord admin channel kills the bot process. |
| **Status Channel** | Receives an alert whenever the bot logs in or spawns. |
| **Kit Logs** | Every time a player requests a kit, the bot logs the user and kit name. |
| **Coord Leaks** | The private channel where the bot sends captured base coordinates. |

---

## 🛡️ ADMIN SYSTEM

To use admin commands (like `!stop`) in-game, your Minecraft username must be added to the `admins` array in the `config.json`. 

* **Minecraft Admin:** Allows use of `!stop` in the game chat.
* **Discord Admin:** Anyone with access to the specified `admin_channel` can issue the shutdown command.

---

## ⚠️ DISCLAIMER & LICENSE

* **License:** This project is provided "as-is" without a formal license. You are free to modify and use it for your own private projects.
* **Usage:** This bot is designed for use on **Anarchy Servers**. Using this on servers with strict rules against botting or coordinate exploitation may result in a permanent ban. The author is not responsible for any misuse.

---

**Developed for high-efficiency base hunting.**
