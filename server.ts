import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize the server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Story generation API endpoint
app.post("/api/generate-story", async (req, res) => {
  try {
    const { vocabulary, level } = req.body;
    if (!vocabulary || !Array.isArray(vocabulary) || vocabulary.length === 0) {
      return res.status(400).json({ error: "Vocabulary list is required and must be an array of words." });
    }
    if (!level) {
      return res.status(400).json({ error: "Level is required." });
    }

    const prompt = `You are an expert language learning materials creator.
Create a highly engaging, meaningful, and cohesive story appropriate for language learners at the "${level}" level.

The story MUST incorporate ALL of the following English vocabulary words (or their natural inflected forms like past tense, plurals, active verb forms, adverb forms, etc.):
${JSON.stringify(vocabulary)}

Guidelines for the story and translations:
1. Level Complexity constraints:
   - Beginner: Present simple, very short, repetitive sentences, basic vocabulary.
   - Elementary: Past/present simple, common nouns/verbs, short paragraphs.
   - Pre-Intermediate: Basic descriptive adjectives, basic connectors (because, but, then), diverse everyday situations.
   - Intermediate: Descriptive adverbials, basic passive voice, compound sentences, standard narrative tenses.
   - Upper-Intermediate: Nuanced vocabulary, passive voice, mixed conditionals, abstract descriptions, idiomatic nuances.
   - IELTS: Rich academic context, passive constructions, complex subordinations, formal expressions, sophisticated cohesive devices.

2. Translate the generated story naturally into Russian and Uzbek. Ensure the translations are highly natural, idiomatic, and grammatically perfect.

3. HIGH-CONTRAST VOCABULARY HIGHLIGHTING (CRITICAL):
   - In the English story, wrap every single occurrence of the vocabulary words (or their inflections used in the text) in "<hl>" and "</hl>" tags. E.g., "He <hl>gathered</hl> the dry leaves in the <hl>forest</hl>."
   - In the Russian translation, wrap the exact Russian translation of those vocabulary words (inflected according to Russian grammar) in "<hl>" and "</hl>" tags as well! E.g., if "gathered" became "собрал", write "<hl>собрал</hl>".
   - In the Uzbek translation, wrap the exact Uzbek translation of those vocabulary words (inflected according to Uzbek grammar) in "<hl>" and "</hl>" tags! E.g., if "forest" became "o'rmon", write "<hl>o'rmon</hl>".

4. Create a comprehensive vocabulary mapping array matching each input vocabulary word with its dictionary translation, contextual usage, and level-appropriate definitions.

Strictly adhere to the following JSON schema representation for the output. Do not include markdown code block syntax inside the JSON string values.`;

    // High-demand resilient fallback models list
    const candidateModels = [
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ];

    let lastError: any = null;
    let responseText = "";

    // Iterate through candidates with automatic short retries on failure
    for (const modelName of candidateModels) {
      let attempts = 2; // Try each model up to twice before moving on
      while (attempts > 0) {
        try {
          console.log(`Attempting story generation with model: ${modelName} (${attempts} attempts remaining)`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  englishStory: { 
                    type: Type.STRING, 
                    description: "The complete English story where all target vocabulary words or their inflections are wrapped in <hl>...</hl> tags." 
                  },
                  russianTranslation: { 
                    type: Type.STRING, 
                    description: "The complete Russian translation of the story where the translated vocabulary words or their inflections are wrapped in <hl>...</hl> tags." 
                  },
                  uzbekTranslation: { 
                    type: Type.STRING, 
                    description: "The complete Uzbek translation of the story where the translated vocabulary words or their inflections are wrapped in <hl>...</hl> tags." 
                  },
                  vocabularyMapping: {
                    type: Type.ARRAY,
                    description: "Mapping of each vocabulary word to its translation and explanation.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        original: { type: Type.STRING, description: "The original English vocabulary word in dictionary form." },
                        contextEnglish: { type: Type.STRING, description: "The inflected word form or exact phrase used in the English story." },
                        contextRussian: { type: Type.STRING, description: "The translated inflected word form or exact phrase used in the Russian story." },
                        contextUzbek: { type: Type.STRING, description: "The translated inflected word form or exact phrase used in the Uzbek story." },
                        russianMeaning: { type: Type.STRING, description: "The dictionary translation in Russian." },
                        uzbekMeaning: { type: Type.STRING, description: "The dictionary translation in Uzbek." },
                        explanation: { type: Type.STRING, description: "A simple, level-appropriate English explanation of what the word means." }
                      },
                      required: ["original", "contextEnglish", "contextRussian", "contextUzbek", "russianMeaning", "uzbekMeaning", "explanation"]
                    }
                  }
                },
                required: ["title", "englishStory", "russianTranslation", "uzbekTranslation", "vocabularyMapping"]
              }
            }
          });

          if (response.text) {
            responseText = response.text;
            break; // Success! Break out of the attempts loop
          }
        } catch (error: any) {
          lastError = error;
          console.warn(`Error using model ${modelName}:`, error.message || error);
          attempts--;
          if (attempts > 0) {
            // Progressive wait backoff: 800ms
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      }

      if (responseText) {
        break; // Success! Break out of candidate models loop
      }
    }

    if (!responseText) {
      throw lastError || new Error("All generative models failed or are currently unavailable due to heavy traffic. Please try again in a moment.");
    }

    const storyData = JSON.parse(responseText);
    res.json(storyData);
  } catch (error: any) {
    console.error("Story generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate story." });
  }
});

// Text-to-Speech (TTS) API endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for TTS." });
    }

    const selectedVoice = voice || "Kore"; // Puck, Charon, Kore, Fenrir, Zephyr

    // Strip out highlighting tags so the TTS doesn't spell them out
    const cleanText = text.replace(/<\/hl>|<hl>/g, "");

    let response: any = null;
    let attempts = 2;
    let lastTtsError: any = null;

    while (attempts > 0) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice }
              }
            }
          }
        });
        if (response) {
          break;
        }
      } catch (err: any) {
        lastTtsError = err;
        console.warn(`TTS generation attempt failed with ${selectedVoice}:`, err.message || err);
        attempts--;
        if (attempts > 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    }

    if (!response) {
      throw lastTtsError || new Error("Failed to produce audio after multiple attempts.");
    }

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini TTS.");
    }

    res.json({ audioData: base64Audio });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS audio." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
