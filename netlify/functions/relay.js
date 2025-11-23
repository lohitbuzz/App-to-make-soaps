// Basic placeholder: currently just echoes the payload.
// A real cross-device relay would need persistent storage (KV / DB).

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = req.body || {};
    console.log("Relay POST:", body);
    return res.json({ ok: true, echoed: body });
  }

  if (req.method === "GET") {
    return res.json({ ok: true, message: "Relay endpoint placeholder." });
  }

  return res.status(405).json({ error: "Method not allowed" });
}