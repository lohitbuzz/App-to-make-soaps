const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const assistantId = process.env.ASSISTANT_ID;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  };
}

exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: "Method not allowed"
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      mode,          // "soap" | "toolbox" | "consult"
      soapInput,
      toolboxInput,
      consultInput,
      visionNotes,
      voiceNotes
    } = body;

    const userPrompt = buildUserPrompt({
      mode,
      soapInput,
      toolboxInput,
      consultInput,
      visionNotes,
      voiceNotes
    });

    // Use Assistants API so you get your full “brain” instructions
    const thread = await client.beta.threads.create({
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistantId
    });

    let text = "";

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(thread.id, {
        limit: 1
      });

      const msg = messages.data[0];
      text = msg.content
        .filter((p) => p.type === "text")
        .map((p) => p.text.value)
        .join("\n\n");
    } else {
      text = `Run status: ${run.status}`;
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, output: text })
    };
  } catch (err) {
    console.error("SOAP function error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

function buildUserPrompt({
  mode,
  soapInput = {},
  toolboxInput = {},
  consultInput = {},
  visionNotes,
  voiceNotes
}) {
  if (mode === "toolbox") {
    return buildToolboxPrompt(toolboxInput);
  }

  if (mode === "consult") {
    return buildConsultPrompt(consultInput);
  }

  // default = SOAP
  return buildSoapPrompt(soapInput, visionNotes, voiceNotes);
}

function buildSoapPrompt(input = {}, visionNotes, voiceNotes) {
  const {
    visitType,
    surgeryMode,
    caseLabel,
    patientName,
    weightKg,
    species,
    sex,
    asa,
    tprNotes,
    surgeryPreset,
    vaccinesDoneToday,
    coreNotes,
    peDiagnostics,
    assessmentHints,
    planHints,
    extraInstructions
  } = input;

  const lines = [];

  lines.push("TASK: Generate a full veterinary SOAP note + discharge for a small animal clinic.");
  lines.push(
    "Apply all Moksha SOAP clinic rules: Avimark-compatible S/O/A/P, detailed PE list in Objective, data-only lab summaries there, interpretation in Assessment, fixed Plan category order, anesthesia/dental rules, drug concentrations in brackets, etc."
  );

  lines.push("");
  lines.push("=== CASE INFO ===");
  lines.push(`Visit type: ${visitType || "not specified"}`);
  if (surgeryMode) lines.push(`Surgery mode: ${surgeryMode}`);
  if (caseLabel) lines.push(`Case label: ${caseLabel}`);
  if (patientName) lines.push(`Patient: ${patientName}`);
  if (weightKg) lines.push(`Weight (kg): ${weightKg}`);
  if (species) lines.push(`Species: ${species}`);
  if (sex) lines.push(`Sex: ${sex}`);
  if (asa) lines.push(`ASA (surgery): ${asa}`);
  if (tprNotes) lines.push(`TPR / vitals / BCS notes: ${tprNotes}`);
  if (surgeryPreset) lines.push(`Surgery preset: ${surgeryPreset}`);
  if (vaccinesDoneToday) lines.push("Vaccines were done at this visit.");

  if (coreNotes) lines.push(`Core notes / history: ${coreNotes}`);
  if (peDiagnostics) lines.push(`PE & diagnostics (data only): ${peDiagnostics}`);
  if (assessmentHints) lines.push(`Assessment hints: ${assessmentHints}`);
  if (planHints) lines.push(`Plan / discharge hints: ${planHints}`);
  if (extraInstructions) lines.push(`Extra instructions: ${extraInstructions}`);

  if (voiceNotes) {
    lines.push("");
    lines.push(`Voice notes transcript: ${voiceNotes}`);
  }

  if (visionNotes) {
    lines.push("");
    lines.push(`Vision / attachments summary: ${visionNotes}`);
  }

  lines.push("");
  lines.push(
    "Output MUST be Avimark-compatible text with headings: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare. No extra blank lines except between Plan categories."
  );

  return lines.join("\n");
}

function buildToolboxPrompt(input = {}) {
  const { toolMode, rawText } = input;

  const modeLine =
    toolMode ||
    "auto-detect between bloodwork summary vs client email vs small doc explanation.";

  return [
    "TASK: Toolbox Lite helper.",
    `Mode: ${modeLine}`,
    "",
    "If it looks like bloodwork: give short and standard summaries plus 3–5 likely differentials, in vet-facing language, then a client-friendly explanation.",
    "If it looks like a client email or small doc: draft a clear, warm, professional message appropriate for a small animal vet clinic in Ontario.",
    "",
    "Source text:",
    rawText || "(none)"
  ].join("\n");
}

function buildConsultPrompt(input = {}) {
  const { question } = input;

  return [
    "TASK: Free-form consult for a small animal veterinarian (Ontario).",
    "Give a concise, practical answer first, then a bit more detail and options if helpful.",
    "",
    "Question / context:",
    question || "(none)"
  ].join("\n");
}