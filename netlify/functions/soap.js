import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// You gave this assistant id earlier
const ASSISTANT_ID = "asst_4sHUgx1lQ7Ob4KJtgKQvsTb";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { mode } = body;

    let userPrompt = "";

    if (mode === "appointment") {
      userPrompt = buildAppointmentPrompt(body);
    } else if (mode === "surgery") {
      userPrompt = buildSurgeryPrompt(body);
    } else {
      return res.status(400).json({ error: "Invalid SOAP mode" });
    }

    const systemPrompt = `
You are the Moksha SOAP assistant for a Canadian small animal veterinary clinic.
Generate Avimark-compatible SOAP notes following the clinic's master rules:

- Subjective: concise summary using history, presenting complaint, context.
- Objective: full PE by system (General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular, Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic).
- Diagnostics in Objective are data-only; interpretations go to Assessment.
- Assessment: problem-based list and differentials when relevant.
- Plan: for surgical cases use this exact order with spacing only between categories:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare
- For non-surgical appointments, still use a clear Plan but without the surgical headings.
- For all drugs in Plan, include concentration in brackets immediately after drug name.
- Midazolam concentration is always written as [5 mg/mL].
- Do NOT include exact administration times.
- For dentals, mention monitoring (SpO2, ETCO2, BP, ECG, fluids) and local oral nerve blocks
  when appropriate, with lidocaine dose caps (≤4 mg/kg dogs, ≤2 mg/kg cats).
- Be concise but complete. Avoid purple prose. Use single spacing and no blank lines
  except between Plan categories for surgery.

Strictly respect the provided data. In "Hybrid / Help Me" style:
- You may safely infer normal PE findings if none are given, but do not invent crazy details.
- If key information is missing, state assumptions briefly in the Assessment.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            { type: "text", text: systemPrompt },
          ],
        },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
          ],
        },
      ],
      metadata: { tool: "soap", mode },
    });

    const text =
      response.output?.[0]?.content?.[0]?.text?.value ||
      response.output_text ||
      "";

    return res.json({ soap: text });
  } catch (err) {
    console.error("SOAP function error:", err);
    return res.status(500).json({ error: err.message || "SOAP error" });
  }
}

function buildAppointmentPrompt(body) {
  const {
    reason = "",
    history = "",
    pe = "",
    diagnostics = "",
    assessmentHints = "",
    planHints = "",
    medsHints = "",
    transcript = "",
    files = [],
  } = body;

  return `
APPOINTMENT CASE
Reason for visit: ${reason}
History: ${history}
PE (data-only): ${pe}
Diagnostics (data-only): ${diagnostics}
Assessment hints: ${assessmentHints}
Plan hints: ${planHints}
Meds dispensed hints: ${medsHints}
Voice transcript (optional): ${transcript}
Attached files (names only; treat as context, do NOT reference them explicitly): ${files
    .map((f) => f.name)
    .join(", ")}

Generate a single, clean SOAP note.
`;
}

function buildSurgeryPrompt(body) {
  const {
    sxMode = "simple",
    preset = "",
    reason = "",
    history = "",
    pe = "",
    diagnostics = "",
    premed = "",
    induction = "",
    fluids = "",
    tubeIV = "",
    intraOpMeds = "",
    postOpMeds = "",
    procedureNotes = "",
    recovery = "",
    medsDispensed = "",
    transcript = "",
    files = [],
  } = body;

  return `
SURGERY CASE
UI mode: ${sxMode}
Preset type: ${preset || "none"}
Reason for surgery: ${reason}
History: ${history}
PE (data-only): ${pe}
Diagnostics (data-only): ${diagnostics}

Anesthesia details:
- Premed cocktail: ${premed || "not specified"}
- Induction: ${induction || "not specified"}
- Fluids: ${fluids || "not specified"}
- ET tube / IV line: ${tubeIV || "not specified"}
- Intra-op meds: ${intraOpMeds || "none listed"}
- Post-op meds: ${postOpMeds || "none listed"}

Procedure notes: ${procedureNotes}
Recovery notes: ${recovery}
Meds dispensed: ${medsDispensed}

Voice transcript (optional): ${transcript}
Attached files (names only; do NOT reference them explicitly): ${files
    .map((f) => f.name)
    .join(", ")}

Generate a surgery SOAP with:
- ASA status inferred if needed (state your assumption briefly).
- Correct Plan structure and suture / closure details inferred from the context.
`;
}