import { GoogleGenAI, Type } from "@google/genai";
import { DataRow } from '../types';

export const analyzeAndCleanData = async (
  data: DataRow[], 
  instruction: string,
  modelName: string = 'gemini-3-flash-preview'
): Promise<{ cleanedData: DataRow[], summary: string }> => {
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  // Limit data size for context window constraints if necessary, 
  // but Flash has a large context. We will send a substantial chunk.
  // For safety in this demo, let's limit to top 200 rows if it's huge, 
  // but real usage would handle pagination or larger contexts.
  const dataContext = JSON.stringify(data.slice(0, 300)); 
  const isTruncated = data.length > 300;

  const prompt = `
    You are an expert Data Engineer. 
    Here is a JSON dataset representing rows from an Excel sheet.
    
    User Instruction: "${instruction}"

    Task:
    1. Apply the user's cleaning instruction to the data.
    2. If the user instruction is generic (e.g., "Clean this"), automatically identify and fix common issues:
       - Standardize date formats to YYYY-MM-DD.
       - Fix inconsistent capitalization in text fields (Title Case for names).
       - Trim whitespace.
       - Fill obvious missing values if inferred contextually, otherwise leave as empty string.
    3. Return the CLEANED data as a JSON array.
    4. Provide a brief summary of what changes were made.

    Data (JSON):
    ${dataContext}
    
    ${isTruncated ? "Note: Only the first 300 rows are provided. Apply logic to these." : ""}
  `;

  // We use structured output to ensure valid JSON
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cleanedData: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT },
            description: "The array of cleaned row objects."
          },
          summary: {
            type: Type.STRING,
            description: "A short summary of the cleaning operations performed."
          }
        },
        required: ["cleanedData", "summary"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  try {
    const result = JSON.parse(text);
    return {
      cleanedData: result.cleanedData,
      summary: result.summary
    };
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("AI returned invalid data format.");
  }
};

export const suggestCleaningSteps = async (data: DataRow[]): Promise<string[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return ["Standardize Dates", "Remove Duplicates", "Fix Casing"]; // Fallback

    const ai = new GoogleGenAI({ apiKey });
    const sample = JSON.stringify(data.slice(0, 10));

    const prompt = `
        Analyze this data sample and suggest 3 short, actionable cleaning steps a user might want to perform.
        Examples: "Format 'Date' column", "Normalize 'City' names", "Remove rows with empty ID".
        Return only a JSON array of strings.
        
        Data: ${sample}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        return ["Standardize Formats", "Remove Empty Rows", "Fix Inconsistencies"];
    }
};
