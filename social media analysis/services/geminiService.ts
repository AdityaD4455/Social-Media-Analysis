
import { GoogleGenAI, Type } from "@google/genai";
import { SocialData, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const askAdmiral = async (query: string, dataSummary: string, history: ChatMessage[], complex: boolean = false) => {
  try {
    const modelName = complex ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
    
    const chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction: `You are the AI Admiral of InsightSphere. You are an elite, authoritative space-commander analyzing neural social data. 
        Current Fleet Status and Metrics:
        ${dataSummary}

        Rules of Engagement:
        1. Always be brief and authoritative.
        2. Use advanced markdown formatting for tactical emphasis:
           - Use ### Headers for section divisions.
           - Use **Bold text** for ALL key insights, critical warnings, and specific strategic advice.
           - Use \`inline code blocks\` for all technical terms, parameters (e.g., \`Engagement\`, \`NTS_Lift\`, \`Volatility\`), and specific data values.
           - Use Markdown Tables to compare data points or platforms.
           - Use Bulleted lists for clear action items.
        3. Provide specific, data-driven advice based on the current matrix status.
        4. If 'Deep Thought' mode is active, provide extensive logical reasoning for your strategic choices.`,
        temperature: 0.7,
        thinkingConfig: complex ? { thinkingBudget: 32768 } : undefined,
      },
      history: history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    });

    const response = await chat.sendMessage({ message: query });
    return response.text || "Communication relay failure. Re-initiate uplink.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "The neural link has been disrupted. Check transmission parameters or API key clearance.";
  }
};

export const generateTacticalReport = async (data: SocialData[], stats: any, chatHistory: ChatMessage[]) => {
  const dataString = JSON.stringify(data.slice(-20));
  const latestAdvice = chatHistory.filter(m => m.role === 'assistant').slice(-5).map(m => m.content).join('\n---\n');

  const prompt = `Generate an Elite Galactic Intelligence Briefing.
  
  CORE MISSION DATA:
  - Neural Synchronization (NTS) Stats: ${JSON.stringify(stats.nts)}
  - Active Data Stream Count: ${stats.totalRecords}
  - Recent Neural Patterns: ${dataString}
  
  ADMIRAL'S LATEST DIRECTIVES & ADVICE:
  ${latestAdvice || "Awaiting manual strategic overrides."}

  REQUIRED REPORT DEPTH (Strict Structure):
  1. [EXECUTIVE_SUMMARY]: A high-level synthesis of neural efficiency vs actual trajectory velocity.
  2. [KEY_INSIGHTS]: Identify exactly the TOP 3 most impactful neural trends observed. Each insight must be backed by specific data points from the patterns.
  3. [STRATEGIC_RECOMMENDATIONS]: Provide 3 high-impact tactical maneuvers. These MUST be derived directly from the Admiral's latest directives and advice provided above.
  4. [PERFORMANCE_MATRIX]: Analysis of platform/sector synergies and cross-channel resonance.
  5. [NEURAL_FORECAST]: A 30-day projection of fleet momentum based on current vector velocity and NTS optimization lift.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Chief Tactical Officer in a futuristic space navy. Your reports are analytical, authoritative, and prioritize high-value strategic synthesis. Use bolding and technical terms. Format sections with bracketed headers like [SECTION_NAME] for parsing. Ensure the 'Strategic Recommendations' section explicitly references the Admiral's advice provided in the context.",
        thinkingConfig: { thinkingBudget: 16384 },
        temperature: 0.3,
      },
    });
    return response.text || "Report generation failed.";
  } catch (e) {
    return "Failed to establish secure link for report generation.";
  }
};

export const fetchLiveContext = async (keyword: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a tactical assessment of the current social media landscape for the keyword: "${keyword}". 
      Analyze recent trends, volume, and sentiment volatility. 
      Return ONLY a comma-separated list of three numbers in this exact order:
      Engagement_Score (0-1000), Trend_Multiplier (0.5-5.0), Sentiment_Volatility (0-100).
      Example: 450, 1.2, 15`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    return response.text || "0, 1.0, 0";
  } catch (e) {
    console.error("Live context error:", e);
    return "0, 1.0, 0";
  }
};
