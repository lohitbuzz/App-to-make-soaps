// Lohit SOAP App v1.5 frontend
// - SOAP-first layout
// - Minimal intake
// - Camera-only phone capture (?capture=1&caseId=...)
// - Manual redaction tool posting data URLs to /api/cases/:caseId/attachments

(function () {
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const urlParams = new URLSearchParams(window.location.search);
  const isCaptureMode = urlParams.get("capture") === "1";
  const caseIdFromUrl = urlParams.get("caseId") || "";
  let currentCaseId = caseIdFromUrl || generateCaseId();

  // Elements shared
  const appMain = qs("#app-main");
  const captureRoot = qs("#capture-mode");

  // Redaction modal elements
  const redactModal = qs("#redactModal");
  const redactCanvas = qs("#redactCanvas");
  const closeRedactBtn = qs("#closeRedactBtn");
  const clearRedactBtn = qs("#clearRedactBtn");
  const saveRedactBtn = qs("#saveRedactBtn");

  let canvasCtx = null;
  let imageObj = null;
  let drawing = false;
  let startX = 0;
  let startY = 0;
  let rectangles = [];
  let pendingImageSource = null; // "desktop" | "capture"

  // Desktop/main elements
  const caseIdLabel = qs("#caseIdLabel");
  const captureCaseIdLabel = qs("#captureCaseIdLabel");

  const modeToggle = qs("#modeToggle");
  const profileToggle = qs("#profileToggle");
  const accuracyToggle = qs("#accuracyToggle");
  const speciesSelect = qs("#speciesSelect");

  const bloodworkChips = qs("#bloodworkChips");
  const fluidChips = qs("#fluidChips");
  const extraFlags = qs("#extraFlags");

  const caseLabelInput = qs("#caseLabelInput");
  const clinicalNotesInput = qs("#clinicalNotesInput");
  const surgeryExtrasInput = qs("#surgeryExtrasInput");
  const surgeryExtrasRow = qs("#surgeryExtrasRow");

  const advancedToggle = qs("#advancedToggle");
  const advancedSection = qs("#advancedSection");

  const generateBtn = qs("#generateBtn");
  const copyFullBtn = qs("#copyFullBtn");
  const copyPlanBtn = qs("#copyPlanBtn");

  const subjectiveOutput = qs("#subjectiveOutput");
  const objectiveOutput = qs("#objectiveOutput");
  const assessmentOutput = qs("#assessmentOutput");
  const planOutput = qs("#planOutput");

  const fileInput = qs("#fileInput");
  const openRedactFromFileBtn = qs("#openRedactFromFileBtn");
  const attachmentsList = qs("#attachmentsList");
  const refreshAttachmentsBtn = qs("#refreshAttachmentsBtn");
  const qrContainer = qs("#qrContainer");
  const toggleQrBtn = qs("#toggleQrBtn");

  // Capture-only elements (phone)
  const captureFileInput = qs("#captureFileInput");
  const openRedactFromCaptureBtn = qs("#openRedactFromCaptureBtn");

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    if (isCaptureMode) {
      initCaptureMode();
    } else {
      initMainMode();
    }
  });

  function generateCaseId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `C-${ts}-${rand}`;
  }

  /* ---------------- MAIN APP MODE ---------------- */

  function initMainMode() {
    appMain.classList.remove("hidden");
    captureRoot.classList.add("hidden");

    if (!caseIdFromUrl) {
      const newUrl = `${window.location.origin}${window.location.pathname}?caseId=${encodeURIComponent(
        currentCaseId
      )}`;
      window.history.replaceState({}, "", newUrl);
    }

    if (caseIdLabel) caseIdLabel.textContent = currentCaseId;

    setupToggles();
    setupAdvancedSection();
    setupSOAPButtons();
    setupCopyMiniButtons();
    setupAttachments();
  }

  function setupToggles() {
    // Mode toggle (appointment vs surgery)
    if (modeToggle) {
      modeToggle.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-mode]");
        if (!btn) return;
        qsa("#modeToggle .pill-option").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");
        updateSurgeryVisibility();
      });
      updateSurgeryVisibility();
    }

    // Profile
    if (profileToggle) {
      profileToggle.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-profile]");
        if (!btn) return;
        qsa("#profileToggle .pill-option").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");
      });
    }

    // Accuracy
    if (accuracyToggle) {
      accuracyToggle.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-accuracy]");
        if (!btn) return;
        qsa("#accuracyToggle .pill-option").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");
      });
    }

    // Bloodwork chips
    if (bloodworkChips) {
      bloodworkChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        qsa("#bloodworkChips .chip").forEach((c) =>
          c.classList.remove("active")
        );
        chip.classList.add("active");
      });
    }

    // Fluids chips
    if (fluidChips) {
      fluidChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        qsa("#fluidChips .chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      });
    }

    // Extra flags
    if (extraFlags) {
      extraFlags.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        chip.classList.toggle("active");
      });
    }
  }

  function updateSurgeryVisibility() {
    const activeModeBtn = qs("#modeToggle .pill-option.active");
    const mode = activeModeBtn?.dataset.mode || "appointment";
    if (mode === "surgery") {
      surgeryExtrasRow?.classList.remove("hidden");
    } else {
      surgeryExtrasRow?.classList.add("hidden");
    }
  }

  function setupAdvancedSection() {
    if (!advancedToggle || !advancedSection) return;
    advancedToggle.addEventListener("click", () => {
      const isHidden = advancedSection.classList.contains("hidden");
      advancedSection.classList.toggle("hidden", !isHidden);
      advancedToggle.textContent = isHidden
        ? "▴ Less options"
        : "▾ More options";
    });
  }

  function setupSOAPButtons() {
    if (generateBtn) {
      generateBtn.addEventListener("click", () => {
        generateSOAP();
      });
    }

    if (copyFullBtn) {
      copyFullBtn.addEventListener("click", () => {
        const fullText = buildFullSOAPString();
        copyToClipboard(fullText);
      });
    }

    if (copyPlanBtn) {
      copyPlanBtn.addEventListener("click", () => {
        copyToClipboard(planOutput.value || "");
      });
    }
  }

  function setupCopyMiniButtons() {
    qsa(".mini-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const el = qs(`#${targetId}`);
        if (!el) return;
        copyToClipboard(el.value || "");
      });
    });
  }

  function buildFullSOAPString() {
    const subj = subjectiveOutput.value || "";
    const obj = objectiveOutput.value || "";
    const assess = assessmentOutput.value || "";
    const plan = planOutput.value || "";

    return [
      "Subjective:",
      subj,
      "",
      "Objective:",
      obj,
      "",
      "Assessment:",
      assess,
      "",
      "Plan (including medications dispensed and aftercare):",
      plan,
    ].join("\n");
  }

  function getActiveToggleValue(containerSel, dataAttr, fallback) {
    const active = qs(`${containerSel} .pill-option.active`);
    return active ? active.dataset[dataAttr] || fallback : fallback;
  }

  function getActiveChipValue(containerSel, dataAttr, fallback) {
    const active = qs(`${containerSel} .chip.active`);
    return active ? active.dataset[dataAttr] || fallback : fallback;
  }

  function getFlagsArray() {
    if (!extraFlags) return [];
    return qsa("#extraFlags .chip.active").map((chip) => chip.dataset.flag);
  }

  async function generateSOAP() {
    const mode = getActiveToggleValue("#modeToggle", "mode", "appointment");
    const profile = getActiveToggleValue(
      "#profileToggle",
      "profile",
      "client"
    );
    const accuracy = getActiveToggleValue(
      "#accuracyToggle",
      "accuracy",
      "medium"
    );
    const species = speciesSelect?.value || "dog";

    const bloodworkStatus = getActiveChipValue(
      "#bloodworkChips",
      "bw",
      "none"
    );
    const fluidsStatus = getActiveChipValue(
      "#fluidChips",
      "fluids",
      "unspecified"
    );

    const flags = getFlagsArray();

    const payload = {
      caseId: currentCaseId,
      caseLabel: caseLabelInput.value || "",
      mode,
      profile,
      accuracy,
      species,
      bloodworkStatus,
      fluidsStatus,
      flags,
      clinicalNotes: clinicalNotesInput.value || "",
      surgeryExtras:
        mode === "surgery" ? surgeryExtrasInput.value || "" : "",
    };

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";

    try {
      const res = await fetch("/api/generate-soap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("SOAP generation error:", errData);
        alert(
          "Error generating SOAP. Check server logs or OpenAI key if this keeps happening."
        );
        return;
      }

      const data = await res.json();
      const soap = data.soap || {};

      subjectiveOutput.value = soap.subjective || "";
      objectiveOutput.value = soap.objective || "";
      assessmentOutput.value = soap.assessment || "";

      // Combine plan + meds + aftercare into one big PLAN box
      const basePlan = (soap.plan || "").trim();
      const meds = (soap.medications_dispensed || "").trim();
      const aftercare = (soap.aftercare || "").trim();

      let combinedPlan = basePlan;
      if (meds) {
        combinedPlan +=
          (combinedPlan ? "\n\n" : "") +
          "Medications Dispensed:\n" +
          meds;
      }
      if (aftercare) {
        combinedPlan +=
          (combinedPlan ? "\n\n" : "") +
          "Aftercare:\n" +
          aftercare;
      }
      planOutput.value = combinedPlan;
    } catch (err) {
      console.error("Error calling /api/generate-soap:", err);
      alert("Network or server error while generating SOAP.");
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate SOAP";
    }
  }

  function copyToClipboard(text) {
    if (!navigator.clipboard) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return;
    }
    navigator.clipboard.writeText(text).catch((err) => {
      console.warn("Clipboard error:", err);
    });
  }

  /* ---------------- ATTACHMENTS & QR ---------------- */

  function setupAttachments() {
    // Show caseId
    if (caseIdLabel) caseIdLabel.textContent = currentCaseId;

    // Initial fetch
    loadAttachments();

    // Refresh
    if (refreshAttachmentsBtn) {
      refreshAttachmentsBtn.addEventListener("click", loadAttachments);
    }

    // QR
    if (toggleQrBtn) {
      toggleQrBtn.addEventListener("click", () => {
        const isHidden = qrContainer.classList.contains("hidden");
        if (isHidden) {
          buildQrCode();
        }
        qrContainer.classList.toggle("hidden", !isHidden);
        toggleQrBtn.textContent = isHidden ? "Hide QR" : "Show QR";
      });
    }

    // Redaction from desktop file
    if (openRedactFromFileBtn && fileInput) {
      openRedactFromFileBtn.addEventListener("click", () => {
        if (!fileInput.files || !fileInput.files[0]) {
          alert("Please choose an image file first.");
          return;
        }
        const file = fileInput.files[0];
        pendingImageSource = "desktop";
        openRedactionForFile(file);
      });
    }

    // Redaction modal controls
    if (closeRedactBtn) {
      closeRedactBtn.addEventListener("click", closeRedactModal);
    }
    if (clearRedactBtn) {
      clearRedactBtn.addEventListener("click", clearRectangles);
    }
    if (saveRedactBtn) {
      saveRedactBtn.addEventListener("click", saveRedactedImage);
    }
  }

  async function loadAttachments() {
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(currentCaseId)}/attachments`);
      if (!res.ok) {
        console.error("Failed to load attachments");
        return;
      }
      const data = await res.json();
      const attachments = data.attachments || [];
      attachmentsList.innerHTML = "";
      attachments.forEach((att) => {
        const img = document.createElement("img");
        img.src = att.dataUrl;
        img.alt = "Attachment";
        attachmentsList.appendChild(img);
      });
    } catch (err) {
      console.error("Error loading attachments:", err);
    }
  }

  function buildQrCode() {
    if (!qrContainer) return;
    qrContainer.innerHTML = "";
    // Same index route, but capture mode
    const captureUrl = `${window.location.origin}${window.location.pathname}?capture=1&caseId=${encodeURIComponent(
      currentCaseId
    )}`;
    new QRCode(qrContainer, {
      text: captureUrl,
      width: 120,
      height: 120,
      correctLevel: QRCode.CorrectLevel.L,
    });
  }

  /* ---------------- CAPTURE MODE (PHONE) ---------------- */

  function initCaptureMode() {
    captureRoot.classList.remove("hidden");
    appMain.classList.add("hidden");

    if (!caseIdFromUrl) {
      const newUrl = `${window.location.origin}${window.location.pathname}?capture=1&caseId=${encodeURIComponent(
        currentCaseId
      )}`;
      window.history.replaceState({}, "", newUrl);
    }

    if (captureCaseIdLabel) captureCaseIdLabel.textContent = currentCaseId;

    // Capture redaction
    if (openRedactFromCaptureBtn && captureFileInput) {
      openRedactFromCaptureBtn.addEventListener("click", () => {
        if (!captureFileInput.files || !captureFileInput.files[0]) {
          alert("Take or choose a photo first.");
          return;
        }
        const file = captureFileInput.files[0];
        pendingImageSource = "capture";
        openRedactionForFile(file);
      });
    }

    // Redaction modal controls shared
    if (closeRedactBtn) {
      closeRedactBtn.addEventListener("click", closeRedactModal);
    }
    if (clearRedactBtn) {
      clearRedactBtn.addEventListener("click", clearRectangles);
    }
    if (saveRedactBtn) {
      saveRedactBtn.addEventListener("click", saveRedactedImage);
    }
  }

  /* ---------------- REDACTION CANVAS ---------------- */

  function openRedactionForFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target.result;
      imageObj = new Image();
      imageObj.onload = () => {
        showRedactModal();
        initCanvasWithImage(imageObj);
      };
      imageObj.src = imgSrc;
    };
    reader.readAsDataURL(file);
  }

  function showRedactModal() {
    if (!redactModal) return;
    redactModal.classList.remove("hidden");
    if (!canvasCtx) {
      canvasCtx = redactCanvas.getContext("2d");
      setupCanvasEvents();
    }
    rectangles = [];
  }

  function closeRedactModal() {
    if (!redactModal) return;
    redactModal.classList.add("hidden");
    rectangles = [];
    imageObj = null;

    if (pendingImageSource === "desktop" && fileInput) {
      fileInput.value = "";
    }
    if (pendingImageSource === "capture" && captureFileInput) {
      captureFileInput.value = "";
    }
    pendingImageSource = null;
  }

  function initCanvasWithImage(img) {
    if (!redactCanvas || !canvasCtx) return;
    // Fit image into canvas while preserving aspect ratio
    const maxWidth = redactModal
      ? redactModal.querySelector(".modal-body").clientWidth - 16
      : window.innerWidth - 40;
    const maxHeight = window.innerHeight * 0.6;

    let drawWidth = img.width;
    let drawHeight = img.height;
    const widthRatio = maxWidth / img.width;
    const heightRatio = maxHeight / img.height;
    const scale = Math.min(widthRatio, heightRatio, 1);

    drawWidth = img.width * scale;
    drawHeight = img.height * scale;

    redactCanvas.width = drawWidth;
    redactCanvas.height = drawHeight;

    canvasCtx.clearRect(0, 0, drawWidth, drawHeight);
    canvasCtx.drawImage(img, 0, 0, drawWidth, drawHeight);
  }

  function setupCanvasEvents() {
    const startDraw = (clientX, clientY) => {
      const rect = redactCanvas.getBoundingClientRect();
      startX = clientX - rect.left;
      startY = clientY - rect.top;
      drawing = true;
    };

    const moveDraw = (clientX, clientY) => {
      if (!drawing || !imageObj) return;
      const rect = redactCanvas.getBoundingClientRect();
      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top;
      redrawCanvasWithRect(currentX, currentY);
    };

    const endDraw = (clientX, clientY) => {
      if (!drawing || !imageObj) return;
      drawing = false;
      const rect = redactCanvas.getBoundingClientRect();
      const endX = clientX - rect.left;
      const endY = clientY - rect.top;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);
      if (w > 4 && h > 4) {
        rectangles.push({ x, y, w, h });
        redrawCanvasBase();
        drawAllRectangles();
      }
    };

    redactCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startDraw(e.clientX, e.clientY);
    });
    redactCanvas.addEventListener("mousemove", (e) => {
      e.preventDefault();
      moveDraw(e.clientX, e.clientY);
    });
    redactCanvas.addEventListener("mouseup", (e) => {
      e.preventDefault();
      endDraw(e.clientX, e.clientY);
    });
    redactCanvas.addEventListener("mouseleave", (e) => {
      if (drawing) {
        e.preventDefault();
        drawing = false;
        redrawCanvasBase();
        drawAllRectangles();
      }
    });

    // Touch support
    redactCanvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        startDraw(touch.clientX, touch.clientY);
      },
      { passive: false }
    );
    redactCanvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        moveDraw(touch.clientX, touch.clientY);
      },
      { passive: false }
    );
    redactCanvas.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        endDraw(touch.clientX, touch.clientY);
      },
      { passive: false }
    );
  }

  function redrawCanvasBase() {
    if (!canvasCtx || !imageObj) return;
    canvasCtx.clearRect(0, 0, redactCanvas.width, redactCanvas.height);
    canvasCtx.drawImage(
      imageObj,
      0,
      0,
      redactCanvas.width,
      redactCanvas.height
    );
  }

  function drawAllRectangles() {
    if (!canvasCtx) return;
    canvasCtx.fillStyle = "#000000";
    rectangles.forEach((r) => {
      canvasCtx.fillRect(r.x, r.y, r.w, r.h);
    });
  }

  function redrawCanvasWithRect(currentX, currentY) {
    redrawCanvasBase();
    drawAllRectangles();

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    canvasCtx.fillStyle = "rgba(15, 23, 42, 0.4)";
    canvasCtx.fillRect(x, y, w, h);
  }

  function clearRectangles() {
    rectangles = [];
    if (imageObj) {
      redrawCanvasBase();
    }
  }

  async function saveRedactedImage() {
    if (!canvasCtx) return;
    const dataUrl = redactCanvas.toDataURL("image/png");

    try {
      const res = await fetch(
        `/api/cases/${encodeURIComponent(currentCaseId)}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Error saving redacted image:", errData);
        alert("Error saving redacted image.");
        return;
      }
      if (!isCaptureMode) {
        await loadAttachments();
      }
      closeRedactModal();
    } catch (err) {
      console.error("Error saving redacted image:", err);
      alert("Network or server error while saving image.");
    }
  }
})();