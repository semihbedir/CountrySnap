import { GoogleGenAI } from "@google/genai";

// Fix for TS2580: Cannot find name 'process'
declare const process: any;

let ai: GoogleGenAI | null = null;

export const generateCountryHint = async (countryName: string, existingHints: string[]): Promise<string> => {
  try {
    // Access process.env.API_KEY directly so Vite can perform string replacement
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.warn("API_KEY is missing in environment variables.");
      return "Hints are currently unavailable (Missing API Key). Focus on the shape!";
    }

    // Lazy initialization
    if (!ai) {
      ai = new GoogleGenAI({ apiKey });
    }

    const prompt = `
      You are a game host for a "Guess the Country" game.
      The user is looking at an outline of the country: "${countryName}".
      
      Provide a concise, single-sentence hint about this country. 
      The hint should be interesting but not immediately give it away if possible, but get progressively easier if they ask more.
      
      Previous hints given: ${JSON.stringify(existingHints)}.
      
      Rules:
      1. DO NOT mention the name of the country inside the hint.
      2. DO NOT mention the name of bordering countries explicitly if it makes it too obvious, unless it's a hard hint.
      3. Make it distinct from previous hints.
      4. If this is the first hint, focus on geography or general region.
      5. If this is a later hint, focus on culture, landmarks, or specific facts.
      
      Return ONLY the hint text.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      return "Focus on the shape and location!";
    }
    return text.trim();
  } catch (error) {
    console.error("Error generating hint:", error);
    return "I'm having trouble retrieving a hint right now. Focus on the shape!";
  }
};