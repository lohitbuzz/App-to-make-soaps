// Lohit SOAP App – front-end logic (Option B)

let currentCaseId = null;
let currentCaseType = 'appointment'; // 'appointment' | 'surgery'
let captureMode = false;

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function makeCaseId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'CS';
  for (let i = 0; i < 5; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

function initCase() {
  const params = new URLSearchParams(window.location.search);
  const urlCase = params.get('caseId');
  const capture = params.get('capture');

  currentCaseId = urlCase || makeCaseId();
  captureMode = capture === '1';

  qs('#caseBadge').textContent = `Case: ${currentCaseId}`;
  if (captureMode) {
    qs('#modeBadge').textContent = 'Mode: Capture from phone';
    document.title = `Capture – ${currentCaseId}`;
  }

  refreshAttachments();
  renderQr();
}

// ---- UI wiring ----

function setCaseType(type) {
  currentCaseType = type;
  qsa('#caseTypeToggle .pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  qs('#modeBadge').textContent =
    type === 'surgery' ? 'Mode: Surgery' : 'Mode: Appointment';
  qs('#surgeryBlock').classList.toggle('hidden', type !== 'surgery');
}

function renderQr() {
  const img = qs('#qrImage');
  if (!img) return;
  const base = window.location.origin;
  const url = `${base}/?caseId=${encodeURIComponent(
    currentCaseId
  )}&capture=1`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    url
  )}`;
  img.src = qrUrl;
}

// ---- Attachments + blur editor ----

let blurState = {
  image: null,
  rects: [],
  drawing: false,
  startX: 0,
  startY: 0
};

const blurModal = qs('#blurModal');
const blurCanvas = qs('#blurCanvas');
let blurCtx = null;

function openBlurModal(dataUrl) {
  blurState.image = new Image();
  blurState.image.onload = () => {
    blurCanvas.width = blurState.image.width;
    blurCanvas.height = blurState.image.height;
    blurCtx = blurCanvas.getContext('2d');
    resetBlurCanvas();
    blurModal.classList.remove('hidden');
  };
  blurState.rects = [];
  blurState.image.src = dataUrl;
}

function resetBlurCanvas() {
  if (!blurCtx || !blurState.image) return;
  blurCtx.drawImage(blurState.image, 0, 0, blurCanvas.width, blurCanvas.height);
  blurCtx.fillStyle = 'rgba(0,0,0,0.75)';
  blurState.rects.forEach((r) => {
    blurCtx.fillRect(r.x, r.y, r.w, r.h);
  });
}

function closeBlurModal() {
  blurModal.classList.add('hidden');
  blurState = { image: null, rects: [], drawing: false, startX: 0, startY: 0 };
}

function handleBlurPointerDown(e) {
  if (!blurCtx) return;
  e.preventDefault();
  const rect = blurCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  blurState.drawing = true;
  blurState.startX = ((clientX - rect.left) * blurCanvas.width) / rect.width;
  blurState.startY = ((clientY - rect.top) * blurCanvas.height) / rect.height;
}

function handleBlurPointerMove(e) {
  if (!blurCtx || !blurState.drawing) return;
  e.preventDefault();
  resetBlurCanvas();
  const rect = blurCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = ((clientX - rect.left) * blurCanvas.width) / rect.width;
  const y = ((clientY - rect.top) * blurCanvas.height) / rect.height;
  const w = x - blurState.startX;
  const h = y - blurState.startY;
  blurCtx.fillStyle = 'rgba(0,0,0,0.8)';
  blurCtx.fillRect(blurState.startX, blurState.startY, w, h);
  blurState.rects.forEach((r) => {
    blurCtx.fillRect(r.x, r.y, r.w, r.h);
  });
}

function handleBlurPointerUp(e) {
  if (!blurCtx || !blurState.drawing) return;
  e.preventDefault();
  blurState.drawing = false;
  const rect = blurCanvas.getBoundingClientRect();
  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  const x = ((clientX - rect.left) * blurCanvas.width) / rect.width;
  const y = ((clientY - rect.top) * blurCanvas.height) / rect.height;
  const w = x - blurState.startX;
  const h = y - blurState.startY;
  blurState.rects.push({ x: blurState.startX, y: blurState.startY, w, h });
  resetBlurCanvas();
}

function wireBlurCanvas() {
  ['mousedown', 'touchstart'].forEach((evt) =>
    blurCanvas.addEventListener(evt, handleBlurPointerDown, { passive: false })
  );
  ['mousemove', 'touchmove'].forEach((evt) =>
    blurCanvas.addEventListener(evt, handleBlurPointerMove, { passive: false })
  );
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((evt) =>
    blurCanvas.addEventListener(evt, handleBlurPointerUp, { passive: false })
  );

  qs('#resetBlur').addEventListener('click', () => {
    blurState.rects = [];
    resetBlurCanvas();
  });
  qs('#cancelBlur').addEventListener('click', () => {
    closeBlurModal();
  });
  qs('#closeModal').addEventListener('click', () => {
    closeBlurModal();
  });

  qs('#saveBlur').addEventListener('click', async () => {
    if (!blurCanvas) return;
    const dataUrl = blurCanvas.toDataURL('image/jpeg', 0.9);
    try {
      const res = await fetch(`/api/cases/${currentCaseId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
      });
      if (!res.ok) throw new Error('Upload failed');
      closeBlurModal();
      refreshAttachments();
    } catch (err) {
      console.error(err);
      alert('Error saving redacted image.');
    }
  });
}

function refreshAttachments() {
  fetch(`/api/cases/${currentCaseId}/attachments`)
    .then((r) => r.json())
    .then((data) => {
      const list = qs('#attachmentsList');
      const empty = qs('#attachmentsEmpty');
      list.innerHTML = '';
      const attachments = data.attachments || [];
      if (!attachments.length) {
        empty.style.display = 'block';
        list.appendChild(empty);
        return;
      }
      empty.style.display = 'none';
      attachments.forEach((att) => {
        const div = document.createElement('div');
        div.className = 'attachment-thumb';
        const img = document.createElement('img');
        img.src = att.dataUrl;
        div.appendChild(img);
        list.appendChild(div);
      });
    })
    .catch((err) => {
      console.error(err);
    });
}

// When user chooses a file (desktop/iPad/phone), open blur modal
function wireFileInput() {
  const input = qs('#desktopFiles');
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      openBlurModal(e.target.result);
    };
    reader.readAsDataURL(file);
    // reset input so they can pick same file again if needed
    input.value = '';
  });
}

// ---- SOAP generation ----

async function generateSoap() {
  qs('#generatorStatus').textContent = 'Generating SOAP…';
  qs('#generatorStatus').style.color = '#e5e7eb';

  const bwRadio = document.querySelector('input[name="bw"]:checked');
  const payload = {
    caseId: currentCaseId,
    mode: currentCaseType,
    species: qs('#species').value,
    profile: qs('#profile').value,
    accuracyMode: qs('#accuracyMode').value,
    caseLabel: qs('#caseLabel').value,
    reason: qs('#reason').value,
    history: qs('#history').value,
    objective: qs('#objective').value,
    diagnostics: qs('#diagnostics').value,
    assessmentNote: qs('#assessmentNote').value,
    planSummary: qs('#planSummary').value,
    surgery: currentCaseType === 'surgery'
      ? {
          template: qs('#surgeryTemplate').value,
          age: qs('#age').value,
          weightKg: qs('#weight').value,
          bloodworkStatus: bwRadio ? bwRadio.value : 'declined',
          bloodworkDetails: qs('#bwDetails').value,
          ivCatheterPlaced: qs('#ivPlaced').checked,
          ivGauge: qs('#ivGauge').value,
          ivSite: qs('#ivSite').value,
          ivSide: qs('#ivSide').value,
          fluidsUsed: qs('#fluidsUsed').checked,
          fluidsDeclined: qs('#fluidsDeclined').checked,
          ownerUnderstandsFluids: qs('#ownerUnderstandsFluids').checked,
          fluidRate: qs('#fluidRate').value,
          premedSummary: qs('#premedSummary').value,
          inductionSummary: qs('#inductionSummary').value,
          intraOpSummary: qs('#intraOpSummary').value,
          postOpInjectables: qs('#postOpInjectables').value,
          takeHomeMeds: qs('#takeHomeMeds').value,
          surgSubjective: qs('#surgSubjective').value,
          surgObjective: qs('#surgObjective').value,
          surgIntraOp: qs('#surgIntraOp').value,
          surgAftercare: qs('#surgAftercare').value
        }
      : null
  };

  try {
    const res = await fetch('/api/generate-soap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generating SOAP');

    const soap = data.soap || {};
    qs('#subjectiveOut').value = soap.subjective || '';
    qs('#objectiveOut').value = soap.objective || '';
    qs('#assessmentOut').value = soap.assessment || '';
    qs('#planOut').value = soap.plan || '';
    qs('#medsOut').value = soap.medications_dispensed || '';
    qs('#aftercareOut').value = soap.aftercare || '';

    qs('#generatorStatus').textContent =
      'SOAP generated. Review before pasting into Avimark.';
    qs('#generatorStatus').style.color = '#6ee7b7';
  } catch (err) {
    console.error(err);
    qs('#generatorStatus').textContent =
      'Error generating SOAP. Check console/logs.';
    qs('#generatorStatus').style.color = '#fca5a5';
  }
}

// ---- Copy helpers ----

function copyFromId(id) {
  const el = qs('#' + id);
  if (!el) return;
  el.select();
  el.setSelectionRange(0, 99999);
  document.execCommand('copy');
}

function wireCopyButtons() {
  qsa('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.copy;
      copyFromId(id);
    });
  });

  qs('#copyFullSoap').addEventListener('click', () => {
    const full =
      'Subjective:\n' +
      qs('#subjectiveOut').value +
      '\n\nObjective:\n' +
      qs('#objectiveOut').value +
      '\n\nAssessment:\n' +
      qs('#assessmentOut').value +
      '\n\nPlan:\n' +
      qs('#planOut').value +
      '\n\nMedications Dispensed:\n' +
      qs('#medsOut').value +
      '\n\nAftercare:\n' +
      qs('#aftercareOut').value;
    navigator.clipboard.writeText(full).catch(() => {
      // fallback
      const tmp = document.createElement('textarea');
      tmp.value = full;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    });
  });

  qs('#copyPlanBundle').addEventListener('click', () => {
    const bundle =
      'Plan:\n' +
      qs('#planOut').value +
      '\n\nMedications Dispensed:\n' +
      qs('#medsOut').value +
      '\n\nAftercare:\n' +
      qs('#aftercareOut').value;
    navigator.clipboard.writeText(bundle).catch(() => {
      const tmp = document.createElement('textarea');
      tmp.value = bundle;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    });
  });
}

// ---- Feedback (local only) ----

function wireFeedback() {
  qs('#saveFeedback').addEventListener('click', () => {
    const txt = qs('#feedbackText').value.trim();
    if (!txt) return;
    const prev =
      JSON.parse(localStorage.getItem('lohitSoapFeedback') || '[]') || [];
    prev.push({ at: new Date().toISOString(), text: txt });
    localStorage.setItem('lohitSoapFeedback', JSON.stringify(prev));
    qs('#feedbackText').value = '';
    alert('Feedback saved locally on this device.');
  });
}

// ---- Init ----

function initEvents() {
  // case type toggle
  qsa('#caseTypeToggle .pill').forEach((btn) => {
    btn.addEventListener('click', () => setCaseType(btn.dataset.type));
  });

  // show QR
  qs('#showQrBtn').addEventListener('click', (e) => {
    e.preventDefault();
    renderQr();
  });

  qs('#refreshAttachments').addEventListener('click', () => {
    refreshAttachments();
  });

  // privacy badge – for now just a visual nudge
  qs('#privacyBadge').addEventListener('click', () => {
    alert(
      'Reminder: Always blur microchips, owner names, phone numbers, addresses, Lab IDs, and any IDs before saving.'
    );
  });

  qs('#generateSoap').addEventListener('click', () => {
    generateSoap();
  });

  wireFileInput();
  wireBlurCanvas();
  wireCopyButtons();
  wireFeedback();
}

document.addEventListener('DOMContentLoaded', () => {
  initCase();
  initEvents();
  setCaseType('appointment');
});