// server.js — Lohit SOAP App v1.7.5 backend
// ------------------------------------------
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

// ===== OpenAI client =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// If you decide to use an Assistant later, put its ID here:
// const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

// Simple health check
app.get("/", (_req, res) => {
  res.send("Lohit SOAP App backend v1.7.5 is running");
});

// ---------- Helpers ----------

async function callModel(systemInstructions, userContent) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // or your preferred model
    temperature: 0.3,
    messages: [
      { role: "system", content: systemInstructions },
      { role: "user", content: userContent },
    ],
  });

  return response.choices?.[0]?.message?.content || "";
}

// Build a “case summary” string from the SOAP payload
function buildSoapCaseSummary(body) {
  const visitType = body.visitType || "appointment";
  const sxMode = body.surgeryMode || "simple";

  const vaccines = (body.vaccineSelections || []).join(", ") || "None recorded";

  return [
    `Case label: ${body.caseLabel || "not provided"}`,
    `Patient: ${body.patientName || "not provided"} (${body.species || "species not set"}, ${body.sex || "sex not set"}, ${body.weightKg || "weight not set"} kg)`,
    `Visit type: ${visitType} · ASA: ${body.asa || "not set"} · Surgery preset: ${body.surgeryPreset || "none"} · Surgery mode: ${sxMode}`,
    `TPR / vitals / BCS notes: ${body.tprNotes || "not provided"}`,
    `Vaccines done today: ${body.vaccinesToday ? "Yes" : "No"} · Vaccines: ${vaccines}`,
    "",
    "Core notes / history:",
    body.coreNotes || "(none entered)",
    "",
    "PE & diagnostics (data only):",
    body.pe || "(none entered)",
    "",
    "Assessment hints (problem list, rule-outs, ASA thoughts):",
    body.assessmentHints || "(none entered)",
    "",
    "Plan & discharge hints (diagnostics, treatments, recheck timing, restrictions, meds dispensed):",
    body.planHints || "(none entered)",
    "",
    "Extra instructions / anything else (edge cases, inventory notes, special instructions):",
    body.extra || "(none entered)",
    "",
    "External transcript (if any):",
    body.externalTranscript || "(none)",
    "",
    "Voice transcript (if any):",
    body.voiceTranscript || "(none)",
  ].join("\n");
}

// Master SOAP rules (short version – you can expand later)
const SOAP_SYSTEM_PROMPT = `
You are the Lohit SOAP App brain for a small-animal veterinary clinic.

GENERAL RULES:
- Always output a full SOAP for a vet medical record, Avimark-compatible.
- Headings: "Subjective:", "Objective:", "Assessment:", "Plan:" exactly.
- Single spacing within sections, blank line only between sections.
- In Objective, list a full system-based PE (General, Vitals, Eyes, Ears, Oral, Nose, Resp, CV, Abdomen, Urogenital, Musculoskeletal, Neuro, Integument, Lymphatic).
- Summarize bloodwork and diagnostics as data-only in Objective; interpret them in Assessment.
- In Assessment, give a concise problem list and differentials where appropriate.
- In Plan, always follow these numbered categories:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- If this is NOT a surgery case, still use "Plan" but only fill relevant subsections; you may leave irrelevant surgery categories as "Not applicable for this case." Keep numbering in order.

SURGERY-SPECIFIC:
- Assume standard dog/cat anesthesia at this clinic if not specified, but do NOT invent random drugs if the case clearly is non-surgical.
- Use the clinic defaults:
  - For neuters: 2-0 Monocryl for standard dog; 0 Monocryl for dogs >35 kg.
  - Dental cases: mention monitoring (SpO2, ETCO2, BP, ECG, fluids) and local oral nerve blocks with lidocaine (max 4 mg/kg dogs, 2 mg/kg cats) when appropriate, AAHA/AVDC extraction standards, and closure phrase "tension-free flap, no denuded bone, suture line not over defect" with 4-0 Monocryl simple interrupted.
- Include ASA status in Assessment for anesthetic/surgery cases.

DRUG FORMATTING:
- Whenever you mention a drug in the Plan, include its concentration in brackets right after the drug name (e.g. "Methadone [10 mg/ml] 0.2 mg/kg IV").
- Midazolam should always be written as "Midazolam [5 mg/ml]".
- Do NOT include exact administration times.

MISSING DATA:
- If the doctor left a field blank, do NOT invent specific numbers or findings. Use neutral phrases like "Not provided" or "Not discussed" where needed.
- It is acceptable to use safe, generic normal PE phrases IF the case clearly sounds like a routine wellness visit and no abnormalities are mentioned. Otherwise, stay neutral.

OUTPUT:
- Output ONLY the SOAP text. No extra commentary.
`;

// Toolbox / consult prompts
const TOOLBOX_SYSTEM_PROMPT = `
You are the Toolbox brain for the Lohit SOAP App.
You receive a doctor request plus any pasted text (bloodwork, Covet SOAP, email notes, etc.).
Your job is to produce a single, Avimark-friendly block of text that answers the request.

Tools you might be asked to do:
- Bloodwork Helper Lite: short Objective line of abnormal values + a brief Assessment paragraph of interpretation.
- Email / Client Update Helper: friendly, clear email or phone-note summary in lay language.
- Client Handout Helper: brief client handouts (~1 page) about a condition or treatment plan.
- SOAP Snippet Helper: short snippet that can be pasted into an existing SOAP (e.g., "Dental radiographs: ..." or "Phone call: ...").
- Covet Fixer: clean up messy Covet SOAP or transcript into concise, clinic-style wording.
- Freeform: whatever the doctor asks; keep it concise and clinic-appropriate.

Always:
- Respect any explicit instructions in the prompt.
- Keep doses and clinical content accurate for small-animal practice.
- Output plain text only, no markdown.
`;

const CONSULT_SYSTEM_PROMPT = `
You are the Consult brain for the Lohit SOAP App.
A veterinarian is asking you a quick consult question about a case.

Rules:
- Answer like a vet-to-vet chat note: concise but clear.
- Structure your answer as:
  1) Working problem list
  2) Main differentials (with very short rationale)
  3) Recommended next tests
  4) Treatment / management options
- If data is obviously missing, explicitly say what else you'd like to know.
- Keep tone collegial and practical. No medico-legal disclaimers.
- Output plain text only, no markdown.
`;

const HELPER_SYSTEM_PROMPT = `
You are the SOAP helper console for the Lohit SOAP App.
You receive:
- The current SOAP text
- Any transcripts or notes
- A helper request (e.g., "Make a client discharge for today's surgery" or "Create a brief call log summary").

Your job:
- Generate ONLY the requested helper output (discharge, email body, call log, etc.).
- Do not rewrite the SOAP itself.
- Use the SOAP as your ground truth for what happened (procedures, doses, recheck timing).
- Keep the output Avimark-friendly (no markdown).
`;

// ---------- /api/generate  (main SOAP) ----------

app.post("/api/generate", async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.mode || "soap";

    if (mode !== "soap") {
      // future-proof, but right now UI always sends 'soap' here
    }

    const summary = buildSoapCaseSummary(body);

    const userPrompt = `
Create a complete veterinary SOAP for this case using the clinic rules.

MODE: ${body.visitType === "surgery" ? "SURGERY" : "APPOINTMENT"}
Surgery preset: ${body.surgeryPreset || "none"}

Case summary:
${summary}
`;

    const output = await callModel(SOAP_SYSTEM_PROMPT, userPrompt);
    res.json({ output });
  } catch (err) {
    console.error("Error in /api/generate:", err);
    res.status(500).json({ error: "Failed to generate SOAP" });
  }
});

// ---------- /api/generate-toolbox ----------

app.post("/api/generate-toolbox", async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.toolboxMode || "bloodwork";
    const text = body.text || "";
    const externalTranscript = body.externalTranscript || "";
    const voiceTranscript = body.voiceTranscript || "";

    const userPrompt = `
Requested tool mode: ${mode}

Doctor's core text / notes:
${text}

External transcript (if provided):
${externalTranscript}

Voice transcript (if provided):
${voiceTranscript}

Please produce the single best output for this request following the Toolbox rules.
`;

    const output = await callModel(TOOLBOX_SYSTEM_PROMPT, userPrompt);
    res.json({ output });
  } catch (err) {
    console.error("Error in /api/generate-toolbox:", err);
    res.status(500).json({ error: "Failed to generate toolbox output" });
  }
});

// ---------- /api/generate-consult ----------

app.post("/api/generate-consult", async (req, res) => {
  try {
    const body = req.body || {};
    const question = body.question || "";
    const context = body.context || "";
    const externalTranscript = body.externalTranscript || "";
    const voiceTranscript = body.voiceTranscript || "";

    const userPrompt = `
Consult question from vet:
${question}

Case context:
${context}

External transcript:
${externalTranscript}

Voice transcript:
${voiceTranscript}

Answer as a concise vet-to-vet consult note.
`;

    const output = await callModel(CONSULT_SYSTEM_PROMPT, userPrompt);
    res.json({ output });
  } catch (err) {
    console.error("Error in /api/generate-consult:", err);
    res.status(500).json({ error: "Failed to generate consult output" });
  }
});

// ---------- /api/generate-helper (SOAP helper console) ----------

app.post("/api/generate-helper", async (req, res) => {
  try {
    const body = req.body || {};
    const helperPrompt = body.helperPrompt || "";
    const soapText = body.soapText || "";
    const externalTranscript = body.externalTranscript || "";
    const voiceTranscript = body.voiceTranscript || "";

    const userPrompt = `
Helper request:
${helperPrompt}

Current SOAP text:
${soapText}

External transcript:
${externalTranscript}

Voice transcript:
${voiceTranscript}

Generate ONLY the requested helper artifact (discharge, call log, email, etc.).
`;

    const output = await callModel(HELPER_SYSTEM_PROMPT, userPrompt);
    res.json({ output });
  } catch (err) {
    console.error("Error in /api/generate-helper:", err);
    res.status(500).json({ error: "Failed to generate helper output" });
  }
});

// ---------- /api/send-to-desktop (stub) ----------

app.post("/api/send-to-desktop", (req, res) => {
  const body = req.body || {};
  console.log("Received send-to-desktop payload:", body.text?.slice(0, 200));
  // Later you can wire this into your QR / relay desktop helper.
  res.json({ ok: true });
});

// ---------- Start server ----------

app.listen(PORT, () => {
  console.log(`Lohit SOAP App backend v1.7.5 listening on port ${PORT}`);
});