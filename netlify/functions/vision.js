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
    console.log("Vision stub called with:", body);

    return jsonResponse(200, {
      ok: true,
      message:
        "Vision stub active. Frontend currently passes file names only; binary upload and real OCR/Vision can be wired later.",
    });
  } catch (err) {
    console.error("Vision stub error:", err);
    return jsonResponse(500, { error: "Vision stub failed" });
  }
}
