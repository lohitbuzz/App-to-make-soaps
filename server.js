// server.js — Lohit SOAP App v1.4 (fixed index path, assistant-ready)

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Resolve paths correctly inside /src
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👉 FIXED: index.html lives ONE LEVEL ABOVE /src
const INDEX_PATH = path.join(__dirname, "..", "index.html");

// 👉 STATIC FILES: also served from repo root
app.use(express.static(path.join(__dirname, "..")));

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Assistant ID (optional)
const ASSISTANT_ID = process.env.ASSISTANT_ID || null;

// Log on boot
console.log("----------------------------------------------------");
console.log("Lohit SOAP App v1.4 starting up…");
console.log("Assistant ID:", ASSISTANT_ID ?? "none (using raw model)");
console.log("----------------------------------------------------");

// -----------------------------------------------------
// ROUTES
// -----------------------------------------------------

// 👉 Homepage
app.get("/", (req, res) => {
  res.sendFile(INDEX_PATH);
});

// 👉 SOAP generation route
app.post("/generate-soap", async (req, res) => {
  try {
    const { prompt } = req.body;

    // If Assistant ID is present → use your custom Assistant
    if (ASSISTANT_ID) {
      console.log("Using Assistant:", ASSISTANT_ID);

      const thread = await client.beta.threads.create({
        messages: [
          { role: "user", content: prompt }
        ]
      });

      const run = await client.beta.threads.runs.createAndPoll(
        thread.id,
        { assistant_id: ASSISTANT_ID }
      );

      const messages = await client.beta.threads.messages.list(thread.id);

      const output = messages.data[0].content[0].text.value;
      return res.json({ output });
    }

    // Otherwise → normal model
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const output = completion.choices[0].message.content;
    return res.json({ output });

  } catch (err) {
    console.error("ERROR /generate-soap:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------
// SERVER START
// -----------------------------------------------------

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🔥 Lohit SOAP App v1.4 listening on port ${PORT}`);
  console.log("Root index:", INDEX_PATH);
});