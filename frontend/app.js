// Netlify function endpoints
const SOAP_URL = "/.netlify/functions/soap";
const VISION_URL = "/.netlify/functions/vision";
const FEEDBACK_URL = "/.netlify/functions/feedback";

document.addEventListener("DOMContentLoaded", () => {
  // ---------- BASIC ELEMENTS ----------
  const tabButtons = document.querySelectorAll(".top-tab-btn");
  const soapSection = document.getElementById("soap-section");
  const toolboxSection = document.getElementById("toolbox-section");
  const consultSection = document.getElementById("consult-section");

  const outputPanelTitle = document.getElementById("outputPanelTitle");
  const outputPanelChip = document.getElementById("outputPanelChip");
  const mainOutput = document.getElementById("mainOutput");

  const outputButtonsSoap = document.getElementById("outputButtonsSoap");
  const outputButtonsToolbox = document.getElementById("outputButtonsToolbox");
  const outputButtonsConsult = document.getElementById("outputButtonsConsult");

  const feedbackInput = document.getElementById("feedbackInput");
  const feedbackImproveBtn = document.getElementById("feedbackImproveBtn");

  const backendStatusDot = document.getElementById("backendStatusDot");
  const backendStatusText = document.getElementById("backendStatusText");

  const attachFilesBtn = document.getElementById("attachFilesBtn");
  const attachmentsInput = document.getElementById("attachmentsInput");
  const attachmentsPreview = document.getElementById("attachmentsPreview");

  let currentTab = "soap";

  // ---------- ATTACHMENTS (VISION) ----------
  function describeStatus(text, isError = false) {
    outputPanelChip.textContent = text;
    if (backendStatusDot) {
      backendStatusDot.style.background = isError ? "#f15f72" : "#3ee88a";
      backendStatusText.textContent = isError ? "Backend error" : "Backend reachable";
    }
  }

  async function pingBackend() {
    try {
      // lightweight ping via HEAD
      await fetch(SOAP_URL, { method: "HEAD" });
      backendStatusDot.style.background = "#3ee88a";
      backendStatusText.textContent = "Backend reachable";
    } catch (e) {
      backendStatusDot.style.background = "#f15f72";
      backendStatusText.textContent = "Backend unreachable (check Netlify)";
    }
  }
  pingBackend();

  if (attachFilesBtn && attachmentsInput && attachmentsPreview) {
    attachFilesBtn.addEventListener("click", () => attachmentsInput.click());
    attachmentsInput.addEventListener("change", () => {
      if (!attachmentsInput.files || attachmentsInput.files.length === 0) {
        attachmentsPreview.textContent = "No files attached yet.";
        return;
      }
      const names = Array.from(attachmentsInput.files).map((f) => f.name);
      attachmentsPreview.textContent = "Attached: " + names.join(", ");
    });
  }

  function readAttachmentsAsDataUrls() {
    if (!attachmentsInput || !attachmentsInput.files || attachmentsInput.files.length === 0) {
      return Promise.resolve([]);
    }
    const files = Array.from(attachmentsInput.files);
    const promises = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              type: file.type,
              data: reader.result, // data URL
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );
    return Promise.all(promises);
  }

  // ---------- TABS ----------
  function showTab(tab) {
    currentTab = tab;
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    soapSection.classList.toggle("hidden", tab !== "soap");
    toolboxSection.classList.toggle("hidden", tab !== "toolbox");
    consultSection.classList.toggle("hidden", tab !== "consult");

    if (tab === "soap") {
      outputPanelTitle.textContent = "OUTPUT · AI BRAIN – SOAP";
      outputButtonsSoap.classList.remove("hidden");
      outputButtonsToolbox.classList.add("hidden");
      outputButtonsConsult.classList.add("hidden");
    } else if (tab === "toolbox") {
      outputPanelTitle.textContent = "OUTPUT · AI BRAIN – TOOLBOX";
      outputButtonsSoap.classList.add("hidden");
      outputButtonsToolbox.classList.remove("hidden");
      outputButtonsConsult.classList.add("hidden");
    } else {
      outputPanelTitle.textContent = "OUTPUT · AI BRAIN – CONSULT";
      outputButtonsSoap.classList.add("hidden");
      outputButtonsToolbox.classList.add("hidden");
      outputButtonsConsult.classList.remove("hidden");
    }
    outputPanelChip.textContent = "Ready";
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
  showTab("soap");

  // ---------- VISIT TYPE / PRESETS / VACCINES / ANESTHESIA ----------
  const visitTypeAppointmentBtn = document.getElementById("visitTypeAppointment");
  const visitTypeSurgeryBtn = document.getElementById("visitTypeSurgery");
  const asaField = document.getElementById("asaField");
  const appointmentPresetRow = document.getElementById("appointmentPresetRow");
  const surgeryPresetRow = document.getElementById("surgeryPresetRow");
  const appointmentPreset = document.getElementById("appointmentPreset");
  const surgeryModeSimpleBtn = document.getElementById("surgeryModeSimple");
  const surgeryModeAdvancedBtn = document.getElementById("surgeryModeAdvanced");
  const anesthesiaCollapse = document.getElementById("anesthesiaCollapse");

  const vaccinesTodayCheckbox = document.getElementById("vaccinesToday");
  const vaccineSelectorRow = document.getElementById("vaccineSelectorRow");
  const vaccineSelector = document.getElementById("vaccineSelector");
  const speciesSelect = document.getElementById("species");

  function updateVisitType(type) {
    if (type === "appointment") {
      visitTypeAppointmentBtn.classList.add("active");
      visitTypeSurgeryBtn.classList.remove("active");
      asaField.style.display = "none";
      appointmentPresetRow.style.display = "flex";
      surgeryPresetRow.style.display = "none";
      anesthesiaCollapse.style.display = "none";
    } else {
      visitTypeAppointmentBtn.classList.remove("active");
      visitTypeSurgeryBtn.classList.add("active");
      asaField.style.display = "flex";
      appointmentPresetRow.style.display = "none";
      surgeryPresetRow.style.display = "flex";
      anesthesiaCollapse.style.display = "block";
    }
  }

  function updateSurgeryMode(mode) {
    if (mode === "simple") {
      surgeryModeSimpleBtn.classList.add("active");
      surgeryModeAdvancedBtn.classList.remove("active");
    } else {
      surgeryModeSimpleBtn.classList.remove("active");
      surgeryModeAdvancedBtn.classList.add("active");
      // auto-open anesthesia collapse when going advanced
      const toggle = anesthesiaCollapse.querySelector(".collapse-toggle");
      const body = document.getElementById(toggle.dataset.target);
      body.style.display = "block";
      toggle.classList.add("open");
    }
  }

  visitTypeAppointmentBtn.addEventListener("click", () => updateVisitType("appointment"));
  visitTypeSurgeryBtn.addEventListener("click", () => updateVisitType("surgery"));
  surgeryModeSimpleBtn.addEventListener("click", () => updateSurgeryMode("simple"));
  surgeryModeAdvancedBtn.addEventListener("click", () => updateSurgeryMode("advanced"));
  updateVisitType("appointment");
  updateSurgeryMode("simple");

  function populateVaccineOptions() {
    const species = speciesSelect.value;
    vaccineSelector.innerHTML = "";
    if (!species) return;

    function add(value, label) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      vaccineSelector.appendChild(opt);
    }

    if (species === "canine") {
      add("da2pp_1", "DA2PP – 1-year (SQ LH)");
      add("da2pp_3", "DA2PP – 3-year (SQ LH)");
      add("rabies_1_dog", "Rabies – 1-year (SQ RH)");
      add("rabies_3_dog", "Rabies – 3-year (SQ RH)");
      add("lyme", "Lyme (SQ LF)");
      add("lepto", "Leptospirosis (SQ RF)");
      add("bord_inj", "Bordetella – injectable (SQ neck)");
      add("bord_oral", "Bordetella – oral");
      add("bord_nasal", "Bordetella – intranasal");
    } else if (species === "feline") {
      add("fvrcp_1", "FVRCP – 1-year (SQ LH)");
      add("fvrcp_3", "FVRCP – 3-year (SQ LH)");
      add("rabies_1_cat", "Rabies – 1-year (SQ RH)");
      add("rabies_3_cat", "Rabies – 3-year (SQ RH)");
      add("felv", "FeLV (SQ LF)");
    }
  }

  speciesSelect.addEventListener("change", () => populateVaccineOptions());
  vaccinesTodayCheckbox.addEventListener("change", () => {
    vaccineSelectorRow.style.display = vaccinesTodayCheckbox.checked ? "flex" : "none";
  });
  appointmentPreset.addEventListener("change", () => {
    if (appointmentPreset.value === "wellness") {
      vaccinesTodayCheckbox.checked = true;
      vaccineSelectorRow.style.display = "flex";
    }
  });

  function gatherSelected(selectEl) {
    if (!selectEl) return [];
    return Array.from(selectEl.selectedOptions).map((o) => o.value);
  }

  // ---------- COLLAPSE HANDLER ----------
  function wireCollapse() {
    const toggles = document.querySelectorAll(".collapse-toggle");
    toggles.forEach((toggle) => {
      const targetId = toggle.dataset.target;
      if (!targetId) return;
      const body = document.getElementById(targetId);
      if (!body) return;
      body.style.display = body.id === "helperBody" ? "none" : body.style.display || "none";

      toggle.addEventListener("click", () => {
        const open = body.style.display !== "none";
        body.style.display = open ? "none" : "block";
        toggle.classList.toggle("open", !open);
      });
    });
  }
  wireCollapse();

  // ---------- SOAP RECORDER ----------
  let soapVoiceText = "";
  let soapUseAsContext = false;

  function setupRecorder(config) {
    const {
      recBtnId,
      recBtnIconId,
      recBtnLabelId,
      recDotId,
      recStatusId,
      recSummaryId,
      useContextBtnId,
      sendToTextBtnId,
      clearBtnId,
      onSendToText,
      storeText,
      getText,
      setUseContext,
    } = config;

    const recBtn = document.getElementById(recBtnId);
    const recIcon = document.getElementById(recBtnIconId);
    const recLabel = document.getElementById(recBtnLabelId);
    const recDot = document.getElementById(recDotId);
    const recStatus = document.getElementById(recStatusId);
    const recSummary = document.getElementById(recSummaryId);
    const useContextBtn = document.getElementById(useContextBtnId);
    const sendToTextBtn = document.getElementById(sendToTextBtnId);
    const clearBtn = document.getElementById(clearBtnId);

    let mediaRecorder = null;
    let chunks = [];

    function setRecordingState(isRecording) {
      if (isRecording) {
        recIcon.textContent = "⏹";
        recLabel.textContent = "Stop";
        recDot.classList.add("recording");
        recStatus.textContent = "Recording in progress…";
      } else {
        recIcon.textContent = "🎙";
        recLabel.textContent = "Record";
        recDot.classList.remove("recording");
        if (getText() && getText().trim()) {
          recStatus.textContent = "Recording finished.";
        } else {
          recStatus.textContent = "Not recording";
        }
      }
    }

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          // For now we just stub transcript; backend will do real STT when we wire it.
          const blob = new Blob(chunks, { type: "audio/webm" });
          // eslint-disable-next-line no-unused-vars
          const dummy = blob; // placeholder so linter doesn't complain
          const stub =
            "[Voice note recorded – transcript to be generated by backend. Summarize key findings and instructions here in future versions.]";
          storeText(stub);
          if (recSummary) {
            recSummary.textContent = "1 recording captured in this session.";
          }
          setRecordingState(false);
        };

        mediaRecorder.start();
        setRecordingState(true);
      } catch (err) {
        console.error("Error starting recorder", err);
        alert("Unable to access microphone. Please check browser permissions.");
      }
    }

    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    }

    if (recBtn) {
      recBtn.addEventListener("click", () => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
          startRecording();
        } else {
          stopRecording();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        storeText("");
        setUseContext(false);
        if (recSummary) recSummary.textContent = "No recordings in this session yet.";
        setRecordingState(false);
      });
    }

    if (useContextBtn) {
      useContextBtn.addEventListener("click", () => {
        if (!getText() || !getText().trim()) {
          alert("No recording yet. Record and stop at least once first.");
          return;
        }
        setUseContext(true);
        alert("Voice note will be used as additional context for the next run.");
      });
    }

    if (sendToTextBtn && typeof onSendToText === "function") {
      sendToTextBtn.addEventListener("click", () => {
        if (!getText() || !getText().trim()) {
          alert("No recording yet. Record and stop at least once first.");
          return;
        }
        onSendToText(getText());
      });
    }
  }

  setupRecorder({
    recBtnId: "soapRecBtn",
    recBtnIconId: "soapRecBtnIcon",
    recBtnLabelId: "soapRecBtnLabel",
    recDotId: "soapRecDot",
    recStatusId: "soapRecStatusText",
    recSummaryId: "soapRecSummaryText",
    useContextBtnId: "soapRecUseContextBtn",
    sendToTextBtnId: "soapRecToTranscriptBtn",
    clearBtnId: "soapRecClearBtn",
    storeText: (text) => {
      soapVoiceText = text;
    },
    getText: () => soapVoiceText,
    setUseContext: (val) => {
      soapUseAsContext = val;
    },
    onSendToText: (text) => {
      const core = document.getElementById("soapCoreNotes");
      if (core) {
        core.value = (core.value ? core.value + "\n\n" : "") + text;
      }
      alert("Voice stub text added to core notes. Edit as needed.");
    },
  });

  let toolboxVoiceText = "";
  let toolboxUseAsContext = false;
  setupRecorder({
    recBtnId: "toolboxRecBtn",
    recBtnIconId: "toolboxRecBtnIcon",
    recBtnLabelId: "toolboxRecBtnLabel",
    recDotId: "toolboxRecDot",
    recStatusId: "toolboxRecStatusText",
    recSummaryId: "toolboxRecSummaryText",
    useContextBtnId: "toolboxRecUseContextBtn",
    sendToTextBtnId: "toolboxRecToTextBtn",
    clearBtnId: "toolboxRecClearBtn",
    storeText: (text) => {
      toolboxVoiceText = text;
    },
    getText: () => toolboxVoiceText,
    setUseContext: (val) => {
      toolboxUseAsContext = val;
    },
    onSendToText: (text) => {
      const box = document.getElementById("toolboxInput");
      if (box) {
        box.value = (box.value ? box.value + "\n\n" : "") + text;
      }
      alert("Voice stub text added to toolbox input.");
    },
  });

  let consultVoiceText = "";
  let consultUseAsContext = false;
  setupRecorder({
    recBtnId: "consultRecBtn",
    recBtnIconId: "consultRecBtnIcon",
    recBtnLabelId: "consultRecBtnLabel",
    recDotId: "consultRecDot",
    recStatusId: "consultRecStatusText",
    recSummaryId: "consultRecSummaryText",
    useContextBtnId: "consultRecUseContextBtn",
    sendToTextBtnId: "consultRecToTextBtn",
    clearBtnId: "consultRecClearBtn",
    storeText: (text) => {
      consultVoiceText = text;
    },
    getText: () => consultVoiceText,
    setUseContext: (val) => {
      consultUseAsContext = val;
    },
    onSendToText: (text) => {
      const box = document.getElementById("consultContext");
      if (box) {
        box.value = (box.value ? box.value + "\n\n" : "") + text;
      }
      alert("Voice stub text added to consult context.");
    },
  });

  // ---------- SOAP GENERATION ----------
  const generateSoapBtn = document.getElementById("generateSoapBtn");

  async function generateSOAP() {
    describeStatus("Generating SOAP…");
    mainOutput.textContent = "Working on SOAP…";

    const images = await readAttachmentsAsDataUrls();

    const payload = {
      mode: "soap",
      caseLabel: document.getElementById("caseLabel").value,
      patientName: document.getElementById("patientName").value,
      species: document.getElementById("species").value,
      sex: document.getElementById("sex").value,
      weightKg: document.getElementById("weightKg").value,
      visitType: visitTypeAppointmentBtn.classList.contains("active") ? "appointment" : "surgery",
      asa: document.getElementById("asaStatus").value,
      tprNotes: document.getElementById("tprNotes").value,
      appointmentPreset: document.getElementById("appointmentPreset").value,
      surgeryPreset: document.getElementById("surgeryPreset").value,
      surgeryMode: surgeryModeSimpleBtn.classList.contains("active") ? "simple" : "advanced",

      vaccinesToday: vaccinesTodayCheckbox.checked,
      vaccineSelections: gatherSelected(vaccineSelector),

      premedCombos: gatherSelected(document.getElementById("premedCombos")),
      inductionDrugs: gatherSelected(document.getElementById("inductionDrugs")),
      intraOpDrugs: gatherSelected(document.getElementById("intraOpDrugs")),
      postOpAnalgesia: gatherSelected(document.getElementById("postOpAnalgesia")),
      postOpAntibiotics: gatherSelected(document.getElementById("postOpAntibiotics")),

      coreNotes: document.getElementById("soapCoreNotes").value,
      pe: document.getElementById("soapPE").value,
      assessmentHints: document.getElementById("soapAssessmentHints").value,
      planHints: document.getElementById("soapPlanHints").value,
      extra: document.getElementById("soapExtra").value,
      externalTranscript: document.getElementById("externalTranscript").value,
      externalTranscriptInclude: document.getElementById("externalTranscriptInclude").checked,

      voiceTranscript: soapUseAsContext ? soapVoiceText : "",
      images,
    };

    try {
      const res = await fetch(SOAP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      mainOutput.textContent = data.text || data.output || "No output returned.";
      describeStatus("SOAP ready");
    } catch (err) {
      console.error(err);
      mainOutput.textContent =
        "Error generating SOAP. Check Netlify function logs. " + (err.message || "");
      describeStatus("Error generating SOAP", true);
    }
  }

  if (generateSoapBtn) {
    generateSoapBtn.addEventListener("click", () => {
      generateSOAP();
    });
  }

  // ---------- TOOLBOX ----------
  const toolboxGenerateBtn = document.getElementById("toolboxGenerateBtn");
  const toolboxModeSelect = document.getElementById("toolboxMode");
  const toolboxInputEl = document.getElementById("toolboxInput");

  async function generateToolbox() {
    describeStatus("Toolbox working…");
    mainOutput.textContent = "Working on toolbox output…";

    const images = await readAttachmentsAsDataUrls();

    const payload = {
      mode: "toolbox",
      toolboxMode: toolboxModeSelect.value,
      text: toolboxInputEl.value,
      externalTranscript: document.getElementById("toolboxExternalTranscript").value,
      voiceTranscript: toolboxUseAsContext ? toolboxVoiceText : "",
      images,
    };

    try {
      const res = await fetch(VISION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      mainOutput.textContent = data.text || data.output || "No toolbox output returned.";
      describeStatus("Toolbox output ready");
    } catch (err) {
      console.error(err);
      mainOutput.textContent =
        "Error generating toolbox output. Check Netlify function logs. " + (err.message || "");
      describeStatus("Error in Toolbox", true);
    }
  }

  if (toolboxGenerateBtn) {
    toolboxGenerateBtn.addEventListener("click", () => {
      generateToolbox();
    });
  }

  // ---------- CONSULT ----------
  const consultGenerateBtn = document.getElementById("consultGenerateBtn");

  async function generateConsult() {
    describeStatus("Consult working…");
    mainOutput.textContent = "Working on consult output…";

    const images = await readAttachmentsAsDataUrls();

    const payload = {
      mode: "consult",
      question: document.getElementById("consultQuestion").value,
      context: document.getElementById("consultContext").value,
      externalTranscript: document.getElementById("consultExternalTranscript").value,
      voiceTranscript: consultUseAsContext ? consultVoiceText : "",
      images,
    };

    try {
      const res = await fetch(FEEDBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      mainOutput.textContent = data.text || data.output || "No consult output returned.";
      describeStatus("Consult ready");
    } catch (err) {
      console.error(err);
      mainOutput.textContent =
        "Error generating consult output. Check Netlify function logs. " + (err.message || "");
      describeStatus("Error in consult", true);
    }
  }

  if (consultGenerateBtn) {
    consultGenerateBtn.addEventListener("click", () => {
      generateConsult();
    });
  }

  // ---------- FEEDBACK / REFINE ----------
  async function refineOutput() {
    const base = mainOutput.textContent || "";
    if (!base.trim()) {
      alert("No output to refine yet.");
      return;
    }
    const req =
      feedbackInput.value.trim() ||
      "Improve clarity and flow, keep the same clinical content and Avimark-friendly formatting.";
    describeStatus("Refining output…");
    try {
      const res = await fetch(FEEDBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "refine",
          text: base,
          request: req,
          context: currentTab,
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      mainOutput.textContent = data.text || data.output || base;
      describeStatus("Refined");
    } catch (err) {
      console.error(err);
      alert("Error refining output. Check Netlify logs.");
      describeStatus("Error refining", true);
    }
  }

  if (feedbackImproveBtn) {
    feedbackImproveBtn.addEventListener("click", () => refineOutput());
  }

  // ---------- SOAP HELPER ----------
  const helperGenerateBtn = document.getElementById("helperGenerateBtn");
  const helperClearBtn = document.getElementById("helperClearBtn");
  const helperPrompt = document.getElementById("helperPrompt");
  const helperOutput = document.getElementById("helperOutput");
  const helperCopyBtn = document.getElementById("helperCopyBtn");

  async function generateHelper() {
    const prompt = helperPrompt.value.trim();
    if (!prompt) {
      alert('Type what you want the helper to generate (e.g. "discharge", "email", "summary").');
      return;
    }
    describeStatus("SOAP helper working…");
    helperOutput.textContent = "Working on helper output…";

    const payload = {
      mode: "soap_helper",
      helperPrompt: prompt,
      soapText: mainOutput.textContent || "",
      externalTranscript: document.getElementById("externalTranscript").value,
      voiceTranscript: soapVoiceText,
    };

    try {
      const res = await fetch(FEEDBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      helperOutput.textContent = data.text || data.output || "No helper output returned.";
      describeStatus("Helper ready");
    } catch (err) {
      console.error(err);
      helperOutput.textContent = "Error generating helper output.";
      describeStatus("Error in helper", true);
    }
  }

  if (helperGenerateBtn) {
    helperGenerateBtn.addEventListener("click", () => generateHelper());
  }
  if (helperClearBtn) {
    helperClearBtn.addEventListener("click", () => {
      helperPrompt.value = "";
      helperOutput.textContent =
        "When you generate, helper output (discharge, email, summary, etc.) will appear here.";
    });
  }
  if (helperCopyBtn) {
    helperCopyBtn.addEventListener("click", () => {
      const text = helperOutput.textContent || "";
      if (!text.trim()) {
        alert("Nothing to copy.");
        return;
      }
      navigator.clipboard.writeText(text).then(() => {
        alert("Helper text copied to clipboard.");
      });
    });
  }

  // ---------- COPY BUTTONS ----------
  function copyText(text) {
    if (!text || !text.trim()) {
      alert("Nothing to copy.");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied to clipboard.");
    });
  }

  const copyFullSoapBtn = document.getElementById("copyFullSoapBtn");
  const copyPlanMedsAfterBtn = document.getElementById("copyPlanMedsAfterBtn");
  const copyToolboxOutputBtn = document.getElementById("copyToolboxOutputBtn");
  const copyConsultOutputBtn = document.getElementById("copyConsultOutputBtn");

  if (copyFullSoapBtn) {
    copyFullSoapBtn.addEventListener("click", () => copyText(mainOutput.textContent));
  }

  if (copyPlanMedsAfterBtn) {
    copyPlanMedsAfterBtn.addEventListener("click", () => {
      // For now, copy full SOAP; backend should already structure sections.
      copyText(mainOutput.textContent);
    });
  }

  if (copyToolboxOutputBtn) {
    copyToolboxOutputBtn.addEventListener("click", () => copyText(mainOutput.textContent));
  }

  if (copyConsultOutputBtn) {
    copyConsultOutputBtn.addEventListener("click", () => copyText(mainOutput.textContent));
  }
});