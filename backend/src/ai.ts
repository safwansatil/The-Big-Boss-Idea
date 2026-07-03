import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.AI_API_KEY || '';
const provider = process.env.AI_API_PROVIDER || 'gemini';

/**
 * Generates a conversational, friendly response using Gemini AI.
 * Falls back to a clean text summary if the API key is missing or fails.
 */
export async function generateReply(systemPrompt: string, data: any): Promise<string> {
  if (!apiKey) {
    console.warn('[AI] AI_API_KEY not set. Using fallback text generator.');
    return generateFallback(systemPrompt, data);
  }

  try {
    if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
      });

      const prompt = `Analyze this data: ${JSON.stringify(data, null, 2)}`;
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } else {
      console.warn(`[AI] Provider "${provider}" is not fully implemented. Using fallback.`);
      return generateFallback(systemPrompt, data);
    }
  } catch (error) {
    console.error('[AI] Error generating AI response:', error);
    return generateFallback(systemPrompt, data);
  }
}

/**
 * Generates a conversational fallback if AI is unavailable.
 */
function generateFallback(systemPrompt: string, data: any): string {
  if (data.totalWatts !== undefined) {
    return `⚡ Total power draw is currently ${data.totalWatts}W. ` +
           `Room breakdown: Drawing Room: ${data.perRoom?.drawing || 0}W, ` +
           `Work Room 1: ${data.perRoom?.work1 || 0}W, ` +
           `Work Room 2: ${data.perRoom?.work2 || 0}W.`;
  }
  if (data.alert) {
    const alert = data.alert;
    return `⚠️ Alert: ${alert.room} has an active ${alert.type} issue. Message: "${alert.message}"`;
  }
  return `Report: ${JSON.stringify(data)}`;
}
