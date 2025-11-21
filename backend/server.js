// server.js
// Lohit SOAP app backend v1.7.2 (text-only, Vision-ready later)

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY is not set. Requests will fail.');
}

app.use(cors({
  origin: [
    'https://lohitssoap.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5500',
  ],
  credentials: false,
}));

app.use(express.json({ limit: '5mb' }));

// Simple health check
app.get('/', (req, res) => {
  res.send('Lohit SOAP app backend v1.7.2 is running.');
});

// Utility: call OpenAI Chat Completion using Node 18+ global fetch
async function callOpenAI(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const body = {
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 2200,
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const content =
    data.choices?.[0]?.message?.content?.trim() ||
    'Error: no content returned from model.';
  return content;
}

// Core route – handles SOAP, Toolbox, Consult
app.post('/generate', async (req, res) => {
  try {
    const {
      mode,            // 'soap' | 'toolbox' | 'consult'
      caseType,        // 'appointment' | 'surgery'
      surgeryLayout,   // 'simple' | 'advanced'
      brainMode,       // 'help' | 'strict'
      basics = {},
      soapFields = {},
      toolboxFields = {},
      consultFields = {},
    } = req.body || {};

    let systemPrompt = '';
    let userPrompt = '';

    const strictNote =
      brainMode === 'strict'
        ? 'STRICT MODE: Do not invent data. If something is missing, clearly label it as [Not provided].'
        : 'HELP ME MODE: You may use safe, generic templated normals if typical and clearly label any assumptions.';

    if (mode === 'soap') {
      // SOAP (Appointment or Surgery)
      systemPrompt = `
You are generating Avimark-compatible veterinary SOAP notes for Dr. Lohit Busanelli.
Rules:
- Species: small animal general practice.
- Output sections in this exact order, with these headings: Subjective, Objective, Assessment, Plan.
- Do not add extra headings or bullets.
- Use single spacing. No blank lines inside a section. One blank line between sections.
- For physical exams, use the clinic’s standard system list: General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic, Diagnostics.
- Bloodwork and diagnostic results in Objective are DATA ONLY. Interpretation goes in Assessment.
- For surgery/anesthesia cases, include ASA status in Objective or assessment.
- Plan for surgery/anesthesia cases must always follow this order:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- All drug mentions in the Plan must include concentrations in brackets immediately after the drug name. Example: Dexmedetomidine [0.5 mg/ml], Midazolam [5 mg/ml].
- Do not include exact administration times.
- Use clear, clinic-friendly wording appropriate for Avimark.
${strictNote}
      `.trim();

      const {
        caseLabel,
        species,
        weightKg,
        asa,
        tpr,
      } = basics;

      const {
        appointmentReason,
        history,
        examFindings,
        diagnosticsData,
        assessmentNotes,
        planNotes,
        surgeryPreset,
        anesthesiaQuickSummary,
        surgicalNotes,
        extraInstructions,
      } = soapFields;

      const isSurgery = caseType === 'surgery';

      const contextParts = [];

      contextParts.push(`Case label: ${caseLabel || '[Not provided]'}`);
      contextParts.push(`Case type: ${caseType || 'appointment'}`);
      contextParts.push(`Surgery layout: ${surgeryLayout || 'simple'}`);
      contextParts.push(`Species: ${species || '[Not provided]'}; Weight: ${weightKg || '[Not provided]'} kg; ASA: ${asa || '[Not provided]'}; TPR note: ${tpr || '[Not provided]'}.`);

      if (isSurgery) {
        contextParts.push(`Surgery preset/type: ${surgeryPreset || '[Not provided]'}.`);
        contextParts.push(`Anesthesia quick summary: ${anesthesiaQuickSummary || '[Not provided]'}.`);
        contextParts.push(`Core surgery notes / key events: ${surgicalNotes || '[Not provided]'}.`);
      } else {
        contextParts.push(`Appointment reason: ${appointmentReason || '[Not provided]'}.`);
        contextParts.push(`History: ${history || '[Not provided]'}.`);
      }

      contextParts.push(`Exam findings (raw text if provided): ${examFindings || '[Not provided]'}.`);
      contextParts.push(`Diagnostics (data only, if provided): ${diagnosticsData || '[Not provided]'}.`);
      contextParts.push(`Doctor assessment hints (optional): ${assessmentNotes || '[Not provided]'}.`);
      contextParts.push(`Doctor plan hints (optional): ${planNotes || '[Not provided]'}.`);
      contextParts.push(`Extra instructions to AI: ${extraInstructions || '[Not provided]'}.`);

      userPrompt = `
Using the clinic rules above, write a complete SOAP note for this case.

${contextParts.join('\n')}
      `.trim();
    } else if (mode === 'toolbox') {
      // Toolbox text helper
      systemPrompt = `
You are a veterinary writing assistant for Dr. Lohit Busanelli.
You generate short, clinic-friendly text that can be pasted into Avimark or emailed to clients.
Follow these rules:
- Respect any explicit instructions from the doctor.
- Keep formatting simple and text-only (no bullet characters that might paste badly).
- If the doctor asks for a summary, keep it concise but medically accurate.
${strictNote}
      `.trim();

      const {
        coreNotes,
        extraInstructions,
      } = toolboxFields;

      userPrompt = `
The doctor is using Toolbox mode.

Core notes / request:
${coreNotes || '[Not provided]'}

Extra instructions to AI:
${extraInstructions || '[Not provided]'}

Write the requested text now.
      `.trim();
    } else if (mode === 'consult') {
      // Consult mode
      systemPrompt = `
You are a small-animal veterinary consultant helping Dr. Lohit Busanelli think through cases.
Provide clear reasoning, differentials, and plan suggestions.
Avoid overly long essays; focus on clinically useful points the doctor can quickly scan between appointments.
${strictNote}
      `.trim();

      const {
        question,
        patientSummary,
      } = consultFields;

      userPrompt = `
Patient summary:
${patientSummary || '[Not provided]'}

Consult question:
${question || '[Not provided]'}
      `.trim();
    } else {
      return res.status(400).json({ error: 'Invalid mode. Expected soap, toolbox, or consult.' });
    }

    const output = await callOpenAI(systemPrompt, userPrompt);

    res.json({ ok: true, output });
  } catch (err) {
    console.error('Error in /generate:', err);
    res.status(500).json({
      ok: false,
      error: 'Server error: ' + err.message,
    });
  }
});

// --- Simple in-memory QR relay store (text only for now) ---
const relayStore = new Map();

// Create / init a caseId
app.post('/relay/init', (req, res) => {
  const caseId = Math.random().toString(36).slice(2, 10);
  relayStore.set(caseId, { createdAt: Date.now(), text: '', notes: '' });
  res.json({ caseId });
});

// Upload text from phone
app.post('/relay/upload', (req, res) => {
  const { caseId, text, notes } = req.body || {};
  if (!caseId || !relayStore.has(caseId)) {
    return res.status(400).json({ error: 'Invalid or missing caseId.' });
  }
  const existing = relayStore.get(caseId);
  relayStore.set(caseId, {
    ...existing,
    text: text || '',
    notes: notes || '',
    updatedAt: Date.now(),
  });
  res.json({ ok: true });
});

// Poll from desktop
app.get('/relay/poll/:caseId', (req, res) => {
  const { caseId } = req.params;
  if (!relayStore.has(caseId)) {
    return res.status(404).json({ error: 'caseId not found.' });
  }
  const data = relayStore.get(caseId);
  res.json({ ok: true, data });
});

// Clear data when done
app.post('/relay/clear', (req, res) => {
  const { caseId } = req.body || {};
  if (caseId && relayStore.has(caseId)) {
    relayStore.delete(caseId);
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Lohit SOAP app backend running on port ${PORT}`);
});
// Simple in-memory store: { caseId: { text: "", createdAt, updatedAt } }
const textRelay = new Map();
const crypto = require('crypto');

// init: desktop calls this to get a caseId for "Receive from phone"
app.post('/relay/init', (req, res) => {
  const caseId = crypto.randomBytes(6).toString('hex'); // 12-char id
  textRelay.set(caseId, { text: '', createdAt: Date.now(), updatedAt: null });
  res.json({ ok: true, caseId });
});

// phone (or any client) sends text
app.post('/relay/text', (req, res) => {
  const { caseId, text } = req.body || {};
  if (!caseId || !textRelay.has(caseId)) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing caseId.' });
  }
  const entry = textRelay.get(caseId);
  entry.text = text;
  entry.updatedAt = Date.now();
  textRelay.set(caseId, entry);
  res.json({ ok: true });
});

// desktop polls to get text
app.get('/relay/poll/:caseId', (req, res) => {
  const { caseId } = req.params;
  if (!caseId || !textRelay.has(caseId)) {
    return res.status(404).json({ ok: false, error: 'caseId not found.' });
  }
  res.json({ ok: true, data: textRelay.get(caseId) });
});

// optional: clear when done
app.post('/relay/clear', (req, res) => {
  const { caseId } = req.body || {};
  if (caseId) textRelay.delete(caseId);
  res.json({ ok: true });
});
