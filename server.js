// Lohit SOAP App v1.4 – flat layout (no /public folder)
// CommonJS, no dotenv. Designed for Render with files in repo root.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Simple in-memory store for attachments (resets on restart)
const cases = {};

// ---------- MIDDLEWARE ----------

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static files from repo root (index.html, app.js, style.css, etc.)
app.use(express.static(__dirname));

// ---------- ATTACHMENT ROUTES ----------

// Get attachments for a case
app.get('/api/cases/:caseId/attachments', (req, res) => {
  const { caseId } = req.params;
  if (!caseId) {
    return res.status(400).json({ error: 'Missing caseId' });
  }
  const record = cases[caseId] || { attachments: [] };
  res.json({ attachments: record.attachments });
});

// Add a redacted attachment (image data URL) for a case
app.post('/api/cases/:caseId/attachments', (req, res) => {
  const { caseId } = req.params;
  const { dataUrl } = req.body;

  if (!caseId || !dataUrl) {
    return res.status(400).json({ error: 'caseId and dataUrl are required' });
  }

  // Only allow image data URLs
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }

  if (!cases[caseId]) {
    cases[caseId] = { attachments: [] };
  }

  const attachment = {
    id: Date.now().toString(),
    dataUrl
  };

  cases[caseId].attachments.push(attachment);
  res.json({ ok: true, attachment });
});

// ---------- SOAP GENERATOR ----------

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

    const systemPrompt = `
You are the backend brain for "Lohit SOAP App", a veterinary SOAP generator.

You receive structured intake JSON from the web app and MUST output a single JSON object:

{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "medications_dispensed": "...",
  "aftercare": "..."
}

RULES:

- For surgeries use sections: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare.
- Subjective: concise, owner concerns + presenting problem.
- Objective: full PE body systems paragraph-style. Order:
  General, Vitals (only if provided), Eyes/Ears/Oral/Nose, Respiratory,
  Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological,
  Integument (include surgical site), Lymphatic.
  If a system is not mentioned in input, write:
  "Not specifically documented, within normal limits unless otherwise noted."
- Assessment: problem list + overall assessment (e.g. "Healthy for spay").
  Interpret diagnostics here only.
- Plan (surgery) MUST be ordered:
  1) IV Catheter / Fluids
  2) Pre-medications
  3) Induction / Maintenance
  4) Surgical Prep
  5) Surgical Procedure
  6) Intra-op Medications
  7) Recovery
  8) Medications Dispensed
  9) Aftercare
- Mention that detailed drug doses and vitals are on the anesthesia sheet if not fully provided.
- Medications Dispensed: take-home meds only, with name, concentration in [brackets],
  dose, route, frequency, and duration (no exact times).
- Aftercare: activity restriction, incision monitoring, e-collar, recheck, and any extra notes.
- Diagnostics: raw values/summaries belong in Objective; meaning belongs in Assessment.
- Do NOT invent vitals, drugs, doses, or diagnostics. If unknown, keep generic
  (e.g. "See anesthesia sheet for details").
- Output MUST be valid JSON only. No markdown, no explanations.
    `.trim();

    const userContent = JSON.stringify(payload, null, 2);

    // Node 22+ on Render has global fetch
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
              'Here is the structured intake JSON from the SOAP app. Generate the SOAP JSON object:\n\n' +
              userContent
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res
        .status(500)
        .json({ error: data.error?.message || 'OpenAI API error' });
    }

    let content = (data.choices?.[0]?.message?.content || '').trim();
    let soap;

    try {
      soap = JSON.parse(content);
    } catch (e) {
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

// ---------- CATCH-ALL: SEND MAIN INDEX.HTML ----------

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------- START SERVER ----------

app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.4 listening on port ${PORT}`);
});