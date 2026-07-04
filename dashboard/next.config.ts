import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

// Find root .env by climbing up parent directories
let envPath = '';
let currentDir = __dirname;

while (currentDir !== path.parse(currentDir).root) {
  const checkPath = path.join(currentDir, '.env');
  if (fs.existsSync(checkPath)) {
    envPath = checkPath;
    break;
  }
  currentDir = path.dirname(currentDir);
}

const env: Record<string, string> = {};
if (envPath) {
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      // Skip empty lines and comments
      if (line.trim().startsWith('#') || !line.includes('=')) return;
      
      const [key, ...valueParts] = line.split('=');
      const trimKey = key.trim();
      let value = valueParts.join('=').trim();
      
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      
      env[trimKey] = value;
      process.env[trimKey] = value; // Set in compile process environment
    });
    console.log(`[Next.js Config] Successfully loaded root environment from: ${envPath}`);
  } catch (err) {
    console.error('[Next.js Config] Failed to parse root .env:', err);
  }
} else {
  console.warn('[Next.js Config] Warning: Root .env file was not found.');
}

const nextConfig: NextConfig = {
  env: {
    // Provide variables to the client bundle
    NEXT_PUBLIC_BACKEND_URL: env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
  }
};

export default nextConfig;
