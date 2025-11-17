// app.js

// ====== Config ======
const API_ENDPOINT = '/generate'; // adjust if your server.js uses a different route

// ====== DOM helpers ======
const $ = (id) => document.getElementById(id);

// Tabs and sections
const tabButtons = document.querySelectorAll('.tab');
const sections = {
  appointmentSection: $('appointmentSection'),
  surgerySection: $('surgerySection'),
  consultSection: $('consultSection'),
  toolboxSection: $('toolboxSection'),
};

// Shared bits
const statusText = $('statusText');
const modeSelect = $('modeSelect');
const caseLabelInput = $('caseLabel');

// Appointment inputs
const appointmentReason = $('appointmentReason');
const appointmentTpr = $('appointmentTpr');
const appointmentHistory = $('appointmentHistory');
const appointmentPe = $('appointmentPe');
const appointmentDiagnostics = $('appointmentDiagnostics');
const appointmentAssessment = $('appointmentAssessment');
const appointmentPlan = $('appointmentPlan');
const appointmentMeds = $('appointmentMeds');
const appointmentAttachments = $('appointmentAttachments');
const generateAppointmentBtn = $('generateAppointmentBtn');

// Surgery inputs
const surgeryTemplate = $('surgeryTemplate');
const surgeryTemplateDescription = $('surgeryTemplateDescription');
const asaStatus = $('asaStatus');
const ivCatheter = $('ivCatheter');
const etTube = $('etTube');
const fluidRate = $('fluidRate');
const fluidsDeclined = $('fluidsDeclined');
const premedications = $('premedications');
const induction = $('induction');
const intraopMeds = $('intraopMeds');
const procedureNotes = $('procedureNotes');
const tprNotes = $('tprNotes');
const durationNotes = $('durationNotes');
const monocryl0 = $('monocryl0');
const monocryl2_0 = $('monocryl2_0');
const monocryl3_0 = $('monocryl3_0');
const surgeryAttachments = $('surgeryAttachments');
const generateSurgeryBtn = $('generateSurgeryBtn');

// Consult
const consultAttachments = $('consultAttachments');
const consultInput = $('consultInput');
const consultOutput = $('consultOutput');
const runConsultBtn = $('runConsultBtn');

// Toolbox Lite
const toolboxAttachments = $('toolboxAttachments');
const toolboxLabText = $('toolboxLabText');
const toolboxDetailLevel = $('toolboxDetailLevel');
const toolboxIncludeDifferentials = $('toolboxIncludeDifferentials');
const toolboxClientSummary = $('toolboxClientSummary');
const runBloodworkHelperBtn = $('runBloodworkHelperBtn');
const toolboxBloodworkOutput = $('toolboxBloodworkOutput');

// SOAP output
const subjectiveOutput = $('subjectiveOutput');
const objectiveOutput = $('objectiveOutput');
const assessmentOutput = $('assessmentOutput');
const planOutput = $('planOutput');
const medsOutput = $('medsOutput');
const aftercareOutput = $('aftercareOutput');

// Copy buttons
const copySubjectiveBtn = $('copySubjectiveBtn');
const copyObjectiveBtn = $('copyObjectiveBtn');
const copyAssessmentBtn = $('copyAssessmentBtn');
const copyPlanBtn = $('copyPlanBtn');
const copyMedsBtn = $('copyMedsBtn');
const copyAftercareBtn = $('copyAftercareBtn');
const copyFullSoapBtn = $('copyFullSoapBtn');
const copyPlanMedsAftercareBtn = $('copyPlanMedsAftercareBtn');

// Mic button
const micButton = $('micButton');

// QR container
const qrContainer = $('qrContainer');

// Track last-focused text input for mic dictation
let lastFocusedEditable = null;

// ====== Utility functions ======

function setStatus(msg) {
  statusText.textContent = msg;
}

function getMode() {
  return modeSelect.value || 'helpMe';
}

function getCaseLabel() {
  return caseLabelInput.value || '';
}

function getFileNames(inputEl) {
  if (!inputEl || !inputEl.files) return [];
  return Array.from(inputEl.files).map((f) => f.name);
}

async function callBackend(payload) {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server error ${res.status}: ${text}`);
    }

    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function fillSoapOutputs(data) {
  subjectiveOutput.value = data.subjective || '';
  objectiveOutput.value = data.objective || '';
  assessmentOutput.value = data.assessment || '';
  planOutput.value = data.plan || '';
  medsOutput.value = data.medsDispensed || data.meds || '';
  aftercareOutput.value = data.aftercare || '';
}

async function handleCopy(text) {
  try {
    await navigator.clipboard.writeText(text || '');
  } catch (err) {
    console.error('Clipboard error', err);
  }
}

// ====== Tab switching ======

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-tab');
    if (!targetId) return;

    // activate tab button
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // show/hide sections
    Object.entries(sections).forEach(([id, el]) => {
      if (id === targetId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  });
});

// ====== QR code ======

function initQr() {
  if (!qrContainer) return;
  // clear existing
  qrContainer.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(qrContainer, {
    text: window.location.href,
    width: 180,
    height: 180,
  });
}

// ====== Surgery template descriptions ======

const surgeryTemplateDescriptions = {
  canine_neuter_clinic:
    'Prescrotal neuter; default 2-0 Monocryl (<35 kg) or 0 Monocryl (>35 kg) unless overridden.',
  canine_neuter_rescue:
    'Rescue canine neuter using clinic rescue protocol; default 2-0 Monocryl (<35 kg) or 0 Monocryl (>35 kg).',
  canine_spay_clinic:
    'Ovariohysterectomy per clinic protocol; default 2-0 Monocryl for linea/body wall, 3-0 skin/intradermal.',
  canine_spay_rescue:
    'Rescue spay protocol with clinic standard closure and analgesia.',
  feline_neuter:
    'Standard scrotal feline neuter, typically 3-0 or 4-0 absorbable ligatures per clinic protocol.',
  feline_spay:
    'Feline OHE per clinic protocol; small patient, default 3-0 Monocryl, simple continuous fascia, intradermal skin.',
  dental_cohat_rads:
    'Full COHAT with dental radiographs and local blocks; AAHA/AVDC extraction standards.',
  dental_cohat_no_rads:
    'COHAT without radiographs; note rads declined or unavailable in SOAP.',
  mass_removal_skin:
    'Skin/SQ mass removal; include location, size, margins, and histopath submission details.',
  pyometra_spay:
    'OVH for suspected/confirmed pyometra with supportive care and broad-spectrum antibiotics per protocol.',
  exploratory_laparotomy:
    'Full abdominal exploratory; document organs inspected, biopsies, and any additional procedures.',
  enterotomy:
    'Enterotomy for foreign body or intestinal lesion; record location, contents, and closure pattern.',
  gastrotomy:
    'Gastrotomy for foreign body; note location, contents removed, and leak testing.',
  gastropexy:
    'Gastropexy (prophylactic or emergency); record technique and side.',
  cystotomy:
    'Cystotomy for uroliths or masses; record stone type if known and culture details.',
  feline_unblock:
    'Feline urethral obstruction; note sedation/anesthesia, catheter type, and post-obstructive monitoring.',
  other_custom: 'Custom surgery; add key details and closure notes in Procedure notes.',
};

function updateSurgeryDescription() {
  const key = surgeryTemplate.value;
  const desc = surgeryTemplateDescriptions[key] || surgeryTemplateDescriptions.canine_neuter_clinic;
  surgeryTemplateDescription.textContent = desc;
}

if (surgeryTemplate) {
  surgeryTemplate.addEventListener('change', updateSurgeryDescription);
  // init
  updateSurgeryDescription();
}

// Fluids declined → disable rate
if (fluidsDeclined) {
  fluidsDeclined.addEventListener('change', () => {
    if (fluidsDeclined.checked) {
      fluidRate.value = '';
      fluidRate.disabled = true;
    } else {
      fluidRate.disabled = false;
    }
  });
}

// ====== Appointment generation ======

if (generateAppointmentBtn) {
  generateAppointmentBtn.addEventListener('click', async () => {
    setStatus('Generating appointment SOAP…');

    const payload = {
      type: 'appointment',
      mode: getMode(),
      caseLabel: getCaseLabel(),
      reason: appointmentReason.value,
      tpr: appointmentTpr.value,
      history: appointmentHistory.value,
      physicalExam: appointmentPe.value,
      diagnostics: appointmentDiagnostics.value,
      assessment: appointmentAssessment.value,
      plan: appointmentPlan.value,
      medsDispensed: appointmentMeds.value,
      attachments: getFileNames(appointmentAttachments),
    };

    try {
      const data = await callBackend(payload);
      fillSoapOutputs(data);
      setStatus('Appointment SOAP ready.');
    } catch (err) {
      setStatus(`Error generating appointment SOAP: ${err.message}`);
    }
  });
}

// ====== Surgery generation ======

if (generateSurgeryBtn) {
  generateSurgeryBtn.addEventListener('click', async () => {
    setStatus('Generating surgery SOAP…');

    const payload = {
      type: 'surgery',
      mode: getMode(),
      caseLabel: getCaseLabel(),
      surgeryTemplate: surgeryTemplate.value,
      asaStatus: asaStatus.value,
      ivCatheter: ivCatheter.value,
      etTube: etTube.value,
      fluidRate: fluidsDeclined.checked ? '' : fluidRate.value,
      fluidsDeclined: fluidsDeclined.checked,
      premedications: premedications.value,
      induction: induction.value,
      intraopMeds: intraopMeds.value,
      procedureNotes: procedureNotes.value,
      tprNotes: tprNotes.value,
      durationNotes: durationNotes.value,
      monocrylOverrides: {
        monocryl0: monocryl0.checked,
        monocryl2_0: monocryl2_0.checked,
        monocryl3_0: monocryl3_0.checked,
      },
      attachments: getFileNames(surgeryAttachments),
    };

    try {
      const data = await callBackend(payload);
      fillSoapOutputs(data);
      setStatus('Surgery SOAP ready.');
    } catch (err) {
      setStatus(`Error generating surgery SOAP: ${err.message}`);
    }
  });
}

// ====== Consult ======

if (runConsultBtn) {
  runConsultBtn.addEventListener('click', async () => {
    setStatus('Running consult…');

    const payload = {
      type: 'consult',
      mode: getMode(),
      caseLabel: getCaseLabel(),
      prompt: consultInput.value,
      attachments: getFileNames(consultAttachments),
    };

    try {
      const data = await callBackend(payload);
      consultOutput.value = data.output || '';
      setStatus('Consult output ready.');
    } catch (err) {
      setStatus(`Error running consult: ${err.message}`);
    }
  });
}

// ====== Toolbox Lite – Bloodwork Helper ======

if (runBloodworkHelperBtn) {
  runBloodworkHelperBtn.addEventListener('click', async () => {
    setStatus('Running Bloodwork Helper Lite…');

    const payload = {
      type: 'toolbox_bloodwork',
      mode: getMode(),
      caseLabel: getCaseLabel(),
      labText: toolboxLabText.value,
      detailLevel: toolboxDetailLevel.value,
      includeDifferentials: toolboxIncludeDifferentials.checked,
      clientSummary: toolboxClientSummary.checked,
      attachments: getFileNames(toolboxAttachments),
    };

    try {
      const data = await callBackend(payload);
      toolboxBloodworkOutput.value = data.output || '';
      setStatus('Bloodwork Helper output ready.');
    } catch (err) {
      setStatus(`Error running Bloodwork Helper: ${err.message}`);
    }
  });
}

// ====== Copy handlers ======

if (copySubjectiveBtn) {
  copySubjectiveBtn.addEventListener('click', () =>
    handleCopy(subjectiveOutput.value)
  );
}
if (copyObjectiveBtn) {
  copyObjectiveBtn.addEventListener('click', () =>
    handleCopy(objectiveOutput.value)
  );
}
if (copyAssessmentBtn) {
  copyAssessmentBtn.addEventListener('click', () =>
    handleCopy(assessmentOutput.value)
  );
}
if (copyPlanBtn) {
  copyPlanBtn.addEventListener('click', () => handleCopy(planOutput.value));
}
if (copyMedsBtn) {
  copyMedsBtn.addEventListener('click', () => handleCopy(medsOutput.value));
}
if (copyAftercareBtn) {
  copyAftercareBtn.addEventListener('click', () =>
    handleCopy(aftercareOutput.value)
  );
}

if (copyFullSoapBtn) {
  copyFullSoapBtn.addEventListener('click', () => {
    const text = [
      'Subjective:',
      subjectiveOutput.value,
      '',
      'Objective:',
      objectiveOutput.value,
      '',
      'Assessment:',
      assessmentOutput.value,
      '',
      'Plan:',
      planOutput.value,
      '',
      'Medications Dispensed:',
      medsOutput.value,
      '',
      'Aftercare:',
      aftercareOutput.value,
    ].join('\n');
    handleCopy(text);
  });
}

if (copyPlanMedsAftercareBtn) {
  copyPlanMedsAftercareBtn.addEventListener('click', () => {
    const text = [
      'Plan:',
      planOutput.value,
      '',
      'Medications Dispensed:',
      medsOutput.value,
      '',
      'Aftercare:',
      aftercareOutput.value,
    ].join('\n');
    handleCopy(text);
  });
}

// ====== Mic / speech-to-text ======

function initMic() {
  if (!micButton) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micButton.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let listening = false;

  micButton.addEventListener('click', () => {
    if (!listening) {
      try {
        recognition.start();
        listening = true;
        micButton.classList.add('listening');
      } catch (err) {
        console.error('Speech start error', err);
      }
    } else {
      recognition.stop();
      listening = false;
      micButton.classList.remove('listening');
    }
  });

  recognition.addEventListener('result', (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join(' ');

    const target =
      lastFocusedEditable ||
      appointmentHistory ||
      consultInput ||
      toolboxLabText;

    if (target) {
      const current = target.value || '';
      target.value = current ? current + ' ' + transcript : transcript;
    }
  });

  recognition.addEventListener('end', () => {
    listening = false;
    micButton.classList.remove('listening');
  });
}

// Track focus for mic
function initFocusTracking() {
  const selectors = 'textarea, input[type="text"]';
  document.querySelectorAll(selectors).forEach((el) => {
    el.addEventListener('focus', () => {
      lastFocusedEditable = el;
    });
  });
}

// ====== Init ======

document.addEventListener('DOMContentLoaded', () => {
  initQr();
  initMic();
  initFocusTracking();
  setStatus('Ready.');
});