import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Climb up directory tree to find root .env and load it
let currentDir = __dirname;
let loaded = false;

while (currentDir !== path.parse(currentDir).root) {
  const envPath = path.join(currentDir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`[Env] Successfully loaded root environment from: ${envPath}`);
    loaded = true;
    break;
  }
  currentDir = path.dirname(currentDir);
}

if (!loaded) {
  console.warn('[Env] Warning: Root .env file not found in any parent directories.');
}
