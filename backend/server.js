// backend/server.js

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

// Load env for Render secret file (and fall back to local .env)
dotenv.config({ path: "/etc/secrets/.env" });
dotenv.config();

// Quick sanity log for API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing. Check your Render secret file.");
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

// ----------------------------------------------------
// Simple health check
// ----------------------------------------------------
app.get("/", (req, res) => {
  res.send("Lohit SOAP backend is alive.");
});

// ----------------------------------------------------
// SYSTEM BRAIN PROMPT
// ----------------------------------------------------
const SYSTEM_PROMPT = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.

Your job:
- Turn intake text into high-quality Avimark-friendly SOAPs and toolbox outputs.
- Follow the clinic’s Master Rules for surgical, dental, and appointment SOAPs
  (Plan categories order, drug formatting with concentrations in brackets, ASA,
  bloodwork in Objective as data-only, interpretations in Assessment, etc.).
- Follow privacy rules: never invent or echo client names, pet names, phone
  numbers, email, addresses, or microchip numbers. If present in intake, ignore them.
- Always output single-spaced, Avimark-compatible plain text with no weird bullets.
- For toolbox outputs (bloodwork/email/etc.), be concise and clinically useful.

Do NOT ask the user questions in the output. Just give the final text.
`;

// Helper: build intake string from body for SOAP
function buildSoapIntake(body) {
  try {
    const {
      mode,                // "appointment" | "surgery"
      soapType,            // optional
      appointment,         // object with fields
      surgery,             // object with fields
      accuracyMode,        // "Strict" | "Help Me"
      notes,
    } = body;

    let parts = [];

    if (mode) parts.push(`Mode: ${mode}`);
    if (soapType) parts.push(`Template: ${soapType}`);
    if (accuracyMode) parts.push(`Accuracy mode: ${accuracyMode}`);

    if (appointment) {
      parts.push("=== Appointment Intake ===");
      if (appointment.reason) parts.push(`Reason: ${appointment.reason}`);
      if (appointment.history) parts.push(`History: ${appointment.history}`);
      if (appointment.pe) parts.push(`PE (findings only): ${appointment.pe}`);
      if (appointment.diagnostics)
        parts.push(`Diagnostics (data-only): ${appointment.diagnostics}`);
      if (appointment.assessmentNotes)
        parts.push(`Assessment notes: ${appointment.assessmentNotes}`);
      if (appointment.planNotes)
        parts.push(`Plan notes: ${appointment.planNotes}`);
      if (appointment.medsDispensed)
        parts.push(`Meds dispensed (notes): ${appointment.medsDispensed}`);
    }

    if (surgery) {
      parts.push("=== Surgery Intake ===");
      if (surgery.caseType) parts.push(`Surgery case type: ${surgery.caseType}`);
      if (surgery.signalment) parts.push(`Signalment: ${surgery.signalment}`);
      if (surgery.history) parts.push(`History: ${surgery.history}`);
      if (surgery.pe) parts.push(`PE (findings only): ${surgery.pe}`);
      if (surgery.diagnostics)
        parts.push(`Diagnostics (data-only): ${surgery.diagnostics}`);
      if (surgery.asa) parts.push(`ASA: ${surgery.asa}`);
      if (surgery.procedureNotes)
        parts.push(`Procedure notes: ${surgery.procedureNotes}`);
      if (surgery.recoveryNotes)
        parts.push(`Recovery notes: ${surgery.recoveryNotes}`);
      if (surgery.medsDispensed)
        parts.push(`Meds dispensed (notes): ${surgery.medsDispensed}`);
      if (surgery.anesthesiaNotes)
        parts.push(`Anesthesia notes: ${surgery.anesthesiaNotes}`);
    }

    if (notes) parts.push(`General notes: ${notes}`);

    return parts.join("\n");
  } catch (e) {
    console.error("Error building SOAP intake:", e);
    return JSON.stringify(body);
  }
}

// ----------------------------------------------------
// SOAP endpoint
// ----------------------------------------------------
app.post("/api/soap", async (req, res) => {
  try {
    const intakeText = buildSoapIntake(req.body);
    console.log("📨 /api/soap called. Mode:", req.body.mode);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `
You will generate a single Avimark-friendly SOAP (Subjective, Objective, Assessment, Plan).
If the intake suggests a toolbox-style request instead of a SOAP, still produce a SOAP-like output.

INTAKE:
${intakeText}
          `.trim(),
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("⚠️ /api/soap: completion returned empty content");
      return res
        .status(500)
        .json({ error: "Model returned no text for SOAP." });
    }

    // IMPORTANT: always return { text: ... } for the frontend
    return res.json({ text });
  } catch (err) {
    console.error("❌ Error in /api/soap:", err);
    return res
      .status(500)
      .json({ error: "Server error in /api/soap: " + err.message });
  }
});

// ----------------------------------------------------
// Toolbox endpoint
// ----------------------------------------------------
app.post("/api/toolbox", async (req, res) => {
  try {
    const { tool, subtype, toolboxInput, templatesSummary } = req.body;

    console.log("📨 /api/toolbox called. Tool:", tool, "Subtype:", subtype);

    const promptParts = [];

    if (tool) promptParts.push(`Selected tool: ${tool}`);
    if (subtype) promptParts.push(`Context/subtype: ${subtype}`);
    if (templatesSummary)
      promptParts.push(`Relevant saved templates:\n${templatesSummary}`);
    if (toolboxInput) promptParts.push(`User input:\n${toolboxInput}`);

    const toolboxPrompt = promptParts.join("\n\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `
You are the Toolbox Brain for the Lohit SOAP App.

Tools may include:
- Bloodwork helper (short/standard explanation of abnormalities, client-friendly if implied)
- Email/Client communication helper
- Note/paragraph generator for medical records

General rules:
- Be concise and clinically useful.
- For bloodwork, clearly separate "Summary" and "Details" if appropriate.
- Never include client or pet names.
- Output plain text only.
          `.trim(),
        },
        {
          role: "user",
          content: toolboxPrompt,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("⚠️ /api/toolbox: completion returned empty content");
      return res
        .status(500)
        .json({ error: "Model returned no text for toolbox." });
    }

    // IMPORTANT: always { text: ... }
    return res.json({ text });
  } catch (err) {
    console.error("❌ Error in /api/toolbox:", err);
    return res
      .status(500)
      .json({ error: "Server error in /api/toolbox: " + err.message });
  }
});

// ----------------------------------------------------
// Feedback endpoint (for Toolbox / SOAP feedback box)
// ----------------------------------------------------
app.post("/api/feedback", async (req, res) => {
  try {
    const { originalText, feedbackText, toolContext } = req.body;

    console.log("📨 /api/feedback called. Context:", toolContext || "SOAP");

    const description = toolContext || "output";

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You refine previous outputs for the Lohit SOAP App.

- Take the original text and the user's feedback.
- Produce a **revised** version that respects the feedback but stays clinically accurate
  and Avimark-friendly.
- Do not explain the changes; just return the new version of the text.
          `.trim(),
        },
        {
          role: "user",
          content: `
Here is the current ${description}:

${originalText || "(none)"}

Here is the user's feedback / correction:

${feedbackText || "(none)"}

Please return a revised version only.
          `.trim(),
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("⚠️ /api/feedback: completion returned empty content");
      return res
        .status(500)
        .json({ error: "Model returned no text for feedback." });
    }

    // Again: { text: ... } for the frontend
    return res.json({ text });
  } catch (err) {
    console.error("❌ Error in /api/feedback:", err);
    return res
      .status(500)
      .json({ error: "Server error in /api/feedback: " + err.message });
  }
});

// ----------------------------------------------------
// Start server
// ----------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Lohit SOAP backend listening on port ${port}`);
});