# 🚀 Project Launch & Smoke-Testing Guide

This guide describes how to set up, run, and manually smoke-test every component of the **The Big Boss Idea** system: the Express backend simulation, the Next.js visual dashboard, and the Discord bot.

---

## ⚙️ Step 1: Environment Setup
All services in this project read from a **single, unified `.env` file** in the repository root.

1. In the repository root directory, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your actual credentials:
   * `DATABASE_URL`: Your Neon PostgreSQL connection string.
   * `AI_API_KEY`: Your Gemini API key.
   * `DISCORD_BOT_TOKEN`: Your Discord bot token.
   * `DISCORD_WEBHOOK_URL`: Your Discord alert channel Webhook.
   * `BACKEND_PORT`: `5000` (port for API services).
   * `STUCK_ON_THRESHOLD_MS`: `120000` (set to 2 minutes / 120000ms for quick alert testing, defaults to 2 hours).

---

## 💾 Step 2: Database Migration & Seeding
Deploy the SQL tables (`Device` and `AlertLog`) and seed the initial 15 devices. 

Run this command **from the repository root directory** (which automatically loads the root `.env`):
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Generate client, migrate database structure, and seed starting states
npx prisma generate
npx prisma migrate dev --name init_db
npx prisma db seed
```
*Verification:* You should see `Seed completed successfully. 15 devices created.` in your terminal.

---

## 🏃 Step 3: Starting the Services
You will need three terminal sessions to run all services in development mode:

### Terminal 1: Express Backend & Simulator
Starts the Express API on port `5000` and initializes the weighted simulation loop (randomly toggling 0–2 devices every 5–15 seconds):
```bash
cd backend
npm run dev
```

### Terminal 2: Next.js Frontend Dashboard
Starts the Next.js development server on [http://localhost:3000](http://localhost:3000) (directly loading the backend URL from the root `.env`):
```bash
cd dashboard
npm install
npm run dev
```

### Terminal 3: Discord Bot Client
Starts the bot connection client:
```bash
cd bot
npm install
npm run dev
```

---

## 🧪 Step 4: Step-by-Step Smoke-Testing Guide

Perform these manual checks to verify the integration glue works end-to-end:

### Test 1: Real-Time Synchronization (SSE)
1. Open two browser tabs side-by-side at [http://localhost:3000](http://localhost:3000).
2. The dashboard status bar should show `SYNCED` (green circle).
3. In **Tab A**, click on any device sprite (e.g. Work Room 1 Fan 1) to toggle its state.
4. **Result:** **Tab B** must instantly update without page refresh (blades begin spinning/glow activates, and the needle on the semicircle power load gauge pivots to reflect the new Wattage total).

### Test 2: Day/Night Theme Override
1. On [http://localhost:3000](http://localhost:3000), locate the **Day Mode** / **Night Mode** button in the header.
2. Click the button to toggle the override.
3. **Result:** The background shifts to a dusky blue-purple, and active light/fan sprites glow with heightened contrast (simulating a cozy cabin evening).

### Test 3: REST API Handlers & Parameter Validation
Open a new terminal and verify the API returns expected HTTP status codes:
* **GET `/health`**: Returns `{ "status": "healthy", "database": "connected", ... }` with a `200 OK` status.
  ```bash
  curl http://localhost:5000/health
  ```
* **GET `/devices`**: Returns a list of all 15 devices.
  ```bash
  curl http://localhost:5000/devices
  ```
* **GET `/rooms/invalid`**: Returns a `400 Bad Request` error.
  ```bash
  curl -i http://localhost:5000/rooms/invalid
  ```
* **POST `/devices/invalid-id/toggle`**: Returns a `400 Bad Request` error.
  ```bash
  curl -i -X POST http://localhost:5000/devices/invalid-id/toggle
  ```

### Test 4: Discord Bot commands
In your Discord server, message the bot:
* **`!status`**: Bot replies with a friendly, conversational message summarizing active device counts per room.
* **`!usage`**: Bot replies with the current total Watts load and a daily kWh estimate (based on hours elapsed since midnight).
* **`!room drawing`**: Bot returns details about devices in the Drawing Room.

### Test 5: Proactive Webhook Alerts
1. Ensure `STUCK_ON_THRESHOLD_MS` is set to `120000` (2 minutes) in your root `.env` and start the backend.
2. Turn a device ON (either via the Web UI or a curl POST toggle).
3. Wait 2 minutes.
4. **Result:** You should receive a Discord channel notification containing an AI-generated warning (e.g., *"⚠️ Hey! Work Room 1 still has 1 fan and 2 lights ON... did someone forget to leave?"*). Once you turn the device OFF, the database `AlertLog` entry resolves (`resolved = true`).
