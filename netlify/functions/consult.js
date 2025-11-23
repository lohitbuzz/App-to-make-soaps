import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { question = "", files = [] } = body;

    const sys = `
You are a small animal veterinary consultant (Canada).
Give concise, practical answers for GP vets.
You may suggest differentials, diagnostics, treatment options, and client communication tips.
If information is insufficient, say what else you would need.
Do NOT hallucinate guidelines; stay within standard small animal GP practice.
`;

    const user = `
Clinical question:
${question}

Attached items (names only; treat as context but do NOT reference them explicitly):
${files.map((f) => f.name).join(", ")}
`;

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: [{ type: "text", text: sys }] },
        { role: "user", content: [{ type: "text", text: user }] },
      ],
      metadata: { tool: "consult" },
    });

    const text =
      resp.output?.[0]?.content?.[0]?.text?.value ||
      resp.output_text ||
      "";

    return res.json({ text });
  } catch (err) {
    console.error("Consult error:", err);
    return res.status(500).json({ error: err.message || "Consult error" });
  }
}