// For now, Vision is handled conceptually in prompts as "files attached (names only)".
// This stub avoids 404 errors if the frontend ever pings /vision directly.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  console.log("Vision stub called with:", body);
  return res.json({
    ok: true,
    message:
      "Vision stub active. Frontend currently passes file names only; binary upload can be wired later.",
  });
}