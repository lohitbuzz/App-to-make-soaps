// Lohit SOAP App server - root index.html version
// CommonJS, no dotenv, designed for Render

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// In-memory case store for attachments (resets when server restarts)
const cases = {};

// Middleware
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static files (index.html, JS, CSS, etc.) from root
app.use(express.static(__dirname));

// ---- ROUTES ----

// Root – always send index.html (handles both main + capture modes via query)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get attachments for a case
app.get('/api/cases/:caseId/attachments', (req, res) => {
  const { caseId } = req.params;
  if (!caseId) {
    return res.status(400).json({ error: 'Missing caseId' });
  }
  const record = cases[caseId] || { attachments: [] };
  res.json({ attachments: record.attachments });
});

// Add a redacted attachment (data URL) for a case
app.post('/api/cases/:caseId/attachments', (req, res) => {
  const { caseId } = req.params;
  const { dataUrl } = req.body;

  if (!caseId || !dataUrl) {
    return res.status(400).json({ error: 'caseId and dataUrl are required' });
  }

  if (!cases[caseId]) {
    cases[caseId] = { attachments: [] };
  }

  // Basic safety: only allow data URLs
  if (!dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }

  cases[caseId].attachments.push({
    id: Date.now().toString(),
    dataUrl
  });

  res.json({ ok: true });
});

// SOAP generator – calls OpenAI and returns structured SOAP sections
app.post('/api/generate-soap', async (req, res) => {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_APIKEY ||
      process.env.OPENAI_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          'OPENAI_API_KEY is not set in Render environment variables. Add it and redeploy.'
      });
    }

    const assistantId = process.env.OPENAI_ASSISTANT_ID || null;
    if (assistantId) {
      console.log('Assistant ID configured (not used directly yet).');
    } else {
      console.log('Assistant ID not set (OPENAI_ASSISTANT_ID env var empty).');
    }

    const payload = req.body || {};

    // NOTE: This is a simple v1 prompt – we can later replace with your full Master Rules brain.
    const systemPrompt = `
You are the backend brain for "Lohit SOAP App", a veterinary SOAP generator.
You receive structured intake JSON from the web app and MUST output a single JSON object.

ALWAYS follow these clinic rules:

- Format for surgeries: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare.
- Subjective: concise, owner concerns + presenting problem only.
- Objective: full PE body systems paragraph style (General, Vitals if provided, Eyes/Ears/Oral/Nose/Resp/CV/Abdomen/Urogenital/MSK/Neuro/Integ/Lymphatic).
  Use ONLY data given; if not provided, write "Not specifically documented, within normal limits unless otherwise noted."
- Assessment: problem list and overall assessment (e.g. "Healthy for spay"). Interpret diagnostics here, NOT in Objective.
- Plan (for surgeries) MUST be ordered exactly:
  1) IV Catheter / Fluids
  2) Pre-medications
  3) Induction / Maintenance
  4) Surgical Prep
  5) Surgical Procedure
  6) Intra-op Medications
  7) Recovery
  8) Medications Dispensed
  9) Aftercare
- Medications Dispensed: list only take-home meds with name, concentration in [brackets], dose, route, and duration (no exact clock times).
- Aftercare: activity restriction, incision monitoring, e-collar, recheck, and any special notes.
- For bloodwork/diagnostics: raw values/summaries live in Objective; the meaning lives in Assessment.
- Do NOT invent vitals, drug names, doses, or diagnostics that were not hinted at. If something is missing, leave it generic (e.g. "See anesthesia sheet for full details") rather than hallucinating.
- Output MUST be valid JSON with these exact top-level keys:
  {
    "subjective": "...",
    "objective": "...",
    "assessment": "...",
    "plan": "...",
    "medications_dispensed": "...",
    "aftercare": "..."
  }
No markdown, no extra commentary, JSON only.
    `.trim();

    const userContent = JSON.stringify(payload, null, 2);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              'Here is the structured intake from the SOAP app. Use it to generate the SOAP JSON object:\n\n' +
              userContent
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(500).json({
        error: data.error?.message || 'OpenAI API error'
      });
    }

    let content = (data.choices?.[0]?.message?.content || '').trim();
    let soap;

    try {
      soap = JSON.parse(content);
    } catch (e) {
      // Fallback: wrap raw content into objective and leave others mostly empty
      console.warn('Failed to parse JSON from model, returning fallback.', e);
      soap = {
        subjective: '',
        objective: content,
        assessment: '',
        plan: '',
        medications_dispensed: '',
        aftercare: ''
      };
    }

    // Final safety: ensure all keys exist
    const safeSoap = {
      subjective: soap.subjective || '',
      objective: soap.objective || '',
      assessment: soap.assessment || '',
      plan: soap.plan || '',
      medications_dispensed: soap.medications_dispensed || '',
      aftercare: soap.aftercare || ''
    };

    res.json({ soap: safeSoap });
  } catch (err) {
    console.error('Error in /api/generate-soap:', err);
    res.status(500).json({ error: 'Server error generating SOAP' });
  }
});

// ---- START SERVER ----
app.listen(PORT, () => {
  console.log(`Lohit SOAP App listening on port ${PORT}`);
});