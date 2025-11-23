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
    const body = JSON.parse(event.body || "{}");
    const { text } = body;

    // For now just echo back; future versions can store per-session.
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        received: text || "",
        note: "Relay placeholder – echo only.",
      }),
    };
  } catch (err) {
    console.error("Relay function error:", err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: `Relay error: ${err.message}`,
    };
  }
};