import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const apiKey = process.env.AI_API_KEY || '';
const provider = (process.env.AI_API_PROVIDER || 'gemini') as 'gemini' | 'openai';

const AI_TIMEOUT_MS = 15000;

export async function generateReply(systemPrompt: string, data: any): Promise<string> {
  if (!apiKey) {
    console.warn('[AI] AI_API_KEY not set. Using fallback text generator.');
    return generateFallback(systemPrompt, data);
  }

  try {
    let result: string | undefined;
    const aiCall = (async () => {
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
        result = completion.choices[0]?.message?.content?.trim() ?? undefined;
        if (result) return;
      }

      if (provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
          systemInstruction: systemPrompt,
        });
        const prompt = `Translate this JSON data into a natural, conversational message based on your personality: ${JSON.stringify(data, null, 2)}`;
        const genResult = await model.generateContent(prompt);
        result = genResult.response.text().trim();
        if (result) return;
      }

      console.warn(`[AI] Provider "${provider}" is not fully implemented. Using fallback.`);
      result = undefined;
    })();

    await Promise.race([
      aiCall,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`AI request timed out after ${AI_TIMEOUT_MS}ms`));
        }, AI_TIMEOUT_MS);
      }),
    ]);

    return result ?? generateFallback(systemPrompt, data);
  } catch (error) {
    console.error('[AI] Error generating AI response:', error);
    return generateFallback(systemPrompt, data);
  }
}

function generateFallback(systemPrompt: string, data: any): string {
  if (data.rooms) {
    return `🤖 Status update:\n` + Object.entries(data.rooms).map(([room, summary]: any) => {
      return `• ${room}: ${summary.fansOn} fans, ${summary.lightsOn} lights currently ON.`;
    }).join('\n');
  }
  if (data.roomName) {
    return `🤖 Room update for ${data.roomName}:\n` + data.devices.map((d: any) => {
      return `  - ${d.name}: ${d.status.toUpperCase()} (${d.powerDraw}W) - last changed ${new Date(d.lastChanged).toLocaleTimeString()}`;
    }).join('\n');
  }
  if (data.totalWatts !== undefined) {
    return `🤖 Current total office power draw is **${data.totalWatts}W**. Estimated daily energy usage is **${data.todayKwhEstimate ?? 'N/A'} kWh**.`;
  }
  if (data.alert) {
    const alert = data.alert;
    return `⚠️ Alert: ${alert.room} has an active ${alert.type} issue. Message: "${alert.message}"`;
  }
  return `🤖 Here is the raw data: ${JSON.stringify(data)}`;
}
