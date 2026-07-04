# 📋 Complete Problem Checklist - The Big Boss Idea

This checklist compiles every requirement, detail, and constraint from the IUTRS Techathon Hackathon 2026 problem statement. Use this to verify complete feature coverage of the project before final submission.

---

## 📦 1. Final Submission Deliverables

- [ ] **Public Repository:**
  - [ ] Public codebase folder (GitHub, GitLab, etc.) containing all code files.
- [ ] **Comprehensive Documentation:**
  - [ ] A root `README.md` explaining how to configure, set up, and run the backend, dashboard, and bot.
- [ ] **System Diagram & Schematics:**
  - [ ] A High-level System Diagram saved directly in the repository.
  - [ ] A Circuit Schematic diagram saved directly in the repository.
- [ ] **Video Demo:**
  - [ ] A short walk-through video (maximum 3 minutes preferred).
  - [ ] Demonstrates the live dashboard updating in real-time.
  - [ ] Demonstrates typing queries to the Discord bot and receiving replies.
  - [ ] Briefly explains the overall data flow and system architecture.

---

## 🏛️ 2. Core Architecture & Data Simulation

- [ ] **Single Source of Truth:**
  - [ ] One shared backend API serving both the dashboard and the Discord bot.
- [ ] **Simulated Device Data Layer:**
  - [ ] Program that pretends to be 15 devices spread across 3 rooms (Drawing Room, Work Room 1, Work Room 2).
  - [ ] Keeps track of what is turned on/off and active power draw.
  - [ ] Dynamic data simulation that updates states over time (simulation loop).
- [ ] **Device Data Schema:**
  - [ ] `Status`: on or off.
  - [ ] `Power draw`: realistic active wattage (e.g. Fan = 60W when ON, Light = 15W when ON, 0W when OFF).
  - [ ] `Room`: drawing, work1, or work2.
  - [ ] `Last changed`: timestamp of state transitions.

---

## 🗺️ 3. Required Diagrams & Schematics (The Blueprints)

- [ ] **High-Level System Diagram (The Information Map):**
  - [ ] Shows how everything connects: `Devices → Simulated Data → Backend → Dashboard/Bot → User`.
  - [ ] Illustrates how a device state change triggers updates on the web UI and Discord bot.
  - [ ] **Constraint:** Created manually or using any diagramming tool *except* Mermaid.
- [ ] **Hardware/Electrical Schematic (The Wiring Map):**
  - [ ] Represents a conceptual physical wiring schematic for one room (e.g. ESP32 or Arduino connected to 2 fans and 3 lights).
  - [ ] Optional: showing current sensing.
  - [ ] Created using an online drag-and-drop circuit simulator (Wokwi or Tinkercad).

---

## 🖥️ 4. Web Dashboard Requirements (The Live Web Page)

- [ ] **Real-Time Interface:**
  - [ ] Updates automatically on state changes without manual page refreshes (no hitting "refresh").
- [ ] **Live Device Status Panel (The Switchboard):**
  - [ ] Displays all 15 devices organized by room.
  - [ ] Clear visual ON/OFF indicators.
- [ ] **Live Power Consumption Meter (The Power Meter):**
  - [ ] Shows total active office load (in Watts).
  - [ ] Displays a per-room active load breakdown.
- [ ] **Active Alerts Panel (The Alarm Bell):**
  - [ ] Highlights active anomalies with timestamped items:
    - [ ] `after-hours`: Devices left ON outside 9 AM – 5 PM local time.
    - [ ] `stuck-on`: Devices left ON for more than a threshold (default 2 hours).

---

## 🤖 5. Discord Bot Requirements (The Chat Assistant)

- [ ] **Backend Connection:**
  - [ ] Connects only to the shared backend REST API (does not read DB directly).
- [ ] **Humanized Responses:**
  - [ ] Conversational, friendly, and non-robotic replies.
  - [ ] Use of an LLM/AI API (Gemini) is strongly encouraged to vary phrasing.
- [ ] **Minimum Required Commands:**

| Command | Expected Output / Behavior |
| :--- | :--- |
| **`!status`** | Text summary of rooms (e.g., *"Drawing Room: 1 fan ON, 2 lights ON. Work Room 1: all off. Work Room 2: 2 fans ON, 3 lights ON."*) |
| **`!room <name>`** | Status of a specific room (drawing, work1, work2). |
| **`!usage`** | Total office power load and daily kWh estimate (e.g., *"Total power right now: 740W. Today's estimated usage: 4.2 kWh."*) |

---

## 🌟 6. Bonus Points (Optional but Recommended)

- [ ] **Top-view Office Layout:**
  - [ ] Layout integrated directly into the web dashboard representing office rooms and furniture.
- [ ] **Visual Animations:**
  - [ ] Lightbulb sprites glow when ON.
  - [ ] Fan sprites visibly spin when running.
- [ ] **Proactive Discord Webhook Alerts:**
  - [ ] Backend posts warning notifications directly to a Discord channel when an anomaly is first triggered.
