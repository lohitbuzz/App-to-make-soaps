// server.js – Moksha SOAP demo backend
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Simple healthcheck
app.get('/health', (req, res) => {
  res.json({ ok: true, version: '1.7.6', service: 'moksha-soap-backend' });
});

// Very simple SOAP generator – this is where you'd call OpenAI in your real app
app.post('/api/soap', (req, res) => {
  const body = req.body || {};
  const visit = body.visitType || 'appointment';
  const mode = body.mode || 'simple';

  const header = `Moksha SOAP – ${visit.toUpperCase()} (${mode})\n`;
  const patientLine = [
    body.patientName || 'Patient',
    body.species || '',
    body.weightKg ? `${body.weightKg} kg` : ''
  ].filter(Boolean).join(' · ');

  const text =
`${header}
Subjective:
${body.coreNotes || '[History not provided]'}

Objective:
${body.peNotes || '[PE/diagnostics data not provided]'}

Assessment:
${body.assessmentHints || '[Assessment hints not provided]'}

Plan:
${body.planHints || '[Plan not provided]'}

Medications dispensed:
[Populate from plan / meds defaults in a future version]

Aftercare:
- Discussed diagnosis and plan with owner.
- Provided written discharge instructions and clinic contact info.
- Advised recheck or sooner if concerns arise.

Notes:
${body.extraNotes || '[No extra notes]'}
`;

  res.json({ text });
});

// Toolbox
app.post('/api/toolbox', (req, res) => {
  const { tool, text } = req.body || {};
  let output;

  switch (tool) {
    case 'bw-summary':
      output = `Bloodwork summary (short):\n\n${text || '[No data pasted]'}`;
      break;
    case 'bw-expanded':
      output = `Bloodwork summary (expanded with differentials):\n\n${text || '[No data pasted]'}`;
      break;
    case 'email-client':
      output =
`Dear Client,

Thank you for bringing your pet in today. Here is a summary of our discussion:

${text || '[Add key findings / recommendations here.]'}

If you have any questions or concerns, please contact us at the clinic.

Sincerely,
Dr. Busanelli`;
      break;
    case 'handout':
      output =
`Client handout / instructions:

Main topic:
${text || '[Describe condition / topic here.]'}

Key points:
- What this means for your pet
- What to watch for at home
- When to contact the clinic
- Follow-up / recheck timing`;
      break;
    default:
      output = text || '[No toolbox text provided]';
  }

  res.json({ text: output });
});

// Consult
app.post('/api/consult', (req, res) => {
  const { question } = req.body || {};
  const text =
`Consult – draft answer

Question:
${question || '[No question provided]'}

Draft response:
- Summarize the main problem.
- List key differentials and recommended diagnostics.
- Outline treatment options and when to escalate or refer.
- Add communication points for the owner.`;

  res.json({ text });
});

// Feedback stub (no storage yet)
app.post('/api/feedback', (req, res) => {
  res.json({ ok: true, message: 'Feedback received (local only, not stored in this demo).' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Moksha SOAP backend listening on port ${PORT}`);
});