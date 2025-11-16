// server.js - backend for Lohit SOAP App v1.6

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // set on Render
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// helper
async function callOpenAI({ system, user }) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.4
  });
  return response.choices[0].message.content;
}

app.post('/api/run', async (req, res) => {
  try {
    const { mode, payload } = req.body;
    if (!mode || !payload) {
      return res.status(400).json({ error: 'Missing mode or payload' });
    }

    let system = '';
    let user = '';

    if (mode === 'soap') {
      const { soapType, strictMode, caseLabel, fields, refinementNote } = payload;

      system = `
You are a veterinary SOAP generator for Dr. Lohit Busanelli.

Global rules:
- Output MUST be Avimark-compatible plain text (no bullets, emojis, or special symbols).
- Always output these headings, each on its own line, in this order:
  Subjective:
  Objective:
  Assessment:
  Plan:
  Medications Dispensed:
  Aftercare:
- Within Plan, include numbered subsections in this exact order, with ONE blank line between categories, and no extra blank lines inside a category:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- Drug formatting: every drug name must be followed by its concentration in brackets, e.g. "Hydromorphone (2 mg/ml)". Midazolam must always appear as "Midazolam (5 mg/ml)".
- Objective: physical exam is DATA ONLY (no interpretation). Bloodwork also DATA ONLY; interpretations go in Assessment.
- Use a full PE list in Objective: General, Vitals, Eyes, Ears, Oral, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic.
- Oral findings rule: under 4y = normal; 4–8y = mild generalized tartar; over 8y = moderate tartar, unless user provides different oral data.
- For surgical/dental cases, include ASA status in Assessment.
- For dental extractions, mention that AAHA/AVDC standards were followed; closure with tension-free flap, no denuded bone, suture line not over defect, 4-0 Monocryl simple interrupted when appropriate.
- Single spacing inside sections. Only add blank lines between Plan subsections 1–9.

STRICT vs HELP ME:
- If strictMode = true: do NOT invent any missing data. Explicitly state when information was not provided.
- If strictMode = false (Help Me): you may fill in safe generic normals for PE and anesthesia narrative, but never contradict explicit user data. Add a short "Missing/Assumed" summary at the END of Assessment listing what you assumed.

Formatting:
- Keep sentences short, clinical, and easy to paste into Avimark.
`;

      user = `
You will receive JSON-like input from the app with:
- soapType: "appointment" or "surgery"
- caseLabel: optional free text
- fields: raw user inputs
- strictMode: true/false
- refinementNote: optional free-text additions from a refine step.

Task:
1) Generate a complete SOAP using the rules above.
2) Respect strictMode behaviour.
3) Never contradict explicit user-entered data.
4) If strict and something is missing, say it was not provided.
5) In Help Me mode, you may add safe, generic normals and then list assumptions in "Missing/Assumed" at the end of Assessment.

Now here is the input:

soapType: ${soapType}
caseLabel: ${caseLabel || '(none)'}
strictMode: ${strictMode ? 'true' : 'false'}
refinementNote: ${refinementNote || '(none)'}

fields:
${JSON.stringify(fields, null, 2)}
`;

    } else if (mode === 'toolbox-bloodwork') {
      const { text, detailLevel, includeDiffs, includeClientFriendly } = payload;

      system = `
You are "Bloodwork Helper Lite" for a veterinary clinic.

Goal:
- Convert raw bloodwork / lab notes from the veterinarian into a SHORT Assessment-style snippet for Avimark.

Rules:
- Output ONLY the snippet (no headings).
- Use simple clinical language, short sentences or jot notes.
- Do not invent exact numeric values.
- If includeDiffs = true, add 2–4 brief likely differentials.
- If includeClientFriendly = true, finish with 1–2 owner-friendly sentences.

detailLevel:
- "short": 1–2 sentences.
- "standard": 3–6 sentences.
`;

      user = `
detailLevel: ${detailLevel}
includeDiffs: ${includeDiffs ? 'true' : 'false'}
includeClientFriendly: ${includeClientFriendly ? 'true' : 'false'}

Raw vet notes:
${text}
`;

    } else if (mode === 'toolbox-email') {
      const { emailType, petName, ownerName, timeframe, notes } = payload;

      system = `
You are "Client Email Helper Lite" for a veterinary clinic.

Goal:
- Draft a clear, kind, professional email BODY (no greeting, no signature) for clients.

Rules:
- Do NOT include "Dear ..." or sign-off.
- Use Canadian spelling when relevant.
- Reassuring but honest; avoid promising outcomes.
- Refer to the pet by name when provided.
- Keep paragraphs short.
- Do not mention prices unless they appear in the notes.
- Never include IDs, phone numbers, or microchip numbers.
`;

      user = `
emailType: ${emailType}
petName: ${petName || '(not provided)'}
ownerName: ${ownerName || '(not provided)'}
recheckTimeframe: ${timeframe || '(not provided)'}

Extra notes:
${notes || '(none)'}
`;

    } else if (mode === 'consult') {
      const { message } = payload;

      system = `
You are a friendly, efficient veterinary assistant for Dr. Lohit Busanelli.

Use:
- The doctor may ask for SOAP snippets, discharge instructions, client emails, letters, or planning help.
- Reply in Avimark-friendly plain text (no bullets, no emojis).
- Short paragraphs or jot notes.
- Assume Ontario, Canada.
- Do not include microchip numbers or client contact details.
`;

      user = message;

    } else {
      return res.status(400).json({ error: 'Unknown mode' });
    }

    const content = await callOpenAI({ system, user });
    res.json({ result: content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.6 running on port ${PORT}`);
});