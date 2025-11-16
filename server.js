import express from "express";
import cors from "cors";
import path from "path";
import OpenAI from "openai";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- OpenAI client ---
const apiKey = process.env.OPENAI_API_KEY;
let client = null;

if (apiKey) {
  client = new OpenAI({ apiKey });
  console.log("✅ OpenAI client initialized.");
} else {
  console.warn("⚠️ OPENAI_API_KEY not set. /api/soap will run in STUB mode.");
}

// Best model (can override with OPENAI_MODEL env var if needed)
const MODEL = process.env.OPENAI_MODEL || "gpt-5.1";

// --- Helper: generate SOAP from intake ---
async function generateSoapFromInput(inputBody) {
  const prettyInput = JSON.stringify(inputBody || {}, null, 2);

  const prompt =
    "You are a veterinary assistant generating SOAP notes for a small animal clinic.\n" +
    "Use EXACTLY these section headers once each, in this order:\n" +
    "Subjective:\nObjective:\nAssessment:\nPlan:\nMedications Dispensed:\nAftercare:\n\n" +
    "Rules:\n" +
    "- Output must be plain text, Avimark-compatible. No bullets, no numbering, no markdown.\n" +
    "- No extra blank lines between sections.\n" +
    "- Bloodwork values should appear as data-only in Objective; interpretations go in Assessment.\n" +
    "- Do NOT invent vitals, diagnostics, or drugs not mentioned in the input.\n" +
    "- If information is missing, write 'Details not provided.' for that part.\n\n" +
    "Here is the structured intake from the SOAP app as JSON:\n\n" +
    prettyInput +
    "\n\nWrite a complete SOAP note using the clinic rules.";

  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
    temperature: 0.3
  });

  // Responses API convenience field
  const soapText = response.output_text?.trim() || "";

  return soapText;
}

// --- ROUTES ---

// SOAP endpoint (AI + fallback)
app.post("/api/soap", async (req, res) => {
  // No key → stub mode
  if (!client) {
    const body = JSON.stringify(req.body || {}, null, 2);
    const stub = `SOAP generation is in STUB mode (no API key).\n\nInput received:\n${body}`;
    return res.json({ mode: "stub", soap: stub, soapText: stub });
  }

  try {
    const soapText = await generateSoapFromInput(req.body);
    res.json({ mode: "ai", soap: soapText, soapText });
  } catch (err) {
    console.error("❌ Error in /api/soap:", err);
    const body = JSON.stringify(req.body || {}, null, 2);
    const fallback =
      "SOAP generation temporarily unavailable due to an error.\n\n" +
      "Here is your raw input so nothing is lost:\n" +
      body;
    res.json({ mode: "error", soap: fallback, soapText: fallback });
  }
});

// Toolbox: still stub for now
app.post("/api/toolbox", (req, res) => {
  const pretty = JSON.stringify(req.body || {}, null, 2);
  const txt = `Toolbox is in STUB mode.\n\nInput:\n${pretty}`;
  res.json({ mode: "stub", output: txt });
});

// Feedback: just logs it for you (no AI)
app.post("/api/feedback", (req, res) => {
  console.log("📥 Feedback received:", req.body);
  res.json({ status: "ok", message: "Feedback received (stub)" });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
