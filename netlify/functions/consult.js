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

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { question = "", files = [] } = body;

    const fileSummary =
      files && files.length
        ? files.map((f) => `${f.name} (${f.type || "unknown"})`).join(", ")
        : "No files provided";

    const prompt = `
You are a small animal veterinary consultant in Canada.
Give succinct, practical advice for a GP veterinarian working in a busy clinic.

Rules:
- Assume typical Canadian GP practice (limited time, common diagnostics available).
- Provide a brief problem list if appropriate, then a clear, numbered plan.
- Include options (ideal vs "good enough today") when relevant.
- Mention when referral or advanced imaging is strongly recommended.
- If the question is vague, explicitly state what additional information would help.
- When suggesting medications, do NOT provide exact mg/kg doses unless clearly standard;
  focus on drug choices, routes, and general duration.
- Keep tone supportive but concise.

Vet's case/question:
${question || "(no question text provided)"}

Attached files (names only, no images visible):
${fileSummary}

Now provide your consult answer.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a concise, practical small-animal internal medicine/surgery consultant for Canadian GP veterinarians.",
        },
        { role: "user", content: prompt },
      ],
    });

    const answer = completion.choices?.[0]?.message?.content || "";
    return jsonResponse(200, { ok: true, answer });
  } catch (err) {
    console.error("Consult function error:", err);
    return jsonResponse(500, { error: "Failed to generate consult answer" });
  }
}
