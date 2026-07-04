# Coding Agent Guidelines - The Big Boss Idea

Welcome! If you are a coding agent working on this workspace, please follow these project-scoped rules and constraints to ensure visual and architectural consistency.

---

## 🎨 Visual Guidelines & Art Direction
* **Theme:** **Stardew Valley / Animal Crossing** cozy-cottage UI. 
* **Styling:** Strict **Vanilla CSS** and raw SVG paths only. Do NOT install generic UI kits (such as Shadcn, Radix, or default Tailwind configs).
* **Colors & Accents:**
  * Day mode uses warm parchment backgrounds (`#f6efe2`) and soft timber-brown borders (`#5c4033`).
  * Night mode uses a dusky blue/purple background (`#18192a`).
  * Active lights must glow warm yellow/amber; active fans must show a spinning blur animation and soft blue/teal light bleed.
* **Typography:** Use `'Press Start 2P'` and `'VT323'` for headers/metrics, and `'Nunito'` (rounded sans-serif) for body copy.

---

## 🔑 Environment Configuration Rules
* **Single Source of Truth:** Do NOT duplicate `.env` files inside `/backend`, `/bot`, or `/dashboard`. All services must load their environment variables from the **single unified `.env` file in the repository root**.
* **Loader Implementations:**
  * Node services (`/backend` and `/bot`) must load their environment on boot by importing a parent-directory climbing `.env` loader first (e.g. `import './loadEnv';`).
  * Next.js must load the root `.env` by parsing it inside `next.config.ts` and exporting it to client-side bundles.

---

## 💾 Database & Prisma migrations
* To run Prisma migrations, always run them from the repository root (current working directory) so Prisma loads the root `.env` automatically:
  ```bash
  npx prisma migrate dev --schema=backend/prisma/schema.prisma
  npx prisma db seed --schema=backend/prisma/schema.prisma
  ```
