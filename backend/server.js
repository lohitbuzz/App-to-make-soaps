// server.js - Lohit SOAP App backend v1.7.3

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.send('Lohit SOAP App backend v1.7.3 is running.');
});

// ---------- 1. SOAP / TOOLBOX GENERATE ----------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      error: 'OPENAI_API_KEY is not set on the backend. Add it in Render → Environment.',
    };
  }

  const payload = {
    model: 'gpt-4.1-mini',
    messages,
    temperature: 0.2,
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `OpenAI HTTP ${res.status}: ${txt}` };
    }

    const data = await res.json();
    const content =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!content) {
      return { ok: false, error: 'No content returned from OpenAI.' };
    }

    return { ok: true, content };
  } catch (err) {
    console.error('Error calling OpenAI:', err);
    return { ok: false, error: err.message || String(err) };
  }
}

app.post('/generate', async (req, res) => {
  try {
    const { mode, intake, context } = req.body || {};

    const systemPrompt = `
You are the "Lohit SOAP Brain" for a small animal veterinary clinic.
You generate Avimark-compatible SOAP notes and toolbox text.

Rules:
- Always output plain text, no markdown.
- For SOAP, use headings: Subjective, Objective, Assessment, Plan, Medications Dispensed, Aftercare.
- Plan for surgery: 1) IV Catheter/Fluids 2) Pre-medications 3) Induction/Maintenance 4) Surgical Prep 5) Surgical Procedure 6) Intra-op Medications 7) Recovery 8) Medications Dispensed 9) Aftercare.
- Bloodwork summaries in Objective are data-only; interpretation goes in Assessment.
- Single spacing; blank line only between major sections.
- Keep language clear and client-friendly for discharge/aftercare.

Mode:
- "strict": do not invent missing details; explicitly say when information is not provided.
- "help": you may use safe templated normals and assumptions, but always call out any assumptions in a short "Missing/Assumed" line at the end.
`;

    const userPrompt = `
Mode: ${mode || 'help'}

Context/intake:
${intake || '(no intake text provided)'}

Extra context from UI (optional):
${context || '(none)'}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await callOpenAI(messages);
    if (!result.ok) {
      return res
        .status(500)
        .json({ ok: false, error: result.error || 'Unknown OpenAI error.' });
    }

    res.json({ ok: true, text: result.content });
  } catch (err) {
    console.error('Error in /generate:', err);
    res
      .status(500)
      .json({ ok: false, error: err.message || 'Server error in /generate.' });
  }
});

// ---------- 2. TEXT RELAY (QR text from phone → desktop) ----------

const textRelay = new Map(); // caseId -> { text, createdAt, updatedAt }

app.post('/relay/init-text', (req, res) => {
  const caseId = crypto.randomBytes(6).toString('hex');
  textRelay.set(caseId, { text: '', createdAt: Date.now(), updatedAt: null });
  res.json({ ok: true, caseId });
});

app.post('/relay/text', (req, res) => {
  const { caseId, text } = req.body || {};
  if (!caseId || !textRelay.has(caseId)) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing caseId.' });
  }
  const entry = textRelay.get(caseId);
  entry.text = text || '';
  entry.updatedAt = Date.now();
  textRelay.set(caseId, entry);
  res.json({ ok: true });
});

app.get('/relay/poll-text/:caseId', (req, res) => {
  const { caseId } = req.params;
  if (!caseId || !textRelay.has(caseId)) {
    return res.status(404).json({ ok: false, error: 'caseId not found.' });
  }
  res.json({ ok: true, data: textRelay.get(caseId) });
});

app.post('/relay/clear-text', (req, res) => {
  const { caseId } = req.body || {};
  if (caseId) textRelay.delete(caseId);
  res.json({ ok: true });
});

// Phone page for sending text
app.get('/relay/text-page', (req, res) => {
  const { caseId } = req.query;
  if (!caseId || !textRelay.has(caseId)) {
    return res.status(400).send('Missing or invalid caseId.');
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Send text to desktop</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family:-apple-system,system-ui;font-size:16px;padding:12px;background:#020812;color:#eee;">
  <h2 style="margin-top:0;">Send text to desktop</h2>
  <p>Paste or type anything below, then tap <b>Send</b>. It will appear on the desktop in the main output box.</p>
  <textarea id="txt" style="width:100%;height:240px;border-radius:8px;border:1px solid #444;background:#050b18;color:#eee;padding:8px;"></textarea>
  <button id="sendBtn" style="margin-top:12px;padding:10px 16px;border-radius:999px;border:none;background:#06b6d4;color:#020617;font-weight:600;">Send to desktop</button>
  <p id="status" style="margin-top:8px;color:#9ca3af;"></p>
  <script>
    const caseId = ${JSON.stringify(caseId)};
    const API_BASE = '';

    const txt = document.getElementById('txt');
    const btn = document.getElementById('sendBtn');
    const statusEl = document.getElementById('status');

    btn.addEventListener('click', async () => {
      const text = txt.value.trim();
      if (!text) {
        statusEl.textContent = 'Nothing to send yet.';
        return;
      }
      btn.disabled = true;
      statusEl.textContent = 'Sending...';
      try {
        const res = await fetch(API_BASE + '/relay/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, text }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Error');
        statusEl.textContent = 'Sent ✓ You can close this tab.';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error sending text. Try again.';
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `);
});

// ---------- 3. FILE / IMAGE RELAY with redaction ----------

