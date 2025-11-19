// backend/server.js

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

// Load .env from Render Secret File location
dotenv.config({ path: "/etc/secrets/.env" });

// Sanity check API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing in environment.");
} else {
  console.log("✅ OPENAI_API_KEY loaded.");
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple health check
app.get("/", (req, res) => {
  res.send("Lohit SOAP backend is alive.");
});

// -------------------- MAIN SOAP ENDPOINT --------------------
// Frontend sends: { mode, tab, intakeText }
app.post("/api/soap", async (req, res) => {
  try {
    const { mode = "Help Me", tab = "appointment", intakeText = "" } = req.body;

    if (!intakeText || typeof intakeText !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing intakeText from frontend.",
      });
    }

    const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.

Follow all Master Rules, surgery templates, dental templates, drug formatting,
ASA handling, Avimark spacing rules, and clinic privacy rules from 2024–2025.

Global rules:
- Never create client/pet names or microchip numbers.
- Always format SOAPs exactly as the clinic requires.
- Include Plan categories in correct order.
- Include drug concentrations in brackets immediately after drug names.
- Never invent vitals in Strict mode.
- Return Avimark-friendly plain text with single spacing.
`;

    const userPrompt = `
Mode: ${mode}
Tab: ${tab}

INTAKE NOTES (from app):
${intakeText}

Task:
- If Tab = appointment: generate a full SOAP for a small animal appointment using clinic rules.
- If Tab = surgery: generate a full surgical SOAP (with Subjective, Objective, Assessment, Plan sections and Plan 1–9 categories).
- If Tab = toolbox: generate a short, Avimark-compatible paragraph or small block of text for the requested helper (bloodwork summary, client email, etc.).
- If Tab = consult: answer as if you are chatting directly with Dr. Lohit about the case; keep it concise and clinical.

Respect clinic formatting and privacy rules.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: mode === "Strict" ? 0.1 : 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      return res.status(500).json({
        ok: false,
        error: "No text returned from model.",
      });
    }

    res.json({ ok: true, text });
  } catch (err) {
    console.error("Error in /api/soap:", err);
    res.status(500).json({
      ok: false,
      error: "Server error while generating SOAP.",
    });
  }
});

// -----------------------------------------------------------

app.listen(port, () => {
  console.log(`🚀 Lohit SOAP backend listening on port ${port}`);
});