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

async function refineText(kind, original, feedback, extra = {}) {
  const baseInstr =
    kind === "soap"
      ? "You are refining a veterinary SOAP note for Avimark. Preserve all clinical content and structure; adjust only wording, clarity, and emphasis as requested."
      : kind === "toolbox"
      ? "You are refining a veterinary Toolbox output. Keep the same meaning; adjust tone/length/clarity based on feedback."
      : "You are refining a veterinary consult answer for a GP vet. Preserve meaning; adjust clarity/ordering/tone as requested.";

  const extraContext =
    kind === "soap"
      ? `Mode: ${extra.mode || "general"}`
      : kind === "toolbox"
      ? ""
      : "";

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: baseInstr,
      },
      {
        role: "user",
        content: `
${extraContext}

Original text:
${original}

Requested refinements:
${feedback}

Return the improved version as plain text, same general format as the original.
`,
      },
    ],
  });

  return completion.choices?.[0]?.message?.content || original;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { type } = body || {};

    // App feedback (UX comments)
    if (type === "app-feedback") {
      const { feedback = "", contact = "" } = body;
      console.log("App feedback:", { feedback, contact });
      return jsonResponse(200, { ok: true });
    }

    // SOAP refine
    if (type === "soap-refine") {
      const { original = "", feedback = "", mode = "appointment" } = body;
      const improved = await refineText("soap", original, feedback, { mode });
      return jsonResponse(200, { ok: true, improved });
    }

    // Toolbox refine
    if (type === "toolbox-refine") {
      const { original = "", feedback = "" } = body;
      const improved = await refineText("toolbox", original, feedback);
      return jsonResponse(200, { ok: true, improved });
    }

    // Consult refine
    if (type === "consult-refine") {
      const { original = "", feedback = "" } = body;
      const improved = await refineText("consult", original, feedback);
      return jsonResponse(200, { ok: true, improved });
    }

    return jsonResponse(400, { error: "Unknown feedback type" });
  } catch (err) {
    console.error("Feedback function error:", err);
    return jsonResponse(500, { error: "Failed to handle feedback" });
  }
}