const fileRelay = new Map(); // caseId -> { dataUrl, mimeType, createdAt, updatedAt }

app.post('/relay/init-file', (req, res) => {
  const caseId = crypto.randomBytes(6).toString('hex');
  fileRelay.set(caseId, {
    dataUrl: '',
    mimeType: '',
    createdAt: Date.now(),
    updatedAt: null,
  });
  res.json({ ok: true, caseId });
});

app.post('/relay/file', (req, res) => {
  const { caseId, dataUrl, mimeType } = req.body || {};
  if (!caseId || !fileRelay.has(caseId)) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing caseId.' });
  }
  if (!dataUrl) {
    return res.status(400).json({ ok: false, error: 'Missing image dataUrl.' });
  }
  const entry = fileRelay.get(caseId);
  entry.dataUrl = dataUrl;
  entry.mimeType = mimeType || 'image/png';
  entry.updatedAt = Date.now();
  fileRelay.set(caseId, entry);
  res.json({ ok: true });
});

app.get('/relay/poll-file/:caseId', (req, res) => {
  const { caseId } = req.params;
  if (!caseId || !fileRelay.has(caseId)) {
    return res.status(404).json({ ok: false, error: 'caseId not found.' });
  }
  res.json({ ok: true, data: fileRelay.get(caseId) });
});

app.post('/relay/clear-file', (req, res) => {
  const { caseId } = req.body || {};
  if (caseId) fileRelay.delete(caseId);
  res.json({ ok: true });
});

// Phone page for upload + rectangle redaction
app.get('/relay/file-page', (req, res) => {
  const { caseId } = req.query;
  if (!caseId || !fileRelay.has(caseId)) {
    return res.status(400).send('Missing or invalid caseId.');
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Send document to desktop</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family:-apple-system,system-ui;font-size:16px;padding:12px;background:#020812;color:#eee;">
  <h2 style="margin-top:0;">Send document to desktop</h2>
  <p>Choose a photo or document, cover client info with black rectangles, then tap <b>Send</b>.</p>
  <input id="fileInput" type="file" accept="image/*" capture="environment" style="margin:8px 0;" />
  <div style="margin-top:8px;">
    <canvas id="canvas" style="max-width:100%;border:1px solid #374151;border-radius:4px;background:#020617;"></canvas>
  </div>
  <div style="margin-top:8px;">
    <button id="resetBtn" style="padding:6px 10px;border-radius:999px;border:none;background:#374151;color:#e5e7eb;">Reset</button>
    <button id="sendBtn" style="padding:8px 14px;border-radius:999px;border:none;background:#06b6d4;color:#020617;font-weight:600;float:right;">Send redacted image</button>
  </div>
  <p id="status" style="margin-top:8px;color:#9ca3af;clear:both;"></p>

  <script>
    const caseId = ${JSON.stringify(caseId)};
    const API_BASE = '';

    const fileInput = document.getElementById('fileInput');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const resetBtn = document.getElementById('resetBtn');
    const sendBtn = document.getElementById('sendBtn');
    const statusEl = document.getElementById('status');

    let originalImage = null;
    let drawing = false;
    let startX = 0, startY = 0;

    function loadImageToCanvas(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          originalImage = img;
          const maxWidth = window.innerWidth - 32;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      loadImageToCanvas(file);
      statusEl.textContent = 'Draw black boxes over names, phone numbers, microchips, etc.';
    });

    function redrawImage() {
      if (!originalImage) return;
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    }

    canvas.addEventListener('mousedown', (e) => {
      if (!originalImage) return;
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!drawing || !originalImage) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      redrawImage();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(startX, startY, x - startX, y - startY);
    });

    canvas.addEventListener('mouseup', (e) => {
      if (!drawing || !originalImage) return;
      drawing = false;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.fillStyle = '#000';
      ctx.fillRect(startX, startY, x - startX, y - startY);
    });

    canvas.addEventListener('mouseleave', () => {
      if (drawing) {
        drawing = false;
        redrawImage();
      }
    });

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      if (!originalImage) return;
      e.preventDefault();
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      startX = t.clientX - rect.left;
      startY = t.clientY - rect.top;
    });

    canvas.addEventListener('touchmove', (e) => {
      if (!drawing || !originalImage) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      redrawImage();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(startX, startY, x - startX, y - startY);
    });

    canvas.addEventListener('touchend', (e) => {
      if (!drawing || !originalImage) return;
      e.preventDefault();
      drawing = false;
      const rect = canvas.getBoundingClientRect();
      const t = e.changedTouches[0];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      ctx.fillStyle = '#000';
      ctx.fillRect(startX, startY, x - startX, y - startY);
    });

    resetBtn.addEventListener('click', () => {
      if (!originalImage) return;
      redrawImage();
      statusEl.textContent = 'Redactions cleared. Draw boxes again.';
    });

    sendBtn.addEventListener('click', async () => {
      if (!originalImage) {
        statusEl.textContent = 'Choose a photo first.';
        return;
      }
      sendBtn.disabled = true;
      statusEl.textContent = 'Preparing image...';
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const res = await fetch(API_BASE + '/relay/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, dataUrl, mimeType: 'image/png' }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Error');
        statusEl.textContent = 'Sent ✓ Check the desktop attachments panel.';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error sending image. Try again.';
      } finally {
        sendBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `);
});

// ---------- START SERVER ----------

app.listen(PORT, () => {
  console.log(`Lohit SOAP app backend running on port ${PORT}`);
});