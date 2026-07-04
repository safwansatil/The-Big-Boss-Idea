import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

dotenv.config();

const apiKey = process.env.AI_API_KEY || '';
const provider = (process.env.AI_API_PROVIDER || 'gemini') as 'gemini' | 'openai';

export async function generateReply(systemPrompt: string, data: any): Promise<string> {
  if (!apiKey) {
    console.warn('[AI Bot] AI_API_KEY not set. Using fallback text generator.');
    return generateFallback(data);
  }

  try {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(data) },
        ],
        max_tokens: 200,
      });
      return completion.choices[0]?.message?.content?.trim() || generateFallback(data);
    }

    if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(`Translate this JSON data into a natural, conversational message based on your personality: ${JSON.stringify(data, null, 2)}`);
      return result.response.text().trim();
    }

    console.warn(`[AI Bot] Provider "${provider}" is not fully implemented. Using fallback.`);
    return generateFallback(data);
  } catch (error) {
    console.error('[AI Bot] Error generating AI response:', error);
    return generateFallback(data);
  }
}

/**
 * Generates a conversational fallback if AI is unavailable.
 */
function generateFallback(data: any): string {
  if (data.rooms) {
    // !status response fallback
    return `🤖 Status update:\n` + Object.entries(data.rooms).map(([room, summary]: any) => {
      return `• ${room}: ${summary.fansOn} fans, ${summary.lightsOn} lights currently ON.`;
    }).join('\n');
  }
  if (data.roomName) {
    // !room response fallback
    return `🤖 Room update for ${data.roomName}:\n` + data.devices.map((d: any) => {
      return `  - ${d.name}: ${d.status.toUpperCase()} (${d.powerDraw}W) - last changed ${new Date(d.lastChanged).toLocaleTimeString()}`;
    }).join('\n');
  }
  if (data.totalWatts !== undefined) {
    // !usage response fallback
    return `🤖 Current total office power draw is **${data.totalWatts}W**. Estimated daily energy usage is **${data.todayKwhEstimate} kWh**.`;
  }
  return `🤖 Here is the raw data: ${JSON.stringify(data)}`;
}
