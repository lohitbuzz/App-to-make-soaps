// src/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const ASSISTANT_ID = process.env.ASSISTANT_ID || null;
const MASTER_RULES = process.env.MASTER_RULES || "";

// Log assistant info (for sanity check in Render logs)
console.log(`Lohit SOAP App v1.4 starting on port ${PORT}`);
if (ASSISTANT_ID) {
  console.log(`Assistant ID configured: ${ASSISTANT_ID}`);
} else {
  console.log("Assistant ID not set yet (ASSISTANT_ID env var empty).");
}

// Middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve static assets from /public
app.use(express.static(path.join(__dirname, "public")));

// Root route → send /public/index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ------------------------------------------------------------------ */
/*  API: SOAP GENERATOR                                               */
/* ------------------------------------------------------------------ */

app.post("/api/soap", async (req, res) => {
  try {
    const {
      caseLabel,
      type,
      template,
      reason,
      notes,
      accuracy,
      species
    } = req.body || {};

    const accuracyLabel = accuracy || "Medium";

    const systemPrompt = `
You are the Lohit SOAP App, generating Avimark-compatible SOAP notes for a small-animal veterinary clinic.

Follow these MASTER RULES exactly (if present):

${MASTER_RULES}

Hard rules:
- Output MUST be pure JSON, no backticks, no extra text.
- JSON keys: "subjective", "objective", "assessment", "plan", "medications", "aftercare".
- Values must be single strings suitable for pasting into Avimark.
- Single spacing only, no blank lines inside sections.
- Do NOT include medication administration times.
- When in doubt, be conservative and mention missing information rather than inventing details.
`;

    const userPrompt = `
Case label: ${caseLabel || "Not provided"}
Type: ${type || "Appointment"}
Species: ${species || "Not provided"}
Template: ${template || "Not provided"}
Reason for visit: ${reason || "Not provided"}
Plan / Notes: ${notes || "Not provided"}
Accuracy mode: ${accuracyLabel}

Using the MASTER RULES and clinic preferences, generate a complete SOAP in JSON with keys:
"subjective", "objective", "assessment", "plan", "medications", "aftercare".

If specific information (e.g. bloodwork values, drug doses) is not given, you may:
- Mention that details were not provided, but
- Still produce a clinically sensible, conservative template following the clinic's style.
`;

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      // Fallback: wrap the whole thing in Plan if JSON parsing fails
      console.error("Failed to parse SOAP JSON, returning fallback:", e);
      data = {
        subjective: "Details not provided.",
        objective: "Details not provided.",
        assessment: "Details not provided.",
        plan: raw || "Unable to parse structured response.",
        medications: "Details not provided.",
        aftercare: "Details not provided."
      };
    }

    // Ensure all keys exist so the front-end never crashes
    const safe = {
      subjective: data.subjective || "Details not provided.",
      objective: data.objective || "Details not provided.",
      assessment: data.assessment || "Details not provided.",
      plan: data.plan || "Details not provided.",
      medications: data.medications || "Details not provided.",
      aftercare: data.aftercare || "Details not provided."
    };

    res.json(safe);
  } catch (err) {
    console.error("Error in /api/soap:", err);
    res.status(500).json({
      error: "SOAP generation failed.",
      details: err.message || String(err)
    });
  }
});

/* ------------------------------------------------------------------ */
/*  API: TOOLBOX (Bloodwork, Emails, etc.)                            */
/* ------------------------------------------------------------------ */

app.post("/api/toolbox", async (req, res) => {
  try {
    const { mode, clinic, fromName, text } = req.body || {};

    // Stub behaviour with light AI support
    const baseSystemPrompt = `
You are the "Toolbox" helper for the Lohit SOAP App.

MASTER RULES (if any):

${MASTER_RULES}

You may be asked to:
- Summarize or interpret bloodwork.
- Draft client emails in a professional, friendly tone.
- Rephrase or clean up clinical notes.

Always:
- Keep content Avimark-pastable (plain text, no bullet symbols that break Avimark).
- Avoid including client phone numbers or addresses unless they are already in the prompt.
`;

    const userPrompt = `
Mode: ${mode || "Not specified"}
Clinic: ${clinic || "Not specified"}
From: ${fromName || "Not specified"}

Input text:
${text || "None provided"}

Respond with plain text only, no JSON, no markdown.
`;

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: baseSystemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const output = completion.choices[0]?.message?.content?.trim() || "";

    res.json({
      mode: mode || "unknown",
      clinic: clinic || "",
      fromName: fromName || "",
      output
    });
  } catch (err) {
    console.error("Error in /api/toolbox:", err);
    res.status(500).json({
      error: "Toolbox processing failed.",
      details: err.message || String(err)
    });
  }
});

/* ------------------------------------------------------------------ */
/*  API: FEEDBACK (simple echo / log)                                 */
/* ------------------------------------------------------------------ */

app.post("/api/feedback", async (req, res) => {
  try {
    const { text, tab, context } = req.body || {};
    console.log("Feedback received:", { tab, text });

    // For now we just acknowledge. Later we can push to Miro / HQ.
    res.json({
      status: "ok",
      message: "Feedback received. Thank you!",
      echo: {
        tab: tab || "unknown",
        context: context || "",
        text: text || ""
      }
    });
  } catch (err) {
    console.error("Error in /api/feedback:", err);
    res.status(500).json({
      error: "Feedback endpoint failed.",
      details: err.message || String(err)
    });
  }
});

/* ------------------------------------------------------------------ */
/*  START SERVER                                                      */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.4 listening on port ${PORT}`);
});