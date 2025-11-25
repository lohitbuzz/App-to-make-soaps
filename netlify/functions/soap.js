import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
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
    files = [],
  } = body;

  const fileSummary =
    files && files.length
      ? files.map((f) => `${f.name} (${f.type || "unknown"})`).join(", ")
      : "No files";

  return `
You are a small animal veterinarian generating Avimark-compatible SOAP notes for an appointment (non-surgical) at a busy Canadian clinic.

Rules:
- Use four sections with clear headings: "Subjective:", "Objective:", "Assessment:", "Plan:".
- Subjective: concise owner concerns + relevant history in paragraph form.
- Objective:
  - Present a system-based physical exam template with findings:
    General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular, Abdomen,
    Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic.
  - Include the provided physical exam details and keep formatting Avimark-friendly
    (plain text, line breaks only, no bullet symbols).
  - Under "Diagnostics" inside Objective, list diagnostics as DATA ONLY
    (values and descriptive findings). Do NOT interpret lab values or imaging here.
- Assessment:
  - Provide a concise problem list and your assessment/interpretation of findings.
  - Interpret all labs/imaging here, not in Objective.
  - If you need to assume any normals because data are missing, make safe, generic assumptions
    and add a short line "Assumptions: ..." at the end of Assessment.
- Plan:
  - Organize into clear paragraphs, but this is an appointment (not a surgery),
    so you do NOT need the anesthesia category list.
  - Include diagnostics, treatments, medications, and follow-up.
  - When you mention a drug, ALWAYS include its concentration in square brackets, e.g.:
    "Metacam [1.5 mg/mL]". Always write "Midazolam [5 mg/mL]".
  - Do NOT include specific administration times.
- Keep spacing Avimark-safe: single spacing inside each section.
  Just one blank line between the main SOAP sections (S, O, A, P).
- Tone: medically precise but efficient, assuming the reader is another veterinarian.

INPUT
Reason for visit:
${reason || "(not provided)"}

History:
${history || "(not provided)"}

Physical exam (data-only):
${pe || "(not provided)"}

Diagnostics (data-only):
${diagnostics || "(not provided)"}

Assessment hints from vet:
${assessmentHints || "(none)"}

Plan hints from vet:
${planHints || "(none)"}

Meds dispensed hints:
${medsHints || "(none)"}

Attached files (names only):
${fileSummary}
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
    lines = "",
    intraOp = "",
    postOp = "",
    recovery = "",
    procedureNotes = "",
    medsDispensed = "",
    files = [],
  } = body;

  const fileSummary =
    files && files.length
      ? files.map((f) => `${f.name} (${f.type || "unknown"})`).join(", ")
      : "No files";

  const isDental =
    (preset || "").toLowerCase().includes("dental") ||
    (reason || "").toLowerCase().includes("dental") ||
    (reason || "").toLowerCase().includes("cohat");

  return `
You are a small animal veterinarian generating an Avimark-compatible SURGERY/ANESTHESIA SOAP note at a Canadian clinic.

Global rules:
- Use headings "Subjective:", "Objective:", "Assessment:", "Plan:".
- Subjective: brief indication for surgery and key history.
- Objective:
  - System-based physical exam, with the following order:
    General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular, Abdomen,
    Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic, Diagnostics.
  - Diagnostics sub-section: list pre-anesthetic bloodwork and imaging as DATA ONLY.
    Do NOT interpret lab values or imaging in Objective.
- Assessment:
  - Include problem list and overall assessment.
  - Assign and state ASA physical status (e.g. "ASA II") with a brief explanation.
  - Interpret diagnostics and any notable anesthetic risk here.
  - If info is missing and you infer safe defaults, add "Assumptions: ..." at the end.
- Plan (CRITICAL — follow this exact category order, with ONE blank line between categories):
  1) IV Catheter / Fluids
  2) Pre-medications
  3) Induction / Maintenance
  4) Surgical Prep
  5) Surgical Procedure
  6) Intra-op Medications
  7) Recovery
  8) Medications Dispensed
  9) Aftercare

- Within Plan:
  - Populate each category with relevant information derived from inputs.
  - When you mention a drug, ALWAYS include its concentration in square brackets.
    Example: "Metacam [1.5 mg/mL]". Always write "Midazolam [5 mg/mL]".
  - Do NOT include specific administration times.
- For dental surgeries (if this appears to be a COHAT/dental case):
  - Mention perioperative monitoring: SpO2, ETCO2, blood pressure, ECG, and IV fluids.
  - Mention oral nerve blocks and lidocaine dose caps (≤4 mg/kg dogs, ≤2 mg/kg cats) if local blocks implied.
  - For extractions, reference AAHA/AVDC standards and closure as
    "tension-free flap, no denuded bone, suture line not over defect" using 4-0 Monocryl in a simple interrupted pattern.
- Keep everything Avimark-friendly: plain text, no bullet glyphs, no tables.

Input context:
Surgery template preset:
${preset || "(none selected)"}

Surgical indication:
${reason || "(not provided)"}

History:
${history || "(not provided)"}

Physical exam (data-only):
${pe || "(not provided)"}

Diagnostics (data-only):
${diagnostics || "(not provided)"}

Anesthesia detail mode: ${sxMode}

Premed protocol:
${premed || "(not specified)"}

Induction / maintenance:
${induction || "(not specified)"}

IV catheter / ETT:
${lines || "(not specified)"}

Fluids:
${fluids || "(not specified)"}

Intra-op medications:
${intraOp || "(none specified)"}

Post-op medications:
${postOp || "(none specified)"}

Recovery notes:
${recovery || "(not specified)"}

Surgical procedure notes:
${procedureNotes || "(not specified)"}

Medications dispensed (take-home hints):
${medsDispensed || "(none specified)"}

Attached files (names only):
${fileSummary}

This ${isDental ? "appears to be a dental / COHAT case" : "is not clearly a dental case; treat as general surgery"}.
Generate ONE complete SOAP note following the rules above.
`;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { mode = "appointment" } = body;

    let prompt;
    if (mode === "surgery") {
      prompt = buildSurgeryPrompt(body);
    } else {
      prompt = buildAppointmentPrompt(body);
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a small-animal veterinarian generating Avimark-compatible SOAP notes, following clinic-specific rules exactly.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const soap = completion.choices?.[0]?.message?.content || "";

    return jsonResponse(200, { ok: true, mode, soap });
  } catch (err) {
    console.error("SOAP function error:", err);
    return jsonResponse(500, { error: "Failed to generate SOAP" });
  }
}
