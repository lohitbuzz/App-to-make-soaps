const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function corsHeaders(origin) {
  const allowed =
    ALLOWED_ORIGIN === "*" ? origin || "*" : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Call OpenAI Assistants API (v1) for SOAP
async function runAssistant(userPrompt) {
  if (!OPENAI_API_KEY || !ASSISTANT_ID) {
    throw new Error("Missing OPENAI_API_KEY or ASSISTANT_ID");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "OpenAI-Beta": "assistants=v1",
  };

  // 1) Create thread with messages
  const threadRes = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!threadRes.ok) {
    const text = await threadRes.text();
    throw new Error(`Thread error: ${text}`);
  }
  const thread = await threadRes.json();

  // 2) Run assistant
  const runRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/runs`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID }),
    },
  );

  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(`Run error: ${text}`);
  }
  const run = await runRes.json();

  // 3) Poll until completed
  let completedRun = run;
  while (
    completedRun.status === "queued" ||
    completedRun.status === "in_progress" ||
    completedRun.status === "cancelling"
  ) {
    await sleep(1000);
    const checkRes = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/runs/${completedRun.id}`,
      { headers },
    );
    if (!checkRes.ok) {
      const text = await checkRes.text();
      throw new Error(`Run check error: ${text}`);
    }
    completedRun = await checkRes.json();
  }

  if (completedRun.status !== "completed") {
    throw new Error(`Run failed with status: ${completedRun.status}`);
  }

  // 4) Fetch latest message
  const msgRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/messages?limit=1`,
    { headers },
  );

  if (!msgRes.ok) {
    const text = await msgRes.text();
    throw new Error(`Message fetch error: ${text}`);
  }
  const msgData = await msgRes.json();
  const first = msgData.data && msgData.data[0];
  if (
    !first ||
    !first.content ||
    !first.content[0] ||
    !first.content[0].text
  ) {
    throw new Error("No text content from assistant");
  }

  return first.content[0].text.value;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "*";
  const baseHeaders = corsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: baseHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: "Method not allowed",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { mode, action, fields, visionSummary, existingOutput, feedback } =
      body;

    if (!mode || !action) {
      throw new Error("Missing mode or action");
    }

    let prompt = "";

    if (action === "generate") {
      if (mode === "appointment") {
        prompt = `
You are the Moksha vet SOAP assistant. Generate an Avimark-friendly SOAP for an APPOINTMENT case using the clinic's rules:
- Subjective: concise owner concerns & history.
- Objective: full PE using system list, diagnostics as data-only (values, no interpretation).
- Assessment: problem list + interpretations (including bloodwork) and grades of disease.
- Plan: diagnostics, treatments, procedures, restrictions, recheck timing, aftercare.

Format with clear S:, O:, A:, P: headings and no extra blank lines.

Use this information:
Reason: ${fields?.reason || ""}
History: ${fields?.history || ""}
PE (data-only): ${fields?.pe || ""}
Diagnostics (data-only): ${fields?.diagnostics || ""}
Assessment hints: ${fields?.assessmentHints || ""}
Plan hints: ${fields?.planHints || ""}
Meds hints: ${fields?.medsHints || ""}
Transcript (optional): ${fields?.transcript || ""}

Vision summary (from attached photos / labs), if any:
${visionSummary || "No vision data."}
`;
      } else if (mode === "surgery") {
        prompt = `
You are the Moksha vet SURGERY SOAP assistant. Generate an Avimark-friendly surgical SOAP with these rules:
- Subjective: presenting complaint, relevant history.
- Objective: full PE system list and diagnostics as data-only.
- Assessment: surgical problem list + anesthesia grade (ASA).
- Plan: use this fixed order:
  1. IV Catheter / Fluids
  2. Pre-medications
  3. Induction / Maintenance
  4. Surgical Prep
  5. Surgical Procedure
  6. Intra-op Medications
  7. Recovery
  8. Medications Dispensed
  9. Aftercare

Strictly follow the user's preferences for Monocryl sizing and closure style. No extra blank lines inside the plan sections.

Case details:
Reason for surgery: ${fields?.reason || ""}
History: ${fields?.history || ""}
Pre-op PE (data-only): ${fields?.pe || ""}
Diagnostics (data-only): ${fields?.diagnostics || ""}

Anesthesia:
Premed: ${fields?.premed || ""}
Induction: ${fields?.induction || ""}
Intra-op meds: ${fields?.intraOp || ""}
Post-op meds: ${fields?.postOp || ""}

Procedure notes: ${fields?.procedure || ""}
Recovery notes: ${fields?.recovery || ""}
Meds dispensed: ${fields?.medsDispensed || ""}

Vision summary from attachments:
${visionSummary || "No vision data."}
`;
      } else {
        throw new Error("Unknown mode");
      }
    } else if (action === "refine") {
      prompt = `
You are refining an EXISTING SOAP. Keep the structure and medical accuracy, but adjust per feedback.

Existing SOAP:
${existingOutput || "(none)"}

User feedback:
${feedback || "(none)"}

Return ONLY the improved SOAP text.`;
    } else {
      throw new Error("Unknown action");
    }

    const resultText = await runAssistant(prompt);

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ output: resultText }),
    };
  } catch (err) {
    console.error("SOAP function error:", err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: `SOAP error: ${err.message}`,
    };
  }
};