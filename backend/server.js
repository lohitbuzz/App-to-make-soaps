// backend/server.js

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*", // Netlify + local; tighten later if you want
  })
);
app.use(express.json({ limit: "10mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- SYSTEM PROMPTS ----------------

const SYSTEM_PROMPT_SOAP = `
You are the Lohit SOAP App Brain for Dr. Lohit Busanelli.

GOALS:
- Turn intake info + optional images into a single, Avimark-friendly SOAP.
- Follow the clinic's Master Rules, surgery & dental templates, drug formatting, and privacy rules from late 2024–2025.

HARD RULES:
- Never invent client or pet names or microchip numbers.
- Never copy or expose microchip numbers even if they appear in images.
- No owner contact info, addresses, emails, phone numbers, or signatures.
- Always keep text Avimark-friendly: plain text, no markdown, no bullets unless obvious.

SOAP RULES:
- Subjective: concise case summary and owner concerns.
- Objective: full PE by system (General, Vitals, Eyes, Ears, Oral, Nose, Resp, CV, Abd, UG, MSK, Neuro, Integ, Lymph). 
  Bloodwork/rads here are data-only (numbers / findings), no interpretation.
- Assessment: problem list + differentials + interpretation of diagnostics. Include ASA grade for anesthesia/surgery.
- Plan (surgical/anesthetic cases): always in this order with spacing only between categories:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Write drug concentrations in brackets immediately after drug names (e.g. "Metacam [1.5 mg/ml]").
- Midazolam concentration is always written as [5 mg/ml].
- No exact administration times; only drug, dose, route.
- Bloodwork interpretation must be in Assessment, never in Objective.

DENTAL & SURGICAL EXTRAS:
- For extractions: mention use of #10 blade and periosteal elevator, AAHA/AVDC style technique, and closure phrase:
  "tension-free flap, no denuded bone, suture line not over defect" using 4-0 Monocryl in a simple interrupted pattern.
- Mention local oral nerve blocks (infraorbital, maxillary, mental, inferior alveolar) with lidocaine, within safe mg/kg limits.
- Monitoring includes SpO2, ETCO2, blood pressure, ECG, and fluids.

TONE:
- Professional, concise, and readable by busy vets.
- If information is missing, still produce a SOAP and clearly state assumptions in Assessment.
`;

const SYSTEM_PROMPT_VISION = `
You are a veterinary vision assistant. 
You receive 1–5 images (bloodwork PDFs, radiology reports, anesthesia sheets, handwritten notes) plus a short prompt.

Tasks:
- Read the images carefully.
- Pull out only clinically important data (abnormal values, key notes).
- Answer the prompt in a short, practical way for a small animal GP clinic.

Privacy:
- Ignore any owner/pet names, microchip numbers, addresses, phone numbers, emails, and signatures.
- Never repeat IDs or microchip numbers in your answer.
`;

const SYSTEM_PROMPT_FEEDBACK = `
You are a friendly, highly skilled veterinary SOAP editor.

Tasks:
- Take the existing text (SOAP, email draft, or note) plus a short request from the doctor.
- Return an improved version that keeps ALL real clinical content accurate.
- Respect Avimark spacing and the clinic's style (no markdown, no bullets unless already there).

Never:
- Invent new diagnostics, treatments, or drug doses that were not in the original unless explicitly requested.
- Add client or patient names or microchip numbers.
`;

// --------------- HELPERS -----------------

function buildSoapUserContent(body) {
  const { mode, caseType, appointment, surgery, consultMessage, images } =
    body || {};

  const intakeSummary = {
    mode,
    caseType,
    appointment,
    surgery,
    consultMessage,
  };

  const textPart = {
    type: "text",
    text:
      "INTAKE DATA (JSON):\n" +
      JSON.stringify(intakeSummary, null, 2) +
      "\n\nTASK:\nGenerate a complete SOAP note following the clinic rules. " +
      "If some fields are blank, still produce a SOAP and briefly note assumptions in the Assessment.",
  };

  const imageParts = (images || []).map((img) => ({
    type: "input_image",
    image_url: {
      url: img.data, // data URL from frontend
    },
  }));

  return [textPart, ...imageParts];
}

function buildVisionUserContent(prompt, images) {
  const textPart = {
    type: "text",
    text:
      (prompt && prompt.trim()) ||
      "Summarize key abnormalities and give a 1–2 sentence interpretation.",
  };

  const imageParts = (images || []).map((img) => ({
    type: "input_image",
    image_url: {
      url: img.data,
    },
  }));

  return [textPart, ...imageParts];
}

// --------------- ROUTES -----------------

// Health check
app.get("/", (req, res) => {
  res.send("Lohit SOAP backend is alive.");
});

// SOAP generation
app.post("/api/soap", async (req, res) => {
  try {
    const { mode } = req.body || {};
    const temperature = mode === "Strict" ? 0.1 : 0.4;

    const userContent = buildSoapUserContent(req.body);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_SOAP,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Error: no text returned from model.";

    res.json({ text });
  } catch (err) {
    console.error("SOAP endpoint error:", err);
    res.status(500).json({ error: "SOAP generation failed" });
  }
});

// Vision helper (Toolbox etc.)
app.post("/api/vision", async (req, res) => {
  try {
    const { prompt, images } = req.body || {};
    const userContent = buildVisionUserContent(prompt, images || []);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_VISION,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Error: no text returned from model.";

    res.json({ text });
  } catch (err) {
    console.error("Vision endpoint error:", err);
    res.status(500).json({ error: "Vision analysis failed" });
  }
});

// Feedback / refinement endpoint
app.post("/api/feedback", async (req, res) => {
  try {
    const { text, request, context } = req.body || {};

    const userPrompt = `
CONTEXT: ${context || "general"}.

ORIGINAL TEXT:
${text || "(none)"}

REQUEST FROM DOCTOR:
${request || "(none given)"}

TASK:
Return a single improved version of the ORIGINAL TEXT that satisfies the request, 
keeping the clinical content accurate and Avimark-friendly.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_FEEDBACK,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const out =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Error: no text returned from model.";

    res.json({ text: out });
  } catch (err) {
    console.error("Feedback endpoint error:", err);
    res.status(500).json({ error: "Feedback generation failed" });
  }
});

// --------------- START -----------------

app.listen(port, () => {
  console.log(`✅ Lohit SOAP backend listening on port ${port}`);
});