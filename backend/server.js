// server.js – Lohit SOAP App v1.7.5 backend
// Node: CommonJS style (require). Run with: node server.js

const path = require('path');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

// ---------- CONFIG ----------
const PORT = process.env.PORT || 3000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.1-mini';

// Create OpenAI client (expects OPENAI_API_KEY in env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static assets from current dir (index.html, etc.)
app.use(express.static(__dirname));

// Root -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------- HELPERS ----------

// Safely extract text from Responses API output
function extractResponseText(response) {
  try {
    if (!response || !Array.isArray(response.output) || response.output.length === 0) {
      return 'No output returned.';
    }

    // The docs’ simple example: response.output[0].content[0].text
    const first = response.output[0];
    if (!first || !Array.isArray(first.content) || first.content.length === 0) {
      return 'No output content found.';
    }

    // Try the simple path
    const c0 = first.content[0];
    if (typeof c0 === 'string') return c0.trim();
    if (c0 && typeof c0.text === 'string') return c0.text.trim();

    // Fallback: concatenate anything that smells like text
    let text = '';
    for (const chunk of first.content) {
      if (!chunk) continue;
      if (typeof chunk === 'string') {
        text += chunk;
      } else if (typeof chunk.text === 'string') {
        text += chunk.text;
      } else if (chunk.type === 'output_text' && chunk.text && typeof chunk.text.value === 'string') {
        text += chunk.text.value;
      }
    }

    return text.trim() || 'No text output found.';
  } catch (err) {
    console.error('Error extracting response text:', err);
    return 'Error extracting response text.';
  }
}

// Core “brain” rules for SOAP output
const SOAP_BRAIN_SYSTEM_PROMPT = `
You are the dedicated SOAP brain for Dr. Lohit Busanelli's small animal clinics.

Global rules:
- Species: dogs and cats (mostly general practice; sometimes more complex surgery).
- Output MUST be Avimark-compatible plain text (no markdown, no bullets unless explicitly hinted).
- Always structure SOAP as:
  Subjective:
  Objective:
  Assessment:
  Plan:

Subjective:
- Concise summary of presenting complaint, history, and owner communication.
- Include relevant Covet / phone-call context only if provided.

Objective:
- Systems-based PE list in this order: General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular,
  Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic, Diagnostics.
- For surgery/dentistry, include anesthesia status and monitoring in Objective as data-only, but keep interpretations for Assessment.
- Bloodwork and diagnostics here are "data only" (numbers and factual findings). No interpretation here.

Assessment:
- Problem list and differentials, plus concise interpretation of bloodwork and diagnostics.
- For anesthesia/surgery, include ASA grade and any peri-anesthetic risk commentary here.
- Be clinically realistic and conservative; do not over-diagnose.

Plan:
- For medical/appointment cases: diagnostics, treatments, medications, home care, recheck timing.
- For surgical/anesthetic cases, ALWAYS structure Plan as numbered categories in this exact order,
  with a line break only between these main categories (Avimark friendly):

  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare

- Within each category, single-space text, no blank lines between sentences.
- Mention ET tube, IV catheter placement, and fluids under appropriate categories (1, 3, 7) for anesthesia cases.
- For surgery: describe the procedure clearly, including closure layers and suture material (Monocryl by default; 0 Monocryl for dogs >35 kg for neuters as per clinic rules).
- For dental extractions: mention AAHA/AVDC standards and standard closure phrase:
  "tension-free flap, no denuded bone, suture line not over defect" with 4-0 Monocryl simple interrupted.

Drug & formatting rules:
- Every time you mention a drug in the Plan or Medications Dispensed, include the concentration in brackets immediately after the drug name (e.g. "Midazolam [5 mg/ml]").
- Do NOT include exact administration times; only drug, dose, route, and frequency as appropriate.
- Midazolam concentration is always 5 mg/ml.
- Record fluids as ml/kg/hr where relevant.
- For local oral nerve blocks in dental cases, use lidocaine up to 4 mg/kg (dogs) or 2 mg/kg (cats) only when clearly indicated by the input.

Vaccines:
- If vaccines are provided as structured input, include them under Assessment/Plan in a brief, clean format, with site and duration (1-year vs 3-year) where obvious from the codes.
- Do not invent vaccines not listed.

Tone & style:
- Write like a busy, competent GP vet in Ontario writing for Avimark.
- No legal disclaimers unless explicitly requested.
- Be concise but not cryptic; avoid purple prose.
- If key data are missing, you may use gentle, generic phrasing, but do not fabricate very specific findings.
- When in doubt, be conservative and safe.

IMPORTANT:
- Do NOT echo the instructions above.
- Do NOT add headings other than: Subjective:, Objective:, Assessment:, Plan:
- Output MUST be a single plain-text block ready to paste into Avimark.
`;

// Toolbox brain
const TOOLBOX_SYSTEM_PROMPT = `
You are the Toolbox brain for a small-animal veterinary clinic (dogs and cats).
You help with:
- Bloodwork Helper Lite: short or standard written summaries for vets and client-friendly wording.
- Email / Client Update helper: clear, empathetic emails summarizing plans and estimates.
- Client Handout helper: brief, structured client handouts (Avimark/email friendly, no heavy formatting).
- SOAP Snippet helper: concise text snippets to paste into parts of a SOAP.
- Covet Fixer: clean up and structure Covet-generated SOAPs into Avimark-ready text, following clinic style.
- Freeform mode: respond to whatever the vet asks, but still write as a real clinic vet.
- Client Summary Recorder: turn rambly notes into tight client summaries.

General rules:
- Audience may be either veterinary staff or pet owners; adjust tone based on the request.
- DO NOT fabricate lab values or specifics that are not in the input.
- Keep formatting plain-text and Avimark/email friendly.
- If the user doesn't specify, default to a practical, moderate-length answer rather than a wall of text.
`;

// Consult brain
const CONSULT_SYSTEM_PROMPT = `
You are a veterinary internal-medicine/general-practice consultant for dogs and cats.
Your job:
- Read the provided question + case context (signalment, history, exam, labs, imaging).
- Suggest differentials, prioritize them, and recommend next steps (diagnostics and treatment options).
- Be practical for a busy GP clinic in Ontario (cost-aware, realistic about what can be done in-house).

Rules:
- Structure your answer with short, labeled sections (e.g. "Top differentials", "Key rule-outs", "Recommended next steps", "Client communication notes").
- Do not give drug doses unless the user explicitly asks.
- Do not contradict clear facts in the case; if data are missing, say so and outline what you’d want.
- Keep language clear and calm; the reader is a vet, not a client.
`;

// ---------- ROUTES ----------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Lohit SOAP App backend running.' });
});

// ----- SOAP GENERATION -----
app.post('/api/generate', async (req, res) => {
  try {
    const body = req.body || {};
    const visitType = body.visitType || 'appointment';

    // Build a structured user prompt summarizing the form
    const prompt = `
You are generating a complete SOAP note for a small-animal case.

Structured input:
- Case label: ${body.caseLabel || '(none)'}
- Patient name: ${body.patientName || '(unknown)'}
- Species: ${body.species || '(unknown)'}
- Sex: ${body.sex || '(unknown)'}
- Weight (kg): ${body.weightKg || '(not provided)'}
- Visit type: ${visitType}
- ASA (if surgery): ${body.asa || '(n/a)'}
- TPR / notes: ${body.tprNotes || '(not provided)'}

Appointment preset: ${body.appointmentPreset || '(none)'}
Surgery preset: ${body.surgeryPreset || '(none)'}
Surgery mode: ${body.surgeryMode || '(simple/unspecified)'}

Vaccines today: ${body.vaccinesToday ? 'Yes' : 'No'}
Selected vaccine codes: ${Array.isArray(body.vaccineSelections) && body.vaccineSelections.length > 0 ? body.vaccineSelections.join(', ') : '(none)'}

Core notes / history:
${body.coreNotes || '(none)'}

PE & diagnostics (data only):
${body.pe || '(none)'}

Assessment hints (vet thinking / concerns):
${body.assessmentHints || '(none)'}

Plan & discharge hints:
${body.planHints || '(none)'}

Extra instructions / anything else:
${body.extra || '(none)'}

External transcript (e.g. Covet / call log) – include structured communication summary?: ${body.externalTranscriptInclude ? 'Yes' : 'No'}
${body.externalTranscript || '(none)'}

Voice transcript (if provided, may be rambly dictation):
${body.voiceUseTranscriptInSoap && body.voiceTranscript ? body.voiceTranscript : '(none or context-only)'}

Task:
- Using the system rules, generate a single complete SOAP ready to paste into Avimark.
- Respect all structure rules (Subjective, Objective, Assessment, Plan and Plan 1–9 order for surgery/anesthesia cases).
- If data are thin, make safe, generic assumptions; do not fabricate very detailed PE findings or lab numbers.
    `.trim();

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: SOAP_BRAIN_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    });

    const text = extractResponseText(response);
    res.json({ output: text });
  } catch (err) {
    console.error('Error in /api/generate:', err);
    res.status(500).json({ error: 'Error generating SOAP.' });
  }
});

// ----- TOOLBOX GENERATION -----
app.post('/api/generate-toolbox', async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.toolboxMode || 'freeform';

    const prompt = `
Toolbox mode: ${mode}

Core text / notes:
${body.text || '(none provided)'}

External transcript (if any):
${body.externalTranscript || '(none)'}

Voice transcript context:
${body.voiceTranscript || '(none)'}

Instructions:
- Use the selected toolbox mode to interpret the above content.
- Bloodwork helper: summarise lab abnormalities and give a short, clinically useful interpretation for the vet and (if appropriate) a client-friendly explanation.
- Email helper: produce a clear, polite, empathetic email body.
- Handout helper: produce a simple, structured client handout in plain text.
- SOAP snippet helper: produce only the snippet requested (e.g. Assessment, Plan, or discharge).
- Covet Fixer: clean up and restructure the text into Avimark-ready format in Dr. Lohit’s style.
- Freeform: do whatever task the user text is asking for, as long as it’s veterinary-clinic related.
- Client Summary Recorder: turn messy dictation into a tight, readable summary for the medical record or client communication.

Keep the output plain-text, no markdown.
    `.trim();

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: TOOLBOX_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const text = extractResponseText(response);
    res.json({ output: text });
  } catch (err) {
    console.error('Error in /api/generate-toolbox:', err);
    res.status(500).json({ error: 'Error generating toolbox output.' });
  }
});

// ----- CONSULT GENERATION -----
app.post('/api/generate-consult', async (req, res) => {
  try {
    const body = req.body || {};

    const prompt = `
Consult question:
${body.question || '(none)'}

Case context (signalment, history, PE, diagnostics):
${body.context || '(none)'}

External transcript:
${body.externalTranscript || '(none)'}

Voice transcript context:
${body.voiceTranscript || '(none)'}

Task:
- Answer the consult question as a vet-to-vet internal-medicine / GP consult.
- Provide prioritized differentials, key rule-outs, suggested further diagnostics, treatment options, and client communication notes.
- Assume this is a busy Ontario GP practice with limited time and moderate budget.
    `.trim();

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: CONSULT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    });

    const text = extractResponseText(response);
    res.json({ output: text });
  } catch (err) {
    console.error('Error in /api/generate-consult:', err);
    res.status(500).json({ error: 'Error generating consult output.' });
  }
});

// ----- SOAP HELPER CONSOLE -----
app.post('/api/generate-helper', async (req, res) => {
  try {
    const body = req.body || {};
    const helperPrompt = body.helperPrompt || '';
    const soapText = body.soapText || '';
    const externalTranscript = body.externalTranscript || '';
    const voiceTranscript = body.voiceTranscript || '';

    const prompt = `
You are the SOAP helper console attached to a completed SOAP note.

Helper request:
${helperPrompt || '(none)'}

Current SOAP text:
${soapText || '(no SOAP text provided)'}

External transcript:
${externalTranscript || '(none)'}

Voice transcript context:
${voiceTranscript || '(none)'}

Task:
- Use the helper request plus the SOAP and transcripts to create exactly what is asked:
  e.g. discharge instructions, email body, call log summary, brief weight consult, etc.
- Keep it Avimark/email friendly plain-text.
- Do not reprint the entire SOAP unless explicitly requested.
    `.trim();

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: SOAP_BRAIN_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const text = extractResponseText(response);
    res.json({ output: text });
  } catch (err) {
    console.error('Error in /api/generate-helper:', err);
    res.status(500).json({ error: 'Error generating helper output.' });
  }
});

// ----- PHONE → DESKTOP RELAY (TEXT ONLY, IN-MEMORY STUB) -----
let lastDesktopRelayText = '';

app.post('/api/send-to-desktop', (req, res) => {
  try {
    const body = req.body || {};
    const text = body.text || '';

    lastDesktopRelayText = text;
    console.log('Received text for desktop relay (length):', text.length);

    // In this version, the desktop button just shows an alert in the UI.
    // Later, you can add a GET endpoint to fetch lastDesktopRelayText.
    res.json({ ok: true, message: 'Stored text for desktop relay.' });
  } catch (err) {
    console.error('Error in /api/send-to-desktop:', err);
    res.status(500).json({ error: 'Error storing text for desktop relay.' });
  }
});

// Optional: simple endpoint to inspect relay text during development
app.get('/api/last-desktop-text', (req, res) => {
  res.json({ text: lastDesktopRelayText || '' });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Lohit SOAP App backend running on http://localhost:${PORT}`);
});
