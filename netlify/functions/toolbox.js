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

  if (!threadRes.ok) {
    throw new Error(await threadRes.text());
  }
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
    const { action, tool, text, visionSummary, existingOutput, feedback } =
      body;

    let prompt = "";

    if (action === "generate") {
      if (tool === "bloodwork") {
        prompt = `
You are the Moksha Bloodwork Helper Lite.
Make a concise vet-level summary (and short assessment) of this bloodwork and any vision data.
Do NOT create a full SOAP; just output a short/standard explanation a vet can paste.

Text / labs:
${text || "(none)"}

Vision summary:
${visionSummary || "No images."}
`;
      } else if (tool === "email") {
        prompt = `
You are helping write a client-facing email in small animal practice.
Use clear, friendly language. Keep it suitable to paste into an email.

Context:
${text || "(none)"}

Vision summary (labs, rads, etc.):
${visionSummary || "No images."}
`;
      } else if (tool === "weight") {
        prompt = `
You are generating a weight consult / weight maintenance handout following the clinic's Wonton template style.
Create a client handout that the vet can paste into Avimark.

Clinical notes:
${text || "(none)"}

Vision summary (if any body weight logs were in images):
${visionSummary || "No images."}
`;
      } else if (tool === "handout") {
        prompt = `
You turn dense vet text into a clean, bullet-point client handout.
Use headings, short paragraphs, and clear language.

Source text:
${text || "(none)"}

Vision summary:
${visionSummary || "No images."}
`;
      } else {
        // free-form
        prompt = `
You are a flexible vet toolbox helper. Respond to the following request in a way that a small animal vet clinic can paste into Avimark.

User request:
${text || "(none)"}

Vision summary:
${visionSummary || "No images."}
`;
      }
    } else if (action === "refine") {
      prompt = `
Refine the following toolbox output according to the user's feedback.
Keep the intent and clinical content the same, but improve clarity and formatting.

Existing output:
${existingOutput || "(none)"}

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
    console.error("Toolbox function error:", err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: `Toolbox error: ${err.message}`,
    };
  }
};
