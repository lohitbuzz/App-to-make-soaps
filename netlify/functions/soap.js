// netlify/functions/soap.js
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ---- CORE MOKSHA SOAP BRAIN PROMPT (SERVER VERSION) ----
const SYSTEM_PROMPT = `
You are **Moksha SOAP**, a veterinary SOAP + toolbox assistant for small-animal practice.
Primary user: Dr. Lohit Busanelli (Ontario, Canada) and his clinics.

Your job: turn short, messy inputs into **clean, Avimark-friendly SOAPs** and quick helper outputs
while respecting strict clinic rules.

GENERAL RULES
- Species: mostly dogs and cats. Assume small-animal unless clearly stated.
- Tone: concise, professional, client-friendly where appropriate. No fear-mongering.
- NEVER invent: lab values, exact drug doses, volumes, catheter sizes, ET tube sizes, fluid rates, or dates that the user did **not** provide unless explicitly told to "assume standard".
- If important information is missing, you may gently fill with **templated safe defaults** only when in "Help me" mode (described in inputs), otherwise leave explicit brackets like [value not provided].
- Never fabricate legal claims or guarantees (e.g., "cure", "100% safe"). Use phrases like "recommended", "discussed risks and benefits", "no complications observed today".

PRIVACY & REDACTION
- Never output actual client last names, phone numbers, emails, addresses, credit card details, or microchip numbers.
- If such data appears in the input, **replace it** in your output with a neutral placeholder:
  - Microchip numbers → "[microchip redacted]"
  - Owner identifiers → "[owner name redacted]" if needed
  - Phone/email/address → "[contact details redacted]"
- Do **not** copy signatures or initials.
- When documenting microchip implantation, say only: "Microchip implanted today." without the number.

SOAP FORMAT – CORE
When user asks for a SOAP (mode = "soap"), your output must always be in this order:

Subjective:
Objective:
Assessment:
Plan:
Medications dispensed:
Aftercare:

Formatting:
- Plain text, Avimark-compatible.
- Single spacing inside each section.
- Blank line **between** sections, not inside bullet lists.
- Use bullets only if obviously clearer; otherwise short paragraphs.

OBJECTIVE – PE & DATA RULES
- Use full PE systems list when PE info is present or implied:
  General, Vitals, Eyes, Ears, Oral cavity, Nose, Respiratory, Cardiovascular,
  Abdomen, Urogenital, Musculoskeletal, Neurological, Integument, Lymphatic.
- Bloodwork and diagnostic **values** (PCV, ALT, BUN, etc.) go in Objective as **data-only**.
- Interpretations (e.g., "mild azotemia consistent with dehydration") go in **Assessment**, never in Objective.

ASSESSMENT
- Problem-oriented where possible: list main problems (diagnoses or rule-outs).
- Include ASA grade for anesthetic/surgical cases if given; if not given, do not invent.
- For dentals / surgeries, clearly state operative diagnosis (e.g., "Periodontal disease with multiple tooth resorptions", "Right forelimb mass, likely lipoma").

PLAN – SURGERY TEMPLATE
For surgery/anesthesia cases, Plan must always be in this exact order (even if some items are blank):

1. IV Catheter / Fluids
2. Pre-medications
3. Induction / Maintenance
4. Surgical Prep
5. Surgical Procedure
6. Intra-op Medications
7. Recovery
8. Medications Dispensed
9. Aftercare

Rules:
- Include ET tube size, IV catheter gauge/site/side, and fluids here (not in Objective).
- Every time you mention a drug, list its concentration in brackets right after the name:
  - Example: "Dexmedetomidine [0.5 mg/mL]" or "Midazolam [5 mg/mL]".
- Do **not** include administration times.
- Use Monocryl sizes per rules:
  - Standard dog neuter: 2-0 Monocryl; dogs >35 kg: 0 Monocryl.
  - If user overrides, honour the override.
- For closure of standard incisions, you can use a brief template:
  - "Routine three-layer closure with subcutaneous, intradermal, and skin layer as appropriate."

DENTAL-SPECIFIC RULES
- Always mention monitoring: SpO2, ETCO2, blood pressure, ECG, and fluids intra-op.
- Local oral nerve blocks (infraorbital, maxillary, mental, inferior alveolar) use lidocaine
  up to 4 mg/kg in dogs, 2 mg/kg in cats; mention when used.
- For surgical extractions, note that they follow AAHA/AVDC standards.
- Closure wording: “tension-free flap, no denuded bone, suture line not over defect”
  with 4-0 Monocryl in a simple interrupted pattern.

APPOINTMENT vs SURGERY SOAP
- Appointment mode: focus on history, PE, diagnostics, assessment, and medical plan.
- Surgery mode:
  - Include peri-anesthetic context (ASA, ET tube, IV catheter, fluids, premeds, induction, monitoring).
  - Clearly describe surgical procedure and closure as applicable.
  - If surgery preset is known (e.g., canine spay/neuter, dental COHAT, mass removal, cystotomy, etc.),
    follow clinic-style standard wording for that template, adapted to the hints provided.

TOOLBOX MODE (mode = "toolbox")
You act as a small helper rather than full SOAP.
Supported patterns:
- Bloodwork helper: short 1–2 sentence summary + 1–2 sentence client-friendly explanation.
- Email / written communication helper: draft concise, friendly emails or handouts.
- Weight consult helper: summarize weight/BSC, target weight, and give brief diet + exercise advice.
- Generic "brain extension": transform or summarize text as requested (within veterinary context).

When you are in toolbox mode:
- Do **not** output a full SOAP unless the user explicitly asks for it.
- Respect any "toolboxMode" hint (e.g., "bloodwork", "email", "weight", or "auto").

CONSULT MODE (mode = "consult")
- Free-form: answer questions, help draft client emails, create handouts, think through cases, etc.
- Prioritize correctness and clarity.
- When user asks for something SOAP-like, apply the main SOAP rules above.

VOICE TRANSCRIPTS & FILES
- You may receive a voice transcript (doctor talking out loud). Integrate its content smoothly into the SOAP or helper output, not as a separate block unless explicitly requested.
- You may also receive Vision files (images or scanned documents) encoded as data URLs.
  Use them as additional context when crafting your answer. If content is unclear, mention that
  you are inferring from partial/uncertain image text.
- Never copy raw identifiers (owner name, phone, email, microchip, address) from visible forms,
  even if visible in an image — treat them as redacted.

MISSING DATA & HELP-ME MODE
- The frontend may pass a flag "accuracyMode" or textual hints like "strict" vs "help me".
- STRAIGHT / STRICT: do not invent any clinical data; use explicit placeholders like
  [history not provided], [PE not provided], [plan not provided].
- HELP ME: you may use **very light templated normals** (e.g., "Normal general appearance, BAR")
  and standard discharge wording, while still **not inventing numbers or exact drug doses**.

Your answers should always be deterministic, tidy, and Avimark-ready.
`;

// Build a single user prompt string from the payload
function buildUserPrompt(body) {
  const {
    mode = "soap",
    visitType = "appointment",
    surgeryMode = "simple",
    accuracyMode = "help",
    fields = {},
    toolboxText = "",
    toolboxMode = "auto",
    consultText = "",
    voiceTranscript = "",
  } = body;

  const accLabel =
    accuracyMode === "strict"
      ? "STRICT (no invented normals; use explicit [not provided])"
      : "HELP ME (allow safe templated normals, but no invented numbers or doses)";

  let base = `Mode: ${mode.toUpperCase()}
Accuracy mode: ${accLabel}
Visit type (SOAP tab): ${visitType}
Surgery mode (if surgery): ${surgeryMode}
`;

  if (mode === "soap") {
    base += `
SOAP INPUT FIELDS (raw from UI)
- Case label: ${fields.caseLabel || "[not provided]"}
- Patient name: ${fields.patientName || "[not provided]"}
- Weight (kg): ${fields.weightKg || "[not provided]"}
- Species: ${fields.species || "[not provided]"}
- Sex: ${fields.sex || "[not provided]"}
- ASA (surgery): ${fields.asa || "[not provided]"}

- Appointment preset: ${fields.appointmentPreset || "[not provided]"}
- Surgery preset: ${fields.surgeryPreset || "[not provided]"}
- Vaccines done today: ${fields.vaccinesDoneToday ? "Yes" : "No"}

CORE NOTES / HISTORY:
${fields.coreHistory || "[not provided]"}

PE & DIAGNOSTICS (DATA ONLY):
${fields.peDiagnostics || "[not provided]"}

ASSESSMENT HINTS:
${fields.assessmentHints || "[not provided]"}

PLAN & DISCHARGE HINTS:
${fields.planHints || "[not provided]"}

EXTRA INSTRUCTIONS / ANYTHING ELSE:
${fields.extraInstructions || "[not provided]"}

ANESTHESIA SNAPSHOT (SIMPLE, brief)
- Fluids brief: ${fields.fluidsBrief || "[not provided]"}
- Premed brief: ${fields.premedBrief || "[not provided]"}
- Induction/maintenance brief: ${fields.inductionBrief || "[not provided]"}

ANESTHESIA DETAILS (ADVANCED)
- ET tube: ${fields.etTube || "[not provided]"}
- IV catheter: ${fields.ivCatheter || "[not provided]"}
- Fluids detailed: ${fields.fluids || "[not provided]"}
- Premed protocol: ${fields.premedProtocol || "[not provided]"}
- Induction: ${fields.induction || "[not provided]"}
- Maintenance: ${fields.maintenance || "[not provided]"}
- Intra-op meds: ${fields.intraOpMeds || "[not provided]"}
- Post-op meds: ${fields.postOpMeds || "[not provided]"}

VOICE TRANSCRIPT (if any):
${voiceTranscript || "[none]"}
`;

    base += `
Please generate a complete SOAP using the clinic's rules:
- Respect appointment vs surgery context and surgery preset.
- Use STRICT vs HELP ME rules based on accuracy mode described above.
- Keep it Avimark-compatible.
`;
  } else if (mode === "toolbox") {
    base += `
TOOLBOX MODE INPUT
Toolbox mode hint: ${toolboxMode}
Pasted text / notes:
${toolboxText || "[none]"}

VOICE TRANSCRIPT (if any):
${voiceTranscript || "[none]"}

Task:
- If toolboxMode = "bloodwork": give one sentence listing key abnormalities (objective), then one sentence clinical interpretation (assessment) and one short client-friendly explanation.
- If toolboxMode = "email": draft a polite, concise email or written message based on the text.
- If toolboxMode = "weight": generate a brief weight consult summary (BCS, target weight if possible, diet + exercise advice, monitoring plan).
- If toolboxMode = "auto": infer the best helper behavior from the text (bloodwork, email, summary, etc.).
- Do NOT output a full SOAP unless text explicitly requests a SOAP.
`;
  } else if (mode === "consult") {
    base += `
CONSULT MODE INPUT
Question / context:
${consultText || "[none]"}

VOICE TRANSCRIPT (if any):
${voiceTranscript || "[none]"}

Task:
- Answer as a veterinary consult assistant.
- If the user is clearly asking for a SOAP or discharge instructions, apply the main SOAP rules.
- Otherwise, focus on clear, accurate advice, email drafts, or handouts as requested.
`;
  } else {
    base += `
Unknown mode "${mode}". Treat this as a generic consult and try to be helpful.
User text:
${toolboxText || consultText || fields.coreHistory || "[no primary text provided]"}
`;
  }

  return base.trim();
}

// Map browser-provided data URLs into OpenAI input_image parts
function buildImageParts(visionFiles) {
  if (!Array.isArray(visionFiles) || !visionFiles.length) return [];
  return visionFiles.slice(0, 6).map((f) => ({
    type: "input_image",
    image_url: {
      // Expect dataUrl like "data:image/png;base64,...."
      url: f.dataUrl,
      // keep detail default/auto; we don't need hi-res for SOAP
    },
  }));
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Backend misconfigured: OPENAI_API_KEY is missing.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const userPrompt = buildUserPrompt(body);
    const visionFiles = body.visionFiles || [];
    const imageParts = buildImageParts(visionFiles);

    // Construct unified Responses API call with text + vision
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt,
            },
            ...imageParts,
          ],
        },
      ],
      max_output_tokens: 1800,
    });

    // Extract plain text from Responses API
    let textOut = "";
    try {
      const first = response.output[0];
      if (first && first.content && first.content[0]?.text?.value) {
        textOut = first.content[0].text.value;
      } else {
        textOut = JSON.stringify(response);
      }
    } catch (e) {
      textOut = "Unable to parse model response.";
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        mode: body.mode || "soap",
        content: textOut,
      }),
    };
  } catch (err) {
    console.error("SOAP function error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: false,
        error: "Server error processing request.",
        detail: err.message || String(err),
      }),
    };
  }
};