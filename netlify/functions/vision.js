const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  };
}

exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: "Method not allowed"
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const files = body.files || [];

    const description =
      files.length === 0
        ? "No files attached."
        : `Attached files for this run: ${files
            .map((f) => `${f.name} (${f.type || "unknown type"})`)
            .join(", ")}. Treat this as supporting material when generating the SOAP or email.`;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, visionNotes: description })
    };
  } catch (err) {
    console.error("Vision stub error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
