import { GoogleGenAI } from "@google/genai";
import { EventData, Ticket, TicketStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateEventInsights = async (event: EventData, tickets: Ticket[]): Promise<string> => {
  try {
    const total = tickets.length;
    const used = tickets.filter(t => t.status === TicketStatus.USED).length;
    const remaining = total - used;
    const rate = total > 0 ? ((used / total) * 100).toFixed(1) : 0;

    const prompt = `
      Analyze the current status of the event "${event.name}".
      
      Data:
      - Total VIP Tickets: ${total}
      - Checked In (Used): ${used}
      - Remaining: ${remaining}
      - Check-in Rate: ${rate}%
      
      Provide a brief, professional executive summary (max 3 sentences) suitable for an event manager dashboard. 
      If the rate is low, suggest a marketing push. If high, congratulate the team.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate AI insights at this time.";
  }
};

export const suggestEventNames = async (theme: string): Promise<string[]> => {
  try {
    const prompt = `List 5 creative, short, and exclusive-sounding names for a VIP event with the theme: "${theme}". Return ONLY a JSON array of strings, e.g., ["Name 1", "Name 2"]`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
}
