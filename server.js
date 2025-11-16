// server.js
// Simple Express backend for Lohit SOAP App v1.6

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // set this in Render / locally
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to call OpenAI in one place
async function callOpenAI({ system, user }) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini', // or any model you prefer
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
  });

  return response.choices[0].message.content;
}

// MAIN endpoint: SOAP + Toolbox + Consult
app.post('/api/run', async (req, res) => {
  try {
    const { mode, payload } = req.body; // mode: 'soap', 'toolbox-bloodwork', 'toolbox-email', 'consult'

    if (!mode || !payload) {
      return res.status(400).json({ error: 'Missing mode or payload' });
    }

    let system = '';
    let user = '';

    if (mode === 'soap') {
      // payload: { soapType, strictMode, caseLabel, fields, refinementNote? }
      const { soapType, strictMode, caseLabel, fields, refinementNote } = payload;

      // NOTE: KEEP THIS SYSTEM PROMPT SHORTISH.
      // LATER we’ll replace with your full “master script” once we finalize it.
      system = `
You are a veterinary SOAP generator for Dr. Lohit Busanelli.

Global rules:
- Output MUST be Avimark-compatible plain text (no bullets, no weird symbols).
- Sections in this order with headings on their own lines:
  Subjective:
  Objective:
  Assessment:
  Plan:
  Medications Dispensed:
  Aftercare:
- Within Plan, use numbered subheadings in this exact order, separated by ONE blank line between categories and no extra blank lines inside a category:
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
- In Objective, bloodwork is DATA ONLY (values/findings). All interpretation goes in Assessment.
- Use single spacing within sections. Only put blank lines between Plan subsections (1–9) as described.
- Use a full physical exam list in Objective (General, Vitals, Eyes, Ears, Oral, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic). If PE is missing and Help Me mode is enabled, you may use safe templated normals and clearly note assumptions.
- For surgery/dental cases, include ASA status in Assessment.
- Default oral findings rule: under 4 years, normal mouth; 4–8 years mild tartar; over 8 years moderate tartar unless otherwise specified.
- Surgical and dental closure details:
  - For dental extractions: mention AAHA/AVDC standards, tension-free flap, no denuded bone, suture line not over defect, closure with 4-0 Monocryl in simple interrupted pattern when appropriate.

STRICT MODE vs HELP ME:
- If strictMode is true: do NOT invent any data. Explicitly write when information is missing (e.g., "No vitals provided.").
- If strictMode is false (Help Me mode): you may lightly fill in safe, generic normals for missing items (especially PE), but:
  - NEVER invent doses that contradict provided data.
  - Add a short "Missing/Assumed" summary at the END of Assessment listing what you assumed.

Formatting:
- Make it easy to paste into Avimark. No bullet symbols, no emojis, no fancy characters.
- Keep sentences short and clinical.
`;

      user = `
You will receive:
- soapType: "appointment" or "surgery"
- caseLabel: optional free text from the doctor
- fields: object with all raw inputs from the app (history, PE, diagnostics, anesthesia details, etc.)
- strictMode: true/false
- refinementNote: optional extra details the doctor added in a later refine step.

Task:
1) Generate a complete, formatted SOAP following all rules above.
2) Respect strictMode behavior.
3) Use fields exactly as given. NEVER contradict explicit user-provided data.
4) If something is not provided and you are in strictMode, leave it blank or explicitly say it was not provided.
5) If in Help Me mode (strictMode = false), you may help by adding safe generic normals for PE and anesthesia narrative, but still be conservative.

Now here is the JSON input from the app:

soapType: ${soapType}
caseLabel: ${caseLabel || '(none provided)'}
strictMode: ${strictMode ? 'true' : 'false'}
refinementNote: ${refinementNote || '(none)'}

fields (raw user inputs):
${JSON.stringify(fields, null, 2)}
`;

    } else if (mode === 'toolbox-bloodwork') {
      const { text, detailLevel, includeDiffs, includeClientFriendly } = payload;

      system = `
You are "Bloodwork Helper Lite" for a veterinary clinic.

Goal:
- Turn the vet's raw bloodwork notes into a SHORT Assessment-style snippet that can be pasted into Avimark.

Rules:
- Output ONLY the text snippet (no headings, no "Assessment:" label).
- Use simple, clinical language.
- Write in complete sentences or short jot-note style.
- Do not list actual numeric values unless they were provided in the input.
- If "includeDiffs" is true, add 2–4 likely differentials based on the abnormalities, phrased briefly.
- If "includeClientFriendly" is true, end with 1–2 short sentences in owner-friendly language.

detailLevel:
- "short": 1–2 concise sentences.
- "standard": 3–6 sentences with a bit more explanation.
`;

      user = `
detailLevel: ${detailLevel}
includeDiffs: ${includeDiffs ? 'true' : 'false'}
includeClientFriendly: ${includeClientFriendly ? 'true' : 'false'}

Raw vet text:
${text}
`;

    } else if (mode === 'toolbox-email') {
      const { emailType, petName, ownerName, timeframe, notes } = payload;

      system = `
You are "Client Email Helper Lite" for a veterinary clinic.

Goal:
- Draft a clear, kind, professional email body the clinic can paste into their email client.

Rules:
- Do NOT include "Dear ..." or signatures; just the body content.
- Use Canadian spelling when relevant.
- Be reassuring but honest.
- Avoid promising outcomes.
- Refer to the pet by name when provided.
- Keep paragraphs short for easy reading.
- Do not mention specific prices unless the notes explicitly contain them.
- Never include medical record numbers or microchip info.
`;

      user = `
emailType: ${emailType}
petName: ${petName || '(not provided)'}
ownerName: ${ownerName || '(not provided)'}
recheckTimeframe: ${timeframe || '(not provided)'}

Extra notes from vet:
${notes || '(none)'}
`;

    } else if (mode === 'consult') {
      const { message } = payload;

      system = `
You are a friendly, efficient veterinary assistant for Dr. Lohit Busanelli.

Use:
- The doctor might ask you to draft SOAP snippets, discharge instructions, emails, letters, or talk through a plan.
- Reply in a way that is easy to copy into Avimark (plain text, short paragraphs or jot notes).
- Assume cases are in Ontario, Canada.
- Do NOT give exact drug dosages unless explicitly asked.
- Never include client phone numbers, emails, or microchip numbers.
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

// Fallback for SPA routing if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lohit SOAP App v1.6 listening on port ${PORT}`);
});