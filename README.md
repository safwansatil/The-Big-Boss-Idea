# The Big Boss Idea
### IUTRS Techathon Hackathon 2026 MVP - Office Energy Monitoring System
**Developed by Team IUT_zerowin**

"The Big Boss Idea" is a Nintendo-style (Stardew Valley / Animal Crossing UI energy) office energy monitoring system. It features a custom hand-drawn pixel-art Next.js web dashboard, an Express backend with a simulated device data layer (Postgres via Prisma), and a Discord bot that translates energy usage logs into conversational, quirky, and slightly judgey AI replies using Gemini.

---

## 🗺️ System Flow Diagram

The high-level architecture and data flows are illustrated below:

![System Flow Diagram](assets/system_diagram.svg)

---

## 🔌 Repository Structure
The repository is split into three main services:
* **`/backend`**: Express API + Prisma (Neon Postgres) + Simulation Loop + Webhook Alert Dispatcher
* **`/dashboard`**: Next.js App Router (TypeScript) + Vanilla CSS (Cozy pixel art switchboard and gauge)
* **`/bot`**: Node + `discord.js` + Gemini AI client (Conversational queries)
* **`/assets`**: Visual diagrams and schematics

---

## ⚙️ Setup & Installation

### Step 1: Environment Configuration
1. In the root directory, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your credentials:
   * **`DATABASE_URL`**: Your Neon Postgres connection string.
   * **`AI_API_KEY`**: Your Gemini API key.
   * **`DISCORD_BOT_TOKEN`**: Your Discord bot client token.
   * **`DISCORD_WEBHOOK_URL`**: The Webhook URL of the channel where alerts should be posted.
3. Propagate the environment variables to all folders:
   * **PowerShell**:
     ```powershell
     Copy-Item .env backend\.env; Copy-Item .env bot\.env; Copy-Item .env dashboard\.env.local
     ```
   * **Bash**:
     ```bash
     cp .env backend/.env && cp .env bot/.env && cp .env dashboard/.env.local
     ```

### Step 2: Database Migration & Seeding
Navigate to `/backend`, generate the Prisma client, deploy the database schema, and seed the starting 15 devices (Drawing Room: 2 fans, 3 lights; Work Room 1: 2 fans, 3 lights; Work Room 2: 2 fans, 3 lights):
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```
*Nominal values seeded: Fans = 60W when ON, Lights = 15W when ON, 0W when OFF. A randomized starting mix of ON/OFF is seeded.*

---

## 🚀 Running the Services

You will need three terminal sessions to run the services in development mode:

### 1. Start the Backend API & Simulation Loop
Runs the server on `http://localhost:5000` and starts the simulation loop (randomly toggling 0–2 devices every 5–15 seconds):
```bash
cd backend
npm run dev
```

### 2. Start the Next.js Web Dashboard
Runs the dashboard on `http://localhost:3000`:
```bash
cd dashboard
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Start the Discord Bot
Runs the bot listener client:
```bash
cd bot
npm run dev
```

---

## 🎮 Features & Usage

### 🖥️ Web Dashboard
* **Real-time Synchronization (SSE)**: Subscribes to `/api/stream` using `EventSource`. Toggling a device on one tab instantly updates the map, dial gauge, and lists on all other open tabs without page reloads.
* **Pixel-Art Map**: Semicircle custom SVG gauge shows total energy usage (0–495W). Top-down map displays Drawing Room, Work Room 1, and Work Room 2 side-by-side with animated SVG sprites (fans spin when ON, lights glow when ON). Click any sprite to toggle it manually.
* **Switchboard**: A control panel listing all devices with active wattages and toggle switches.
* **Active Alerts Log**: Color-coded warnings listing devices left ON after-hours (outside 9 AM – 5 PM local time) or stuck ON (ON for longer than the threshold).

### 🤖 Discord Bot Commands
The bot reads data from the backend REST API, feeds it to Gemini AI with system prompts, and generates conversational, quirky replies:
* **`!status`**: Aggregates room-by-room counts of active devices.
* **`!room <drawing | work1 | work2>`**: Provides detailed device logs and comments on energy waste in a specific room.
* **`!usage`**: Shows total power draw and estimates daily kWh consumption, warning the boss if usage is excessive.

### 🚨 Proactive Webhook Alerts
* When a device triggers an alert condition for the first time, the backend calls the Gemini AI API to compose a friendly notification (e.g. *“⚠️ Hey! Work Room 2 still has 2 fans and 3 lights ON and it's 10 PM. Did someone forget to leave?”*) and posts it to your configured `DISCORD_WEBHOOK_URL`.
* Alerts are deduplicated in-memory to prevent channel spamming.
