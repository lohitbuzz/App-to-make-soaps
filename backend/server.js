// backend/server.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve the frontend (../frontend)
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ---------- Helper: call OpenAI with a simple wrapper ----------

async function callOpenAI({ mode, payload, helperPrompt }) {
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const baseSystem = `
You are the AI brain for Dr. Lohit Busanelli's Lohit SOAP App.
You generate Avimark-friendly veterinary text only (no markdown, no bullet symbols).
Always follow these rules:
- Use SOAP structure when asked (Subjective, Objective, Assessment, Plan).
- Objective: PE as systems list; bloodwork is data-only (no interpretation).
- Assessment: put interpretations, differentials, and anesthesia grade when relevant.
- Plan for surgeries: sections in this order:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Drug formatting: include concentration in brackets after drug name (e.g. Methadone [10 mg/ml]).
- No exact administration times, just drug, dose, route.
- Format text so it can be pasted directly into Avimark (single spacing, no weird characters).
If the user provides a SOAP or draft text, you may rewrite / improve it but preserve medical meaning.
  `.trim();

  let userContent = '';

  if (mode === 'soap') {
    userContent = `
MODE: SOAP
JSON PAYLOAD:
${JSON.stringify(payload, null, 2)}

TASK:
Using the payload, generate a complete SOAP note that follows the clinic rules described in the system prompt.
Return ONLY the SOAP text, no explanations.
    `.trim();
  } else if (mode === 'toolbox') {
    userContent = `
MODE: TOOLBOX – ${payload.toolboxMode}

PAYLOAD:
${JSON.stringify(payload, null, 2)}

TASK:
Generate the requested output for this tool:
- "bloodwork": concise summary and assessment of lab values, plus short/standard impression.
- "email": an email or client update body.
- "handout": a brief client handout.
- "snippet": a SOAP snippet or paragraph to paste into a SOAP.
- "covetFixer": clean up and improve a Covet SOAP while keeping content and structure.
- "freeform": follow instructions in the text.
- "summaryRecorder": short, clear summary of the case or call.

Return ONLY the final text, no extra commentary.
    `.trim();
  } else if (mode === 'consult') {
    userContent = `
MODE: CONSULT

Question:
${payload.question || ''}

Case context:
${payload.context || ''}

Extra transcript:
${payload.externalTranscript || ''}

Voice transcript:
${payload.voiceTranscript || ''}

TASK:
Answer the consult question with structured reasoning, ranked differentials, and recommended next steps.
Provide a short summary at the top, then details.
Return plain text only (no markdown bullets).
    `.trim();
  } else if (mode === 'soap_helper') {
    userContent = `
MODE: SOAP_HELPER

Helper prompt:
${helperPrompt || ''}

Existing SOAP text:
${payload.soapText || ''}

External transcript:
${payload.externalTranscript || ''}

Voice transcript:
${payload.voiceTranscript || ''}

TASK:
Using the SOAP and context, generate what is asked in the helper prompt (e.g. discharge instructions, call log, email).
Return ONLY that text, Avimark-friendly.
    `.trim();
  } else {
    userContent = `
MODE: GENERIC

Payload:
${JSON.stringify(payload, null, 2)}
    `.trim();
  }

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: baseSystem },
      { role: 'user', content: userContent },
    ],
    temperature: 0.4,
  });

  return (response.choices[0].message.content || '').trim();
}

// ---------- API routes used by your index.html ----------

// /api/generate → SOAP
app.post('/api/generate', async (req, res) => {
  try {
    const payload = req.body || {};
    const output = await callOpenAI({ mode: 'soap', payload });
    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate:', err);
    res.status(500).json({ error: 'Failed to generate SOAP' });
  }
});

// /api/generate-toolbox → Toolbox
app.post('/api/generate-toolbox', async (req, res) => {
  try {
    const payload = req.body || {};
    const output = await callOpenAI({
      mode: 'toolbox',
      payload,
    });
    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate-toolbox:', err);
    res.status(500).json({ error: 'Failed to generate toolbox output' });
  }
});

// /api/generate-consult → Consult
app.post('/api/generate-consult', async (req, res) => {
  try {
    const payload = req.body || {};
    const output = await callOpenAI({
      mode: 'consult',
      payload,
    });
    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate-consult:', err);
    res.status(500).json({ error: 'Failed to generate consult output' });
  }
});

// /api/generate-helper → SOAP Helper console
app.post('/api/generate-helper', async (req, res) => {
  try {
    const { helperPrompt, soapText, externalTranscript, voiceTranscript } = req.body || {};

    const payload = { soapText, externalTranscript, voiceTranscript };

    const output = await callOpenAI({
      mode: 'soap_helper',
      payload,
      helperPrompt,
    });

    res.json({ output });
  } catch (err) {
    console.error('Error in /api/generate-helper:', err);
    res.status(500).json({ error: 'Failed to generate helper output' });
  }
});

// /api/send-to-desktop → stub for now (just logs text)
let lastDesktopText = '';

app.post('/api/send-to-desktop', (req, res) => {
  try {
    const { text } = req.body || {};
    lastDesktopText = text || '';
    console.log('Received text for desktop relay (length):', lastDesktopText.length);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error in /api/send-to-desktop:', err);
    res.status(500).json({ error: 'Failed to send to desktop' });
  }
});

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Lohit SOAP App backend listening on port ${PORT}`);
});