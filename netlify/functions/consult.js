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

async function runAssistant(prompt) {
  if (!OPENAI_API_KEY || !ASSISTANT_ID) {
    throw new Error("Missing OPENAI_API_KEY or ASSISTANT_ID");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "OpenAI-Beta": "assistants=v1",
  };

  const threadRes = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!threadRes.ok) throw new Error(await threadRes.text());
  const thread = await threadRes.json();

  const runRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/runs`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: ASSISTANT_ID }),
    },
  );
  if (!runRes.ok) throw new Error(await runRes.text());
  let run = await runRes.json();

  while (
    run.status === "queued" ||
    run.status === "in_progress" ||
    run.status === "cancelling"
  ) {
    await sleep(1000);
    const check = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
      { headers },
    );
    if (!check.ok) throw new Error(await check.text());
    run = await check.json();
  }

  if (run.status !== "completed") {
    throw new Error(`Run failed: ${run.status}`);
  }

  const msgRes = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/messages?limit=1`,
    { headers },
  );
  if (!msgRes.ok) throw new Error(await msgRes.text());
  const messages = await msgRes.json();
  const first = messages.data?.[0];
  return first?.content?.[0]?.text?.value || "";
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
    const {
      action,
      question,
      context,
      visionSummary,
      existingOutput,
      feedback,
    } = body;

    let prompt = "";

    if (action === "generate") {
      prompt = `
You are a small animal internal medicine / GP consult assistant.
Give concise reasoning, a ranked differential list, and practical next steps.

Question:
${question || "(none)"}

Case context:
${context || "(none)"}

Vision summary (labs, rads, notes):
${visionSummary || "No images."}
`;
    } else if (action === "refine") {
      prompt = `
Refine the following veterinary consult answer according to user feedback.
Preserve the medical reasoning but adjust tone/length/structure as requested.

Original consult:
${existingOutput || "(none)"}

Question:
${question || "(none)"}

Case context:
${context || "(none)"}

Feedback:
${feedback || "(none)"}
`;
    } else {
      throw new Error("Unknown action");
    }

    const result = await runAssistant(prompt);

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ output: result }),
    };
  } catch (err) {
    console.error("Consult function error:", err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: `Consult error: ${err.message}`,
    };
  }
};
