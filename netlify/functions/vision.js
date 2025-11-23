const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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
    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const body = JSON.parse(event.body || "{}");
    const files = body.files || [];

    if (!files.length) {
      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ summary: "" }),
      };
    }

    const imageContents = files.map((f) => ({
      type: "image_url",
      image_url: {
        url: `data:${f.type || "image/jpeg"};base64,${f.data}`,
      },
    }));

    const res = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a veterinary Vision helper. Summarize attached images (labs, forms, documents, anesthesia sheets) into structured, data-only bullet points that can be used in a SOAP. Do NOT interpret; just list values and findings.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Summarize these images for a vet SOAP helper (data only).",
                },
                ...imageContents,
              ],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vision error: ${text}`);
    }

    const data = await res.json();
    const summary =
      data.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ summary }),
    };
  } catch (err) {
    console.error("Vision function error:", err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: `Vision error: ${err.message}`,
    };
  }
};