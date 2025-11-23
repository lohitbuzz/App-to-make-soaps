import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { mode } = body;

    if (mode === "soap-refine") {
      const { originalSoap, feedback } = body;
      const text = await refineSoap(originalSoap, feedback);
      return res.json({ soap: text });
    }

    if (mode === "consult-refine") {
      const { original, feedback } = body;
      const text = await refineConsult(original, feedback);
      return res.json({ text });
    }

    if (mode === "voice") {
      // For now just acknowledge receipt of transcript
      const { transcript, context } = body;
      console.log("Voice feedback:", context, transcript?.slice(0, 200));
      return res.json({ ok: true, message: "Transcript received." });
    }

    return res.status(400).json({ error: "Invalid feedback mode" });
  } catch (err) {
    console.error("Feedback error:", err);
    return res.status(500).json({ error: err.message || "Feedback error" });
  }
}

async function refineSoap(original, feedback) {
  const sys = `
You refine existing veterinary SOAPs.
Preserve clinical meaning; apply the user's feedback.
Maintain Avimark-compatible formatting and the clinic's SOAP rules.
`;

  const user = `
Original SOAP:
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
    metadata: { tool: "feedback-soap" },
  });

  return (
    resp.output?.[0]?.content?.[0]?.text?.value ||
    resp.output_text ||
    ""
  );
}

async function refineConsult(original, feedback) {
  const sys = `
You refine existing veterinary consult answers.
Preserve medical content, adjust clarity/tone/length based on the request.
`;

  const user = `
Original answer:
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
    metadata: { tool: "feedback-consult" },
  });

  return (
    resp.output?.[0]?.content?.[0]?.text?.value ||
    resp.output_text ||
    ""
  );
}