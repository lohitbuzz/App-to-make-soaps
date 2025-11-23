// /netlify/functions/relay.js
// Moksha SOAP — Phone → Desktop Relay Engine
// Zero database, ephemeral memory, safe for Netlify Functions

// -------- TEMP SESSION STORE (auto resets on function cold start) -------- //
let sessions = {}; // { sessionId: { text, files } }

export const config = {
  path: "/api/relay",
};

export default async (req) => {
  try {
    const method = req.httpMethod;

    // ---------- 1) GENERATE QR SESSION ID ----------
    if (method === "POST") {
      const body = JSON.parse(req.body || "{}");
      const { action } = body;

      // Create a session token
      if (action === "create") {
        const sessionId = Math.random().toString(36).substring(2, 10);
        sessions[sessionId] = { text: "", files: [] };

        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId,
            qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${sessionId}`,
          }),
        };
      }

      // Phone uploads text/images to the session
      if (action === "send") {
        const { sessionId, text, fileData } = body;

        if (!sessionId || !sessions[sessionId]) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid or expired session ID." }),
          };
        }

        if (text) sessions[sessionId].text += text + "\n";

        if (fileData) {
          sessions[sessionId].files.push(fileData);
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
      }

      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Unknown action." }),
      };
    }

    // ---------- 2) DESKTOP FETCHES CONTENT ----------
    if (method === "GET") {
      const sessionId = req.queryStringParameters?.sessionId;

      if (!sessionId || !sessions[sessionId]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid or expired session ID." }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify(sessions[sessionId]),
      };
    }

    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  } catch (err) {
    console.error("Relay error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
