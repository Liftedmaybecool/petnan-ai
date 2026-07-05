import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as math from "mathjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON requests
app.use(express.json());

// Initialize Gemini SDK lazily to avoid crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please configure it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper: Wikipedia Search API
async function runWikipediaSearch(query: string) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Wikipedia Search API returned status ${res.status}`);
    }
    const data = await res.json() as any;
    const searchResults = data.query?.search || [];
    if (searchResults.length === 0) {
      return { message: `No Wikipedia articles found for search query: "${query}"` };
    }
    // Return top 5 search results with cleaned snippets
    const results = searchResults.slice(0, 5).map((item: any) => ({
      title: item.title,
      snippet: (item.snippet || "").replace(/<\/?[^>]+(>|$)/g, ""), // strip HTML tags
      pageid: item.pageid,
    }));
    return { results };
  } catch (error: any) {
    console.error("Wikipedia Search Error:", error);
    return { error: error.message || "Failed to search Wikipedia" };
  }
}

// Helper: Wikipedia Page Content API (Extract)
async function runWikipediaArticle(title: string) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Wikipedia Extract API returned status ${res.status}`);
    }
    const data = await res.json() as any;
    const pages = data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === "-1") {
      return { message: `Wikipedia article not found for title: "${title}"` };
    }
    const extract = pages[pageId].extract;
    if (!extract) {
      return { message: `The article "${title}" exists but contains no text extract.` };
    }
    return { title: pages[pageId].title, extract: extract.slice(0, 1500) }; // Limit extract size to stay within context windows
  } catch (error: any) {
    console.error("Wikipedia Extract Error:", error);
    return { error: error.message || "Failed to retrieve Wikipedia article content" };
  }
}

// Helper: Math Evaluation via Math.js
function runMathCalculation(expression: string) {
  try {
    // Basic sanitization
    if (/[a-zA-Z]/.test(expression)) {
      // Allow popular math constants and functions
      const allowedWords = /^(sin|cos|tan|log|ln|sqrt|pow|exp|pi|e|abs|ceil|floor|round|min|max|sum|mean|median|std|var)$/i;
      const words = expression.match(/[a-zA-Z]+/g) || [];
      for (const word of words) {
        if (!allowedWords.test(word)) {
          return { error: `Forbidden operation or variable name in math expression: "${word}"` };
        }
      }
    }
    const result = math.evaluate(expression);
    return { expression, result: typeof result === "object" ? result.toString() : result };
  } catch (error: any) {
    console.error("Math Calculation Error:", error);
    return { error: error.message || "Failed to calculate expression" };
  }
}

// Server API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "PetnanAI API Server" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, prioritySubject } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid request payload. 'messages' must be an array." });
      return;
    }

    const ai = getGeminiClient();

    // Implement a high-fidelity sliding memory window: Keep the last 16 messages
    // This allows PetnanAI to remember exactly the last 8 user inputs and 8 assistant responses,
    // which aligns perfectly with the short-term memory instruction (last 5-10 inputs).
    const limitedMessages = messages.slice(-16);

    // Convert messages to Gemini API format: { role: 'user' | 'model', parts: [{ text: '...' }] }
    // Ensure the conversation always starts with user, and roles strictly alternate.
    const contents: any[] = [];
    for (const m of limitedMessages) {
      const role = m.role === "assistant" ? "model" : "user";
      // Skip empty or invalid content messages to avoid API failures
      if (!m.content || typeof m.content !== "string") continue;
      contents.push({
        role,
        parts: [{ text: m.content }],
      });
    }

    if (contents.length === 0) {
      res.status(400).json({ error: "No valid messages found in request." });
      return;
    }

    // Tool function declarations
    const tools = [
      {
        functionDeclarations: [
          {
            name: "search_wikipedia",
            description: "Search Wikipedia for articles matching a search query. Use this to find factual information on history, science, geography, people, pop culture, and events.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                query: {
                  type: Type.STRING,
                  description: "The search query, e.g., 'Albert Einstein'",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_wikipedia_article",
            description: "Retrieve the introductory summary of a specific Wikipedia article by title. Use this after searching to get detailed factual data on a topic.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "The exact title of the Wikipedia page, e.g., 'Albert Einstein'",
                },
              },
              required: ["title"],
            },
          },
          {
            name: "calculate_math",
            description: "Evaluate a mathematical or arithmetic expression. Use this for all math, calculations, equations, algebra, science conversions, and calculations.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                expression: {
                  type: Type.STRING,
                  description: "The mathematical expression to evaluate, e.g., '2 + 2' or 'sqrt(144) * sin(pi/2)' or '100 * (1.05 ^ 10)'",
                },
              },
              required: ["expression"],
            },
          },
        ],
      },
    ];

    let systemInstruction = `You are PetnanAI, a super smart and enthusiastic AI companion who knows everything. 
You speak with professional composure, high intellect, and cheerful helpfulness.
You have a cool, sleek branding. When users ask questions requiring real-time factual data or mathematical calculations, you MUST use your tools (search_wikipedia, get_wikipedia_article, calculate_math) to retrieve highly accurate, exact information or solve math. Do not guess.
Always format your answers in clean, readable Markdown. Include bullet points, headings, or tables where appropriate to make information look organized and professional.`;

    if (prioritySubject && typeof prioritySubject === "string" && prioritySubject.trim() !== "" && prioritySubject !== "General") {
      systemInstruction += `\n\nCRITICAL CONTEXT PRIORITIZATION: The user has set the priority subject/focus of this session to: "${prioritySubject}". When searching for articles or explaining concepts, prioritize details, perspectives, and examples related to "${prioritySubject}" where relevant, making your vast knowledge in this area highly accessible and centered.`;
    }

    const activities: any[] = [];
    let loopCount = 0;
    const maxLoops = 5;
    let finalResponseText = "";

    // Tool execution loop
    while (loopCount < maxLoops) {
      loopCount++;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          tools,
          systemInstruction,
        },
      });

      const functionCalls = response.functionCalls;
      
      // If there are no function calls, the model has finished its reasoning and returned the final answer.
      if (!functionCalls || functionCalls.length === 0) {
        finalResponseText = response.text || "I was unable to formulate a response.";
        break;
      }

      // Add the model's response containing the function call(s) to the contents history
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      }

      // Execute each function call and collect responses
      for (const call of functionCalls) {
        const { name, args, id } = call;
        let result: any = null;

        if (name === "search_wikipedia") {
          const query = args.query as string;
          activities.push({
            type: "wikipedia_search",
            query,
            timestamp: new Date().toISOString(),
          });
          result = await runWikipediaSearch(query);
        } else if (name === "get_wikipedia_article") {
          const title = args.title as string;
          activities.push({
            type: "wikipedia_article",
            title,
            timestamp: new Date().toISOString(),
          });
          result = await runWikipediaArticle(title);
        } else if (name === "calculate_math") {
          const expression = args.expression as string;
          activities.push({
            type: "calculator",
            expression,
            timestamp: new Date().toISOString(),
          });
          result = runMathCalculation(expression);
        }

        // Push function response to the history
        contents.push({
          role: "tool",
          parts: [
            {
              functionResponse: {
                name,
                response: { result },
              },
            },
          ],
        });
      }
    }

    if (!finalResponseText && loopCount >= maxLoops) {
      finalResponseText = "I performed multiple operations to gather information but timed out before rendering the final response. Please try refining your query.";
    }

    res.json({
      text: finalResponseText,
      activities,
    });
  } catch (error: any) {
    console.error("Chat Handler Error:", error);
    res.status(500).json({
      error: "An error occurred while communicating with PetnanAI.",
      details: error.message || "Internal Server Error",
    });
  }
});

app.post("/api/synthesize", async (req, res) => {
  try {
    const { type, prompt } = req.body;
    if (!type || !prompt) {
      res.status(400).json({ error: "Missing type or prompt parameter." });
      return;
    }

    const ai = getGeminiClient();

    let systemInstruction = "";
    if (type === "image") {
      systemInstruction = `You are an expert AI vector artist and graphic designer. 
Your task is to analyze the user's prompt and generate a high-quality visual scene represented as a JSON object containing background properties and an array of shapes to be drawn sequentially on a 1000x1000 canvas.
Draw beautiful, thematic, clean vector artwork. Be highly creative. If the prompt asks for specific things (e.g., "a red rose", "a fast sports car", "sunset on the beach"), compose the shapes, paths, lines, and gradients to represent those elements beautifully and recognizably, rather than just drawing generic abstract waves.

Output a JSON matching this TypeScript structure:
{
  "background": {
    "type": "linear" | "radial" | "solid",
    "colors": string[], // 1 to 3 hex colors (e.g., ["#020617", "#1e1b4b"])
    "angle": number // Optional linear gradient angle in degrees (0-360)
  },
  "shapes": Array<{
    "type": "circle" | "ellipse" | "rect" | "line" | "path" | "text" | "star" | "glowing_orb" | "grid" | "wave",
    "x": number, // 0 to 1000
    "y": number, // 0 to 1000
    "size": number, // Optional radius or size parameter
    "width": number, // Optional width (for rect, ellipse)
    "height": number, // Optional height (for rect, ellipse)
    "color": string, // hex color or rgba (e.g., "rgba(244, 63, 94, 0.8)")
    "strokeColor": string, // Optional stroke hex or rgba
    "strokeWidth": number, // Optional stroke width (default 1)
    "shadowColor": string, // Optional glow shadow color
    "shadowBlur": number, // Optional glow blur size
    "text": string, // Optional (only for "text" type)
    "font": string, // Optional (only for "text" type, e.g. "bold 24px Inter")
    "alpha": number, // Optional opacity (0 to 1, default 1)
    "rotation": number, // Optional rotation in degrees (0-360)
    "sides": number, // Optional (for "star" type, number of points)
    "points": Array<{ "x": number, "y": number }> // Optional (only for "path" or "line" types, list of sequential coordinates)
  }>
}

Constraints:
1. Return ONLY the raw JSON object. Do not include any Markdown blocks, comments or backticks.
2. Limit shapes to a maximum of 30 items for high-performance canvas rendering.`;
    } else if (type === "music") {
      systemInstruction = `You are an expert AI musical composer and synthesizer sound designer.
Your task is to translate the user's prompt (tempo, mood, style, instruments) into a detailed procedural MIDI-like synth configuration in JSON format.
Compositions should be elegant, rhythmic, and highly tailored to the prompt. If the prompt is "sad, rainy", choose a low tempo (e.g. 65 BPM), a minor scale, a low base pitch, soft volume levels, and long pads. If the prompt is "cyberpunk", choose a high tempo (e.g. 130 BPM), sawtooth leads, aggressive bass notes, and a high-energy arpeggiated lead.

Output a JSON matching this TypeScript structure:
{
  "tempoBPM": number, // 60 to 150
  "basePitch": number, // Base MIDI root note, 36 to 64 (e.g. 48 for C3)
  "scale": number[], // Scale semitone offsets relative to basePitch, e.g. [0, 2, 4, 5, 7, 9, 11] (Major), [0, 2, 3, 5, 7, 8, 10] (Natural Minor), [0, 2, 3, 5, 7, 8, 11] (Harmonic Minor), [0, 2, 3, 5, 7, 9, 10] (Dorian), [0, 1, 3, 5, 7, 8, 10] (Phrygian), [0, 2, 4, 7, 9] (Pentatonic Major)
  "chordProgression": number[], // Array of MIDI note offset steps representing the root chord movement, length 4 (e.g., [0, 3, 7, 5])
  "leadSynthType": "sine" | "triangle" | "sawtooth" | "square",
  "padSynthType": "sine" | "triangle" | "sawtooth" | "square",
  "bassSynthType": "sine" | "triangle" | "sawtooth" | "square",
  "filterFreq": number, // Cutoff frequency in Hz, 200 to 4000
  "melody": Array<{
    "noteIndex": number, // The scale degree index (0 is root, 1 is 2nd note, etc.). Can also be negative for lower octaves, or >=7 for higher octaves.
    "time": number, // Starting time in BEATS, from 0 to 16 beats (the entire loop is exactly 16 beats)
    "duration": number, // Duration in BEATS (e.g., 0.25, 0.5, 1, 2)
    "volume": number, // 0.1 to 1.0 (relative loudness)
    "type": "lead" | "bass" | "pad"
  }>
}

Compose a rich 16-beat sequence with 12 to 40 notes including:
1. Deep, rhythmic bass notes on beats 0, 4, 8, 12.
2. Long-duration atmospheric pad notes spanning multiple beats (e.g. start at 0 duration 4, start at 4 duration 4, etc.)
3. An active, catchy melodious lead layer with varying notes, syncopation, or arpeggiating patterns.
Return ONLY raw JSON. Do not include any Markdown blocks, comments or backticks.`;
    } else if (type === "video") {
      systemInstruction = `You are an expert AI interactive motion graphics animator.
Your task is to translate the user's prompt into dynamic motion instructions in JSON format for drawing full-frame interactive animations on a canvas.
The video will be generated by rendering these elements frame-by-frame with a time-based multiplier to create beautiful, fluid loops.

Output a JSON matching this TypeScript structure:
{
  "canvasBackground": string, // hex color (e.g., "#020617" or "#000000")
  "particleType": "stars" | "matrix" | "digital_rain" | "waves" | "bubbles" | "snow" | "fireflies" | "comets" | "none",
  "particleColor": string, // hex color
  "particleCount": number, // 10 to 120
  "particleSpeed": number, // 0.2 to 4
  "animatedElements": Array<{
    "type": "pulse_orb" | "rotate_polygon" | "sine_wave" | "expanding_ripple" | "lissajous" | "floating_grid" | "helix" | "glowing_tunnel",
    "x": number, // 0 to 600
    "y": number, // 0 to 400
    "size": number, // Base size or radius
    "color": string, // hex or rgba with opacity
    "secondaryColor": string, // hex or rgba
    "speed": number, // speed multiplier for movement / pulsation (e.g., 0.5 to 2.5)
    "sides": number, // Optional, number of sides for polygon (3 to 10)
    "amplitude": number, // Optional, amplitude of waves/ripples
    "frequency": number, // Optional, frequency/spacing
    "count": number // Optional, number of lines or waves (e.g., 1 to 8)
  }>
}

Create 2 to 8 high-fidelity animated elements of various speeds and sizes that visually match the style, tempo, and theme requested by the user's prompt.
Return ONLY raw JSON. Do not include any Markdown blocks, comments or backticks.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate custom synthesis configuration for: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const configText = response.text || "{}";
    const config = JSON.parse(configText.trim());
    res.json({ success: true, config });
  } catch (error: any) {
    console.error("Synthesis generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate synthesis config" });
  }
});

// Setup Vite Dev Server / Static Hosting
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PetnanAI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
