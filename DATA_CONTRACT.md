# 📝 Data Contract - The Big Boss Idea API & Bot Commands

This document details the API endpoint URLs, request methods, field schemas, and exact JSON payloads exposed by the backend energy monitoring service, along with the expected Discord bot commands contract.

---

## 📡 REST Endpoints

### 1. GET `/health`
Health check endpoint verifying database connectivity.

* **Response Schema:**
  * `status`: `"healthy" | "unhealthy"`
  * `database`: `"connected" | "disconnected"`
  * `timestamp`: `string` (ISO 8601 DateTime string)
  * `error`: `string` (Optional, only present if database check fails)
* **Example Payload:**
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "timestamp": "2026-07-03T18:10:00.000Z"
  }
  ```

---

### 2. GET `/devices`
Returns a flat JSON array containing the status of all 15 office devices.

* **Response Schema:** `Array<Device>`
  * `id`: `string` (unique device identifier, e.g. `"work1-fan-2"`)
  * `name`: `string` (display name, e.g. `"Work Room 1 Fan 2"`)
  * `type`: `"fan" | "light"`
  * `room`: `"drawing" | "work1" | "work2"`
  * `status`: `"on" | "off"`
  * `powerDraw`: `number` (current power in Watts: `60` for ON fan, `15` for ON light, `0` if OFF)
  * `lastChanged`: `string` (ISO 8601 DateTime string)
* **Example Payload:**
  ```json
  [
    {
      "id": "work1-fan-2",
      "name": "Work Room 1 Fan 2",
      "type": "fan",
      "room": "work1",
      "status": "on",
      "powerDraw": 60,
      "lastChanged": "2026-07-03T16:30:12.483Z"
    },
    {
      "id": "drawing-light-1",
      "name": "Drawing Room Light 1",
      "type": "light",
      "room": "drawing",
      "status": "off",
      "powerDraw": 0,
      "lastChanged": "2026-07-03T14:15:00.000Z"
    }
  ]
  ```

---

### 3. GET `/rooms/:room`
Returns devices filtered by room. Acceptable parameters are `drawing`, `work1`, or `work2`.

* **Response Schema:** `Array<Device>` (same structure as `GET /devices`)
* **Example URL:** `http://localhost:5000/rooms/work1`
* **Example Payload:**
  ```json
  [
    {
      "id": "work1-fan-1",
      "name": "Work Room 1 Fan 1",
      "type": "fan",
      "room": "work1",
      "status": "off",
      "powerDraw": 0,
      "lastChanged": "2026-07-03T15:20:00.000Z"
    }
  ]
  ```

---

### 4. GET `/usage`
Returns the current active energy usage (in Watts) across the entire office, along with a per-room aggregate breakdown.

* **Response Schema:**
  * `totalWatts`: `number`
  * `perRoom`:
    * `drawing`: `number`
    * `work1`: `number`
    * `work2`: `number`
* **Example Payload:**
  ```json
  {
    "totalWatts": 135,
    "perRoom": {
      "drawing": 75,
      "work1": 60,
      "work2": 0
    }
  }
  ```

---

### 5. GET `/alerts`
Returns a list of currently active anomalous alerts computed from the database. It also logs new alerts to the `AlertLog` table and resolves completed ones.

* **Alert Rules:**
  * `after-hours`: Fired if a device is `on` outside 9 AM – 5 PM local time.
  * `stuck-on`: Fired if a device is `on` for longer than `STUCK_ON_THRESHOLD_MS` (default 2 hours).
* **Response Schema:** `Array<Alert>`
  * `type`: `"after-hours" | "stuck-on"`
  * `room`: `"drawing" | "work1" | "work2"`
  * `deviceIds`: `string[]` (list of device IDs triggering this alert)
  * `message`: `string` (human-readable summary)
  * `timestamp`: `string` (ISO DateTime when computed)
* **Example Payload:**
  ```json
  [
    {
      "type": "after-hours",
      "room": "work2",
      "deviceIds": ["work2-light-1", "work2-light-2"],
      "message": "Work Room 2 has 2 device(s) left ON after hours (9 AM - 5 PM).",
      "timestamp": "2026-07-03T18:05:00.123Z"
    }
  ]
  ```

---

### 6. POST `/devices/:id/toggle`
Manually toggles the status of a specific device. Flipped state is saved to the database and immediately broadcasts updates to all active SSE streams.

* **Validation:** ID must match one of the 15 valid device IDs (e.g. `drawing-fan-1` ... `work2-light-3`). Returns `400 Bad Request` on invalid ID, `404 Not Found` if valid but missing in DB.
* **Response Schema:** `Device` (representing the updated state)
* **Example URL:** `http://localhost:5000/devices/work1-fan-2/toggle`
* **Example Payload:**
  ```json
  {
    "id": "work1-fan-2",
    "name": "Work Room 1 Fan 2",
    "type": "fan",
    "room": "work1",
    "status": "off",
    "powerDraw": 0,
    "lastChanged": "2026-07-03T18:00:15.892Z"
  }
  ```

---

## ⚡ Server-Sent Events (SSE)

### GET `/stream`
Provides a persistent connection pushing real-time states on every simulation loop tick or manual API toggle.

* **Format:** EventStream (`text/event-stream`).
* **Connection Event:** Sends the complete state object immediately upon connecting.
* **Payload Shape:**
  * `devices`: `Array<Device>`
  * `usage`: `{ totalWatts: number, perRoom: { drawing: number, work1: number, work2: number } }`
  * `alerts`: `Array<Alert>`
* **Example Payload Data:**
  ```
  data: {"devices":[{"id":"drawing-fan-1","name":"Drawing Room Fan 1","type":"fan","room":"drawing","status":"off","powerDraw":0,"lastChanged":"2026-07-03T14:00:00.000Z"},...],"usage":{"totalWatts":90,"perRoom":{"drawing":15,"work1":75,"work2":0}},"alerts":[]}
  ```

---

## 🤖 Discord Bot Command Outputs

Commands sent to the bot trigger API requests to the backend, which are interpreted by Gemini to return rich, conversational replies.

### 1. `!status`
* **Command:** `!status`
* **Expected Output:** Conversational summary of active counts.
* **Example:** *"🤖 Hey Boss! Here's the layout: The Drawing Room has 1 light on. Work Room 1 has 1 fan and 2 lights active. Work Room 2 is completely dark (everyone left!)."*

### 2. `!room <name>`
* **Command:** `!room drawing` (accepts drawing, work1, or work2)
* **Expected Output:** Conversational update on a specific room.
* **Example:** *"🤖 Checking the Drawing Room: Fan 1 is OFF, Fan 2 is ON, Light 2 is ON. Overall draw is 75W. It's cozy, but did someone forget to turn Fan 2 off?"*

### 3. `!usage`
* **Command:** `!usage`
* **Expected Output:** Current power draw + today's estimated kWh with a cheeky personality remark.
* **Example:** *"🤖 Current total load is **135W**. Today's estimated total usage is **3.2 kWh**. We're doing great, team is being mindful today!"*
