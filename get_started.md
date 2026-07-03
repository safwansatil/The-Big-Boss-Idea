# 🚀 Backend Simulation - Get Started Guide

This guide describes how to run and manually test the simulated device data layer. 

---

## ⚙️ Setup & Migration

1. Make sure you have created a `.env` in the root workspace (copy from `.env.example`) and filled in your `DATABASE_URL` (Neon PostgreSQL connection string).
2. Sync the environment variables and run database migrations/seeds:
   ```bash
   # Sync env
   cp .env backend/.env
   
   # Navigate to backend
   cd backend
   
   # Install dependencies
   npm install
   
   # Run Prisma Migrations and Seed
   npx prisma generate
   npx prisma migrate dev --name alert_log_add
   npx prisma db seed
   ```

*Note: Seeding creates all 15 devices with randomized past timestamps (between 0 and 4 hours ago) so stuck-on alerts are testable immediately.*

---

## 🏃 Run the Backend
Start the Express server and weighted simulation loop:
```bash
npm run dev
```

---

## 🔍 Manual Verification Checks

You can use `curl` in a separate terminal or open these links in your web browser to check the data layer operations.

### 1. Check Seeding & Devices Flat State
Verify that the 15 devices were seeded correctly and are being updated by the background simulator (changes occur every 5–15 seconds):
```bash
curl http://localhost:5000/devices
```

### 2. Verify Room Filtering
Query only devices belonging to `work1`:
```bash
curl http://localhost:5000/rooms/work1
```

### 3. Check Live Power Consumption
Verify that the total load and room breakdowns are correctly aggregated:
```bash
curl http://localhost:5000/usage
```

### 4. Trigger & Inspect Fired Alerts
Verify active alerts (after-hours and stuck-on). If you want stuck-on alerts to fire quickly, set `STUCK_ON_THRESHOLD_MS=120000` (2 minutes) in your `.env` and restart the backend.
```bash
curl http://localhost:5000/alerts
```
Check your database's `AlertLog` table (using Prisma Studio or pgAdmin) to verify that new alerts are written to the database under `resolved = false` and marked `resolved = true` once the devices are turned off.

To launch Prisma Studio and inspect database logs directly:
```bash
npx prisma studio
```

### 5. Manually Toggle a Device
Turn a device ON or OFF. This will instantly recompute alerts and push the fresh state to all active stream clients:
```bash
curl -X POST http://localhost:5000/devices/work1-fan-1/toggle
```

### 6. Listen to Real-Time Updates (SSE)
Open a browser tab at:
👉 **`http://localhost:5000/stream`**
You will see the initial state printed, followed by automatic data pushes containing `{ devices, usage, alerts }` whenever the simulator ticks or you make a manual toggle request.
