import express from "express";
import { createServer as createViteServer } from "vite";
import { AssemblyAI } from 'assemblyai';
import dotenv from 'dotenv';

dotenv.config();

const AAI_API_KEY = "8031807a806645c0b88135aad3b797f0";
const aai = new AssemblyAI({ apiKey: AAI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Sentiment Analysis
  app.post("/api/sentiment", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    try {
      const response = await aai.lemur.task({
        prompt: "Analyze the sentiment of the following user speech in a supportive conversation with an AI guide. Provide a sentiment label (Positive, Negative, or Neutral) and a brief explanation of the emotional tone. Format: Label: [Label], Tone: [Tone]",
        input_text: text
      });

      const result = response.response;
      const labelMatch = result.match(/Label:\s*(Positive|Negative|Neutral)/i);
      const label = labelMatch ? labelMatch[1] : "Neutral";
      
      res.json({ 
        label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
        fullResponse: result
      });
    } catch (error) {
      console.error("Sentiment analysis failed:", error);
      res.status(500).json({ error: "Sentiment analysis failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
