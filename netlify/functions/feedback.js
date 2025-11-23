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
    const message = body.message || "";
    const contact = body.contact || "";

    // For now just log to Netlify; later we can email or store.
    console.log("Moksha SOAP feedback:", { message, contact });

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Feedback function error:", err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: `Feedback error: ${err.message}`,
    };
  }
};