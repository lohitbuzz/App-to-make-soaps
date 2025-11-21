// backend/server.js

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Optional: serve frontend if you run this as a single app locally
// Adjust the path if your structure changes.
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ---------- OpenAI client ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper: generic call to the “brain”
async function callBrain({ systemPrompt, userContent, model = 'gpt-4.1-mini' }) {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userContent
      }
    ]
  });

  const text =
    completion.choices?.[0]?.message?.content?.trim() ||
    'No output produced.';
  return text;
}

// ---------- System prompts (SOAP / toolbox / consult / helper) ----------

// Core clinic rules shared by SOAP + helper so they’re consistent.
const BASE_SOAP_RULES = `
You are the SOAP brain for Dr. Lohit Busanelli’s small animal clinic.

GENERAL RULES (ALWAYS APPLY):
- Output MUST be plain text, no Markdown, no asterisks.
- Make notes Avimark-compatible: normal line breaks are fine, no extra blank lines except where specified.
- Use classical SOAP sections: Subjective, Objective, Assessment, Plan.
- For PE: use systems list in Objective (General, Vitals, Eyes, Ears, Oral, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic).
- Bloodwork and diagnostics:
  - Objective = data only (values and descriptive findings).
  - Assessment = interpretation and clinical significance.
- Keep tone concise but complete, like a good vet medical record, not client-facing prose unless explicitly asked.

SURGERY-SPECIFIC RULES:
- For surgery/anesthesia cases, include ASA status in Assessment.
- Plan MUST use this exact category order, with one blank line between categories and single spacing within each category:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Do NOT invent exact times for drugs. Only include drug, dose, route, and concentration.
- Every time you mention a drug, immediately include its concentration in square brackets.
  Example: "Dexmedetomidine [0.5 mg/ml]" "Midazolam [5 mg/ml]" etc.
- For standard dog neuters: assume 2-0 Monocryl unless the user hints otherwise; >35 kg dog can be 0 Monocryl if relevant.
- Dental surgery details: if extractions described, reference AAHA/AVDC standards and closure phrase:
  "tension-free flap, no denuded bone, suture line not over defect" with 4-0 Monocryl in a simple interrupted pattern.
- Local oral nerve blocks when mentioned: lidocaine max 4 mg/kg for dogs, 2 mg/kg for cats.

APPOINTMENT TEMPLATES:
- For non-surgical appointments:
  - Subjective: owner complaint, history, context.
  - Objective: full systems PE with key abnormal findings; diagnostics listed as data only.
  - Assessment: problem list + differentials as needed.
  - Plan: diagnostics, treatments, client communication, recheck.

VACCINES:
- If vaccines are provided:
  - include a brief sentence in Subjective or Assessment about preventive care.
  - Plan should specify vaccine name, 1-year vs 3-year, and injection site/route if clearly implied.

DENTAL:
- For "Dental – COHAT (no rads)" templates, still describe professional cleaning, probing, charting, polishing, local blocks when indicated, and note that dental radiographs were not performed.

STYLE:
- Never hallucinate wild details; you can gently fill normal PE if the case is clearly routine and the user didn’t specify (“Help Me” style).
- Keep it readable chair-side: logical paragraphs, but not long essays.
`;

// System prompt for toolbox mode
const TOOLBOX_RULES = `
You are the Toolbox brain for Dr. Lohit Busanelli’s clinic.

TOOLS:
1) Bloodwork Helper Lite
   - Input: raw lab values or text.
   - Output: short or standard summary (if user hints) describing abnormalities and concise interpretation.
   - NO dosing or treatment protocols unless clearly requested.
   - Separate "Abnormal values" line from "Interpretation" line if possible.

2) Email / Client Update Helper
   - Input: rough notes about what was discussed.
   - Output: a clear, client-friendly email body that can be pasted into an email client.
   - Use polite, simple language, short paragraphs.

3) Client Handout Helper
   - Input: condition/notes.
   - Output: brief client handout with headings like Overview, What we’re worried about, At home care, When to call us.

4) SOAP Snippet Helper
   - Input: description of what snippet is needed.
   - Output: only the requested snippet (e.g., Assessment section, or a Plan block) in clinic SOAP style, no extra chatter.

5) Covet Fixer (improve Covet SOAP)
   - Input: raw Covet transcript/SOAP.
   - Output: rewritten, clean, Avimark-ready SOAP or communication summary, keeping the medical meaning but fixing formatting.

6) Freeform mode
   - General small-animal clinic helper; follow the user’s explicit instructions and produce Avimark-compatible text.

7) Client Summary Recorder
   - Input: free dictation or text.
   - Output: a short, structured summary of the client interaction or call log, suitable for Avimark (e.g., "Spoke with owner, discussed X, Y, Z…").

GLOBAL:
- Always produce plain text, no Markdown.
- Keep outputs concise but complete enough for medical/legal records.
`;

// System prompt for consult mode
const CONSULT_RULES = `
You are the internal consult brain for Dr. Lohit Busanelli’s small animal clinic.

- Goal: help with differentials, ranking likelihoods, and suggesting next diagnostic and treatment steps.
- Be practical for a busy GP in Ontario.
- Use clear headings: Summary, Differentials (ranked), Recommended next diagnostics, Treatment/monitoring ideas, Red flags / when to escalate.
- When dosages are needed, keep them generic and conventional; do NOT guess if unsure.
- Plain text only, no Markdown.
- Assume the reader is a veterinarian; clinical language is fine.
`;

// System prompt for SOAP helper console
const HELPER_RULES = `
You are the SOAP helper console for Dr. Lohit Busanelli.

Input:
- The current SOAP text (from the main output area).
- Optional external transcript or voice notes.
- A "helper prompt" describing what is needed (e.g., discharge instructions, call log summary, email, brief summary).

Output:
- Exactly what is requested (discharge, email, summary, etc.) and nothing else.
- Follow the clinic’s tone: clear, calm, and practical.
- Avimark-compatible text, no Markdown.
`;

// ---------- Route: SOAP generation ----------
app.post('/api/generate', async (req, res) => {
  try {
    const payload = req.body || {};

    // You can inspect/tune this mapping later if needed.
    const {
      caseLabel,
      patientName,
      species,
      sex,
      weightKg,
      visitType,
      asa,
      tprNotes,
      appointmentPreset,
      surgeryPreset,
      surgeryMode,
      vaccinesToday,
      vaccineSelections,
      coreNotes,
      pe,
      assessmentHints,
      planHints,
      extra,
      externalTranscript,
      externalTranscriptInclude,
      voiceTranscript,
      voiceUseTranscriptInSoap
    } = payload;

    const visitDescription =
      visitType === 'surgery' ? 'Surgery/anesthesia SOAP' : 'Appointment SOAP';

    const userContent = `
Generate a full SOAP for Dr. Lohit Busanelli using the clinic rules.

VISIT TYPE:
- ${visitDescription}
- Appointment preset: ${appointmentPreset || 'none'}
- Surgery preset: ${surgeryPreset || 'none'}
- Surgery mode (simple vs advanced detail): ${surgeryMode || 'simple'}
- ASA (if surgery): ${asa || 'not specified'}

PATIENT:
- Case label: ${caseLabel || 'n/a'}
- Patient name: ${patientName || 'n/a'}
- Species: ${species || 'n/a'}
- Sex: ${sex || 'n/a'}
- Weight (kg): ${weightKg || 'n/a'}

VACCINES:
- Vaccines done today: ${vaccinesToday ? 'yes' : 'no'}
- Vaccine selections (codes): ${Array.isArray(vaccineSelections) ? vaccineSelections.join(', ') : ''}

TPR / VITALS NOTES:
${tprNotes || '(none)'}

CORE NOTES / HISTORY (Subjective hints):
${coreNotes || '(none)'}

PE & DIAGNOSTICS – DATA ONLY (Objective hints):
${pe || '(none)'}

ASSESSMENT HINTS (problems / rule-outs / concerns):
${assessmentHints || '(none)'}

PLAN & DISCHARGE HINTS:
${planHints || '(none)'}

EXTRA INSTRUCTIONS / EDGE CASES:
${extra || '(none)'}

EXTERNAL TRANSCRIPT (Covet / call log) – may be long:
${externalTranscript ? externalTranscript : '(none)'}

Include a structured communication summary as part of the SOAP? ${externalTranscriptInclude ? 'yes' : 'no'}

VOICE TRANSCRIPT:
Use transcript text in reasoning: ${voiceUseTranscriptInSoap ? 'yes' : 'no'}
Transcript content (if any):
${voiceTranscript || '(none)'}

TASK:
- Build a complete SOAP that fits all base rules.
- Respect that diagnostics in Objective are data-only and interpretation in Assessment.
- If information is missing but the case obviously needs a normal PE, you may fill in templated normals consistent with a typical healthy or mildly ill patient, but do not fabricate wild issues.
- Make it Avimark-ready plain text.
`;

    const output = await callBrain({
      systemPrompt: BASE_SOAP_RULES,
      userContent
    });

    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate:', err);
    res.status(500).json({ error: 'Failed to generate SOAP.' });
  }
});

// ---------- Route: Toolbox ----------
app.post('/api/generate-toolbox', async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      toolboxMode,
      text,
      externalTranscript,
      voiceTranscript
    } = payload;

    const userContent = `
TOOLBOX MODE: ${toolboxMode || 'unknown'}

CORE TEXT / NOTES:
${text || '(none)'}

EXTERNAL TRANSCRIPT:
${externalTranscript || '(none)'}

VOICE TRANSCRIPT (context only, if provided):
${voiceTranscript || '(none)'}

TASK:
Using the selected toolbox mode, produce a single Avimark-compatible text output that would be most useful to the doctor.
Do not explain what you are doing; just output the final text.
`;

    const output = await callBrain({
      systemPrompt: TOOLBOX_RULES,
      userContent
    });

    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate-toolbox:', err);
    res.status(500).json({ error: 'Failed to generate toolbox output.' });
  }
});

// ---------- Route: Consult ----------
app.post('/api/generate-consult', async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      question,
      context,
      externalTranscript,
      voiceTranscript
    } = payload;

    const userContent = `
CONSULT QUESTION:
${question || '(none)'}

CASE CONTEXT:
${context || '(none)'}

EXTERNAL TRANSCRIPT:
${externalTranscript || '(none)'}

VOICE TRANSCRIPT (context only):
${voiceTranscript || '(none)'}

TASK:
Answer the consult question following the consult rules (Summary, Differentials, Recommended next diagnostics, Treatment/monitoring, Red flags).
`;

    const output = await callBrain({
      systemPrompt: CONSULT_RULES,
      userContent
    });

    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate-consult:', err);
    res.status(500).json({ error: 'Failed to generate consult output.' });
  }
});

// ---------- Route: SOAP Helper Console ----------
app.post('/api/generate-helper', async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      helperPrompt,
      soapText,
      externalTranscript,
      voiceTranscript
    } = payload;

    const userContent = `
HELPER REQUEST:
${helperPrompt || '(none)'}

CURRENT SOAP TEXT:
${soapText || '(none)'}

EXTERNAL TRANSCRIPT:
${externalTranscript || '(none)'}

VOICE TRANSCRIPT:
${voiceTranscript || '(none)'}

TASK:
Produce exactly what the helper request asks for (e.g., discharge instructions, client email, call log summary), based on the SOAP and transcripts.
Plain text only, Avimark-compatible.
`;

    const output = await callBrain({
      systemPrompt: HELPER_RULES + '\n' + BASE_SOAP_RULES,
      userContent
    });

    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate-helper:', err);
    res.status(500).json({ error: 'Failed to generate helper output.' });
  }
});

// ---------- Route: Send to desktop (relay stub) ----------
let lastDesktopText = '';

app.post('/api/send-to-desktop', (req, res) => {
  try {
    const { text } = req.body || {};
    lastDesktopText = text || '';
    // In future you can expose GET /api/last-desktop-text for your desktop relay.
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in /api/send-to-desktop:', err);
    res.status(500).json({ error: 'Failed to relay text.' });
  }
});

// Optional health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'Backend running' });
});

// Fallback: serve frontend index for any non-API GET (for local use)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Lohit SOAP App backend running on port ${PORT}`);
});