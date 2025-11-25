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
  if (event.httpMethod === "GET") {
    return jsonResponse(200, {
      ok: true,
      message:
        "Relay stub is alive. This is a safe placeholder for future phone → desktop / QR flows.",
    });
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      console.log("Relay POST payload:", body);
      // Echo back the payload for now
      return jsonResponse(200, {
        ok: true,
        echo: body,
        note: "Relay is currently a simple echo. Case storage / QR routing can be added later.",
      });
    } catch (err) {
      console.error("Relay error:", err);
      return jsonResponse(500, { error: "Relay failed" });
    }
  }

  return jsonResponse(405, { error: "Method not allowed" });
}
