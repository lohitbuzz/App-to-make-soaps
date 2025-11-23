import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { mode } = body;

    if (mode === "transform") {
      const { transformType, originalSoap } = body;
      const text = await runTransform(transformType, originalSoap);
      return res.json({ text });
    }

    if (mode === "toolbox-refine") {
      const { original, feedback, toolboxMode } = body;
      const text = await runToolboxRefine(original, feedback, toolboxMode);
      return res.json({ text });
    }

    if (mode === "toolbox-main") {
      const { toolboxMode, text, files = [] } = body;
      const out = await runToolboxMain(toolboxMode, text, files);
      return res.json({ text: out });
    }

    return res.status(400).json({ error: "Invalid toolbox mode" });
  } catch (err) {
    console.error("Toolbox error:", err);
    return res.status(500).json({ error: err.message || "Toolbox error" });
  }
}

async function runTransform(transformType, originalSoap) {
  const sys = `
You are a post-processor for veterinary SOAP notes. Keep all medical content accurate.
Transform according to the requested mode (email, summary, client handout, planOnly, rephrase).
Do NOT invent new findings; just reformat and adjust tone/length as requested.
`;

  const user = `
Transform this SOAP according to mode="${transformType}":

${originalSoap}
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: [{ type: "text", text: sys }] },
      { role: "user", content: [{ type: "text", text: user }] },
    ],
    metadata: { tool: "toolbox-transform", transformType },
  });

  return (
    resp.output?.[0]?.content?.[0]?.text?.value ||
    resp.output_text ||
    ""
  );
}

async function runToolboxMain(toolboxMode, text, files) {
  const sys = `
You are the Moksha SOAP Toolbox assistant.
You can:
- Summarize bloodwork (Bloodwork Summary mode).
- Interpret labwork (Lab Interpretation).
- Draft client emails (Email Helper).
- Create weight consult handouts (Weight Tool).
- Handle free-form requests.

Use concise, Avimark-friendly formatting when appropriate.
Do NOT mention Vision or files by name; treat them as context only.
`;

  const user = `
Toolbox mode: ${toolboxMode}
User text: ${text || "(none)"}
Attached files (names only): ${files.map((f) => f.name).join(", ")}

If mode is:
- "bloodwork": summarize abnormalities + brief assessment + plan.
- "lab": interpret in more depth but still concise.
- "email": draft a client-facing email for this medical situation.
- "weight": create a weight consult/maintenance handout matching the clinic's style.
- "free": do exactly what the user asked in a clinic-appropriate way.
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: [{ type: "text", text: sys }] },
      { role: "user", content: [{ type: "text", text: user }] },
    ],
    metadata: { tool: "toolbox-main", toolboxMode },
  });

  return (
    resp.output?.[0]?.content?.[0]?.text?.value ||
    resp.output_text ||
    ""
  );
}

async function runToolboxRefine(original, feedback, toolboxMode) {
  const sys = `
You are refining an existing Toolbox output for a veterinary clinic.
Preserve medical accuracy; adjust tone/length/structure according to feedback.
`;

  const user = `
Toolbox mode: ${toolboxMode}
Original output:
${original}

Refinement request:
${feedback}
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: [{ type: "text", text: sys }] },
      { role: "user", content: [{ type: "text", text: user }] },
    ],
    metadata: { tool: "toolbox-refine", toolboxMode },
  });

  return (
    resp.output?.[0]?.content?.[0]?.text?.value ||
    resp.output_text ||
    ""
  );
}