# ⚡ The Big Boss Idea
### National Hackathon MVP - Cozy Office Energy Monitoring System

**The Big Boss Idea** is a Nintendo-style (Stardew Valley / Animal Crossing cozy-cottage vibe) office energy monitoring system designed to keep employees accountable for active device waste. It features an Express backend hosting a simulated device data layer (Postgres via Prisma), a Next.js real-time visual web dashboard, a Wokwi hardware schematic concept, and an opinionated Discord bot that queries active device logs and generates conversational, cheeky energy reviews using the Gemini AI SDK.

Presented by team **IUT_zeroXP**.

---

## 🗺️ System Flow Diagram

The high-level integration architecture and data flows are illustrated below:

```
[Simulated Device Layer] ──> [Postgres (Prisma)] ──> [Express Backend]
                                                            │
                                  ┌─────────────────────────┴─────────────────────────┐
                                  ▼                                                   ▼
                       [Next.js Web Dashboard]                             [Discord Bot Client]
                       - Real-time updates (SSE)                           - Conversational AI (Gemini)
                       - Cozy CSS/SVG Visuals                              - Prefix & Slash commands
                       - Semicircle Power Gauge                            - Proactive webhook alerts
```

> [!NOTE]
> A complete system diagram editable code file is saved in the repository at [assets/system_diagram.excalidraw](file:///d:/new_wrkspc/techathon_hackathon_2026/assets/system_diagram.excalidraw). You can import this file directly into [Excalidraw](https://excalidraw.com) to view or edit the full design canvas.

---

## 🔌 Hardware / Electrical Schematic

The conceptual circuit schematic representing one room's wiring (ESP32/Arduino, Relays, Lights, Fans, and Current Sensors) is saved directly in the repository.

* **Microcontroller:** ESP32 DevKit V1
* **Lights:** 3 LEDs controlled by 3 Relays (GPIO Pins 12, 14, 27)
* **Fans:** 2 DC Motors controlled by 2 Relays (GPIO Pins 26, 25)
* **Current Sensor:** ACS712 Current Sensor reading total power draw (ADC Pin 34)

Judges can open the circuit wiring simulation and code files in the repository.

---

## ⚙️ Setup & Installation

### Step 1: Environment Configuration
The project uses a **single, unified `.env` file** in the repository root for all packages:

1. In the root directory, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your actual credentials:
   * **`DATABASE_URL`**: Your Neon Postgres connection string.
   * **`AI_API_KEY`**: Your Gemini API key.
   * **`DISCORD_BOT_TOKEN`**: Your Discord bot token.
   * **`DISCORD_WEBHOOK_URL`**: Your Discord alert channel Webhook.
   * **`STUCK_ON_THRESHOLD_MS`**: `7200000` (e.g. 2 hours, set to `10000` / 10s during video demo).

---

### Step 2: Database Migration & Seeding
Prisma commands must be executed from the `/backend` folder (which automatically climbs up to read the root `.env`):
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init_energy_db
npx prisma db seed
```
*Note: Seeding creates all 15 devices (Drawing Room: 2 fans, 3 lights; Work Room 1: 2 fans, 3 lights; Work Room 2: 2 fans, 3 lights) with a realistic mix of ON/OFF states and randomized past offsets (0 to 4 hours ago) so that stuck-on alerts are testable immediately.*

---

## 🚀 Running the Services

You will need three terminal windows to run all services in development mode:

### 1. Launch the Backend API & Simulation Loop
Starts the server on `http://localhost:5000` (along with the weighted day/night simulation loop):
```bash
cd backend
npm run dev
```

### 2. Launch the Next.js Web Dashboard
Starts the Next.js development server on `http://localhost:3000` (automatically reading the backend URL configuration from the root `.env`):
```bash
cd dashboard
npm install
npm run dev
```

### 3. Launch the Discord Bot Client
Starts the Discord bot client:
```bash
cd bot
npm install
npm run dev
```

---

## 🧠 Dynamic Simulation & Alert Pipeline

* **Occupancy Weights:** The simulator implements realistic time-of-day biased state changes (e.g., higher probability of turning devices ON during work hours 9 AM – 5 PM; 80% chance of turning devices OFF outside work hours).
* **Alert Deduplication:** Active alerts are evaluated and logged to the `AlertLog` table in the database. Fired alerts are deduplicated by `type + room + sortedDeviceIds` to prevent duplicate database logs and Discord webhook spam.
* **Auto-Resolution:** Once a device is turned off or office hours resume, the alert resolves automatically, updating its status to `resolved = true` in Postgres.

---

## 📊 REST API & SSE Contracts

* **GET `/health`**: Returns `{ "status": "healthy", "database": "connected" }`.
* **GET `/devices`**: Returns a list of all 15 devices.
* **GET `/rooms/:room`**: Filtered list of devices (`drawing`, `work1`, `work2`).
* **GET `/usage`**: Returns total active wattage load and a per-room breakdown.
* **GET `/alerts`**: Returns active computed anomalies.
* **POST `/devices/:id/toggle`**: Toggles a device status (e.g. `drawing-fan-1`) and broadcasts state.
* **GET `/stream` (SSE)**: Pushes updates to the dashboard instantly on simulation ticks or manual clicks.

---

## 🤖 Discord Bot Commands

| Command | Expected Output / Behavior |
| :--- | :--- |
| **`!status`** / **/status** | Returns a friendly, conversational summary of active room device counts. |
| **`!room <name>`** / **/room** | Status of a specific room (drawing, work1, work2). |
| **`!usage`** / **/usage** | Live power consumption and daily estimated kWh usage. |
| **/predict** | Proposes EOD usage forecasts and one actionable energy tip. |
| **/ask** | Interactively answers energy-saving questions using Stardew Valley-style AI. |

---

## 🎮 How to Demo (Video Guide)

1. Open two browser tabs side-by-side at [http://localhost:3000](http://localhost:3000). Toggling a device in Tab A instantly propagates the updates (animated fan blades, glowing bulbs, dial needle) in Tab B.
2. Go to Discord and type `!usage` or `/status` to show conversational Gemini replies.
3. Turn a device ON after hours, wait for the dynamic AI webhook alert to fire in your Discord channel, and watch it resolve in the database once turned OFF.
