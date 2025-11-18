// ---- BACKEND URL ----
// Netlify site (frontend)
// Render backend (Node server)
const BACKEND_URL = "https://lohit-soap-app.onrender.com/api/run";

// app.js
// Frontend logic for Lohit SOAP App v1.6
// Uses /api/run backend endpoint defined in server.js
// app.js
// Frontend logic for Lohit SOAP App v1.6
// Uses /api/run backend endpoint defined in server.js

(function () {
  // Tab elements
  const tabAppointment = document.getElementById("tabAppointment");
  const tabSurgery = document.getElementById("tabSurgery");
  const tabConsult = document.getElementById("tabConsult");
  const tabToolbox = document.getElementById("tabToolbox");

  const appointmentSection = document.getElementById("appointmentSection");
  const surgerySection = document.getElementById("surgerySection");
  const consultSection = document.getElementById("consultSection");
  const toolboxSection = document.getElementById("toolboxSection");

  const modeSelect = document.getElementById("modeSelect");
  const caseLabelInput = document.getElementById("caseLabelInput");
  const statusMessage = document.getElementById("statusMessage");

  // SOAP outputs
  const soapSubjective = document.getElementById("soapSubjective");
  const soapObjective = document.getElementById("soapObjective");
  const soapAssessmentOut = document.getElementById("soapAssessment");
  const soapPlanOut = document.getElementById("soapPlan");
  const soapMedsOut = document.getElementById("soapMeds");
  const soapAftercareOut = document.getElementById("soapAftercare");

  const copyButtons = document.querySelectorAll(".copy-button");
  const copyFullSoapBtn = document.getElementById("copyFullSoapBtn");
  const copyPlanMedsAftercareBtn = document.getElementById("copyPlanMedsAftercareBtn");

  // Appointment elements
  const appointmentReason = document.getElementById("appointmentReason");
  const appointmentTpr = document.getElementById("appointmentTpr");
  const appointmentQuick = document.getElementById("appointmentQuick");
  const appointmentToggleFull = document.getElementById("appointmentToggleFull");
  const appointmentFull = document.getElementById("appointmentFull");

  const appointmentHistory = document.getElementById("appointmentHistory");
  const appointmentPe = document.getElementById("appointmentPe");
  const appointmentDiagnostics = document.getElementById("appointmentDiagnostics");
  const appointmentAssessment = document.getElementById("appointmentAssessment");
  const appointmentPlan = document.getElementById("appointmentPlan");
  const appointmentMeds = document.getElementById("appointmentMeds");
  const appointmentAttachments = document.getElementById("appointmentAttachments");
  const generateAppointmentBtn = document.getElementById("generateAppointmentBtn");

  // Surgery elements
  const surgeryTemplate = document.getElementById("surgeryTemplate");
  const surgeryTemplateBanner = document.getElementById("surgeryTemplateBanner");
  const surgeryAsa = document.getElementById("surgeryAsa");
  const surgeryIvCath = document.getElementById("surgeryIvCath");
  const surgeryEtt = document.getElementById("surgeryEtt");
  const surgeryFluids = document.getElementById("surgeryFluids");
  const surgeryFluidsDeclined = document.getElementById("surgeryFluidsDeclined");
  const surgeryPremeds = document.getElementById("surgeryPremeds");
  const surgeryInduction = document.getElementById("surgeryInduction");
  const surgeryIntraop = document.getElementById("surgeryIntraop");
  const surgeryProcedure = document.getElementById("surgeryProcedure");
  const surgeryTpr = document.getElementById("surgeryTpr");
  const surgeryDurations = document.getElementById("surgeryDurations");
  const surgeryAttachments = document.getElementById("surgeryAttachments");

  const dentalSection = document.getElementById("dentalSection");
  const surgeryDentalRads = document.getElementById("surgeryDentalRads");
  const surgeryDentalExtractions = document.getElementById("surgeryDentalExtractions");

  const massSection = document.getElementById("massSection");
  const surgeryMassDetails = document.getElementById("surgeryMassDetails");
  const surgeryHistopath = document.getElementById("surgeryHistopath");

  const mono0Override = document.getElementById("mono0Override");
  const mono2Override = document.getElementById("mono2Override");
  const mono3Override = document.getElementById("mono3Override");

  const anesthesiaToggle = document.getElementById("anesthesiaToggle");
  const anesthesiaPanel = document.getElementById("anesthesiaPanel");
  const surgeryDetailsToggle = document.getElementById("surgeryDetailsToggle");
  const surgeryDetailsPanel = document.getElementById("surgeryDetailsPanel");
  const generateSurgeryBtn = document.getElementById("generateSurgeryBtn");

  // Consult / Toolbox
  const consultText = document.getElementById("consultText");
  const consultAttachments = document.getElementById("consultAttachments");
  const consultOutput = document.getElementById("consultOutput");
  const runConsultBtn = document.getElementById("runConsultBtn");

  const toolboxAttachments = document.getElementById("toolboxAttachments");
  const toolboxLabText = document.getElementById("toolboxLabText");
  const toolboxDetail = document.getElementById("toolboxDetail");
  const toolboxIncludeDiffs = document.getElementById("toolboxIncludeDiffs");
  const toolboxIncludeClient = document.getElementById("toolboxIncludeClient");
  const toolboxOutput = document.getElementById("toolboxOutput");
  const runBloodworkBtn = document.getElementById("runBloodworkBtn");

  // Mic + QR
  const micButton = document.getElementById("micButton");
  const qrCanvas = document.getElementById("qrCanvas");

  // Surgery template descriptions (for banner/AI hinting)
  const surgeryTemplateDescriptions = {
    canine_neuter_clinic:
      "Canine neuter – clinic: prescrotal approach, standard young healthy dog neuter. Default closure 2-0 Monocryl (<35 kg) or 0 Monocryl (>35 kg).",
    canine_neuter_rescue:
      "Canine neuter – rescue: prescrotal approach, often shelter / rescue dog with unknown history; default IV catheter, fluids, full monitoring.",
    canine_spay_clinic:
      "Canine spay – clinic: ovariohysterectomy via ventral midline, standard young healthy dog.",
    canine_spay_rescue:
      "Canine spay – rescue: ovariohysterectomy, often in-heat/uncertain heat history or multiparous, may have longer surgery time.",
    feline_neuter:
      "Feline neuter: scrotal approach, open or closed technique per clinic protocol.",
    feline_spay:
      "Feline spay: ovariohysterectomy via ventral midline or flank per clinic protocol.",
    pyometra_spay:
      "Pyometra spay: ovariohysterectomy for pyometra; septic risk, careful hemostasis, lavage and extended aftercare.",
    cystotomy:
      "Cystotomy: ventral cystotomy for removal of uroliths, bladder inspection, flushing of urethra.",
    enterotomy:
      "Enterotomy: small intestinal enterotomy for foreign body removal, leak test and omental wrap as indicated.",
    gastrotomy:
      "Gastrotomy: gastric foreign body removal with mucosal inspection and lavage.",
    gastropexy:
      "Gastropexy: prophylactic or post-GDV gastropexy (incisional or belt-loop) with standard closure.",
    feline_unblock:
      "Feline urethral unblock: stabilization, sedation/anesthesia, urethral catheter placement and bladder flushing.",
    dental_cohat_rads:
      "Dental COHAT with radiographs: full-mouth radiographs, scaling, polishing, charting, extractions as indicated under AAHA/AVDC standards.",
    dental_cohat_norads:
      "Dental COHAT (no radiographs): scaling, polishing and charting; no radiographs performed or radiographs declined.",
    mass_removal:
      "Mass removal / biopsy: skin or subcutaneous mass excision or incisional biopsy with histopathology as indicated.",
    other:
      "Other / custom surgery. Use free-text procedure notes to describe."
  };

  // ---- Tab logic ---------------------------------------------------------

  function setActiveTab(tab) {
    [tabAppointment, tabSurgery, tabConsult, tabToolbox].forEach((btn) =>
      btn.classList.remove("tab-active")
    );
    [appointmentSection, surgerySection, consultSection, toolboxSection].forEach(
      (sec) => sec.classList.add("hidden")
    );

    if (tab === "appointment") {
      tabAppointment.classList.add("tab-active");
      appointmentSection.classList.remove("hidden");
    } else if (tab === "surgery") {
      tabSurgery.classList.add("tab-active");
      surgerySection.classList.remove("hidden");
    } else if (tab === "consult") {
      tabConsult.classList.add("tab-active");
      consultSection.classList.remove("hidden");
    } else if (tab === "toolbox") {
      tabToolbox.classList.add("tab-active");
      toolboxSection.classList.remove("hidden");
    }
  }

  tabAppointment.addEventListener("click", () => setActiveTab("appointment"));
  tabSurgery.addEventListener("click", () => setActiveTab("surgery"));
  tabConsult.addEventListener("click", () => setActiveTab("consult"));
  tabToolbox.addEventListener("click", () => setActiveTab("toolbox"));

  // Default tab
  setActiveTab("appointment");

  // ---- Appointment minimal/full toggle ----------------------------------

  let appointmentFullVisible = false;

  appointmentToggleFull.addEventListener("click", () => {
    appointmentFullVisible = !appointmentFullVisible;
    if (appointmentFullVisible) {
      appointmentFull.classList.remove("collapse");
      appointmentFull.classList.add("collapse", "open");
      appointmentToggleFull.textContent = "Hide full SOAP input fields";
    } else {
      appointmentFull.classList.remove("open");
      appointmentToggleFull.textContent = "Show full SOAP input fields";
    }
  });

  // ---- Surgery template dynamic UI --------------------------------------

  function updateSurgeryTemplateUI() {
    const value = surgeryTemplate.value;
    const desc = surgeryTemplateDescriptions[value] || "";
    surgeryTemplateBanner.textContent = desc;

    // Show dental section only for dental templates
    if (value === "dental_cohat_rads" || value === "dental_cohat_norads") {
      dentalSection.classList.remove("hidden");
    } else {
      dentalSection.classList.add("hidden");
    }

    // Show mass/cysto section for mass, cystotomy, etc.
    if (value === "mass_removal" || value === "cystotomy") {
      massSection.classList.remove("hidden");
    } else {
      massSection.classList.add("hidden");
    }
  }

  surgeryTemplate.addEventListener("change", updateSurgeryTemplateUI);
  updateSurgeryTemplateUI();

  // Collapse toggles
  function togglePanel(button, panel) {
    button.addEventListener("click", () => {
      if (panel.classList.contains("open")) {
        panel.classList.remove("open");
      } else {
        panel.classList.add("open");
      }
    });
  }

  togglePanel(anesthesiaToggle, anesthesiaPanel);
  togglePanel(surgeryDetailsToggle, surgeryDetailsPanel);

  // ---- Helper: get filenames from file input ----------------------------

  function getFileNames(inputEl) {
    if (!inputEl || !inputEl.files) return [];
    return Array.from(inputEl.files).map((f) => f.name);
  }

  // ---- API caller -------------------------------------------------------

  async function callApi(mode, payload) {
    statusMessage.textContent = "Working...";
    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, payload })
      });

      if (!response.ok) {
        const text = await response.text();
        statusMessage.textContent = `Error: ${response.status} ${response.statusText}`;
        console.error("API error:", text);
        return { ok: false, result: "" };
      }

      const data = await response.json();
      statusMessage.textContent = "Done.";
      return { ok: true, result: data.result || "" };
    } catch (err) {
      console.error("API call failed:", err);
      statusMessage.textContent = "Error contacting server.";
      return { ok: false, result: "" };
    }
  }

  // ---- SOAP output parser -----------------------------------------------

  function fillSoapOutputs(rawText) {
    // Expect text in sections:
    // Subjective:
    // ...
    // Objective:
    // ...
    // etc.
    const sections = {
      Subjective: "",
      Objective: "",
      Assessment: "",
      Plan: "",
      "Medications Dispensed": "",
      Aftercare: ""
    };

    let current = null;
    const lines = (rawText || "").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^Subjective:/i.test(trimmed)) {
        current = "Subjective";
        sections[current] = trimmed.replace(/^Subjective:\s*/i, "");
      } else if (/^Objective:/i.test(trimmed)) {
        current = "Objective";
        sections[current] = trimmed.replace(/^Objective:\s*/i, "");
      } else if (/^Assessment:/i.test(trimmed)) {
        current = "Assessment";
        sections[current] = trimmed.replace(/^Assessment:\s*/i, "");
      } else if (/^Plan:/i.test(trimmed)) {
        current = "Plan";
        sections[current] = trimmed.replace(/^Plan:\s*/i, "");
      } else if (/^Medications Dispensed:/i.test(trimmed)) {
        current = "Medications Dispensed";
        sections[current] = trimmed.replace(/^Medications Dispensed:\s*/i, "");
      } else if (/^Aftercare:/i.test(trimmed)) {
        current = "Aftercare";
        sections[current] = trimmed.replace(/^Aftercare:\s*/i, "");
      } else if (current) {
        sections[current] += "\n" + line;
      }
    }

    soapSubjective.value = sections["Subjective"].trim();
    soapObjective.value = sections["Objective"].trim();
    soapAssessmentOut.value = sections["Assessment"].trim();
    soapPlanOut.value = sections["Plan"].trim();
    soapMedsOut.value = sections["Medications Dispensed"].trim();
    soapAftercareOut.value = sections["Aftercare"].trim();
  }

  // ---- Appointment SOAP generation --------------------------------------

  generateAppointmentBtn.addEventListener("click", async () => {
    const strictMode = modeSelect.value === "strict";
    const payload = {
      soapType: "appointment",
      strictMode,
      caseLabel: caseLabelInput.value || "",
      uiMode: "appointment",
      reason: appointmentReason.value || "",
      tpr: appointmentTpr.value || "",
      quickNotes: appointmentQuick.value || "",
      history: appointmentHistory.value || "",
      physicalExam: appointmentPe.value || "",
      diagnostics: appointmentDiagnostics.value || "",
      assessment: appointmentAssessment.value || "",
      plan: appointmentPlan.value || "",
      medsDispensed: appointmentMeds.value || "",
      attachments: getFileNames(appointmentAttachments)
    };

    const { ok, result } = await callApi("soap", payload);
    if (ok) fillSoapOutputs(result);
  });

  // ---- Surgery SOAP generation -----------------------------------------

  generateSurgeryBtn.addEventListener("click", async () => {
    const strictMode = modeSelect.value === "strict";
    const payload = {
      soapType: "surgery",
      strictMode,
      caseLabel: caseLabelInput.value || "",
      uiMode: "surgery",
      surgeryTemplate: surgeryTemplate.value,
      surgeryTemplateDescription:
        surgeryTemplateDescriptions[surgeryTemplate.value] || "",
      asaStatus: surgeryAsa.value || "",
      ivCatheter: surgeryIvCath.value || "",
      ettSize: surgeryEtt.value || "",
      fluidsRate: surgeryFluids.value || "",
      fluidsDeclined: !!surgeryFluidsDeclined.checked,
      premeds: surgeryPremeds.value || "",
      inductionMaintenance: surgeryInduction.value || "",
      intraOpMeds: surgeryIntraop.value || "",
      procedureNotes: surgeryProcedure.value || "",
      dentalRadsChoice: surgeryDentalRads.value || "",
      dentalExtractionNotes: surgeryDentalExtractions.value || "",
      massDetails: surgeryMassDetails.value || "",
      histopathChoice: surgeryHistopath.value || "",
      tprNotes: surgeryTpr.value || "",
      durations: surgeryDurations.value || "",
      monocrylOverride: {
        zero: !!mono0Override.checked,
        two: !!mono2Override.checked,
        three: !!mono3Override.checked
      },
      attachments: getFileNames(surgeryAttachments)
    };

    const { ok, result } = await callApi("soap", payload);
    if (ok) fillSoapOutputs(result);
  });

  // ---- Consult ----------------------------------------------------------

  runConsultBtn.addEventListener("click", async () => {
    const payload = {
      message: consultText.value || "",
      caseLabel: caseLabelInput.value || "",
      attachments: getFileNames(consultAttachments)
    };

    const { ok, result } = await callApi("consult", payload);
    if (ok) {
      consultOutput.value = result.trim();
    }
  });

  // ---- Toolbox: Bloodwork Helper ---------------------------------------

  runBloodworkBtn.addEventListener("click", async () => {
    const payload = {
      text: toolboxLabText.value || "",
      detailLevel: toolboxDetail.value || "short",
      includeDiffs: !!toolboxIncludeDiffs.checked,
      includeClientFriendly: !!toolboxIncludeClient.checked,
      attachments: getFileNames(toolboxAttachments)
    };

    const { ok, result } = await callApi("toolbox-bloodwork", payload);
    if (ok) {
      toolboxOutput.value = result.trim();
    }
  });

  // ---- Copy buttons -----------------------------------------------------

  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Clipboard error", err);
    });
  }

  copyButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.copyTarget;
      const el = document.getElementById(id);
      if (el) copyToClipboard(el.value);
    });
  });

  copyFullSoapBtn.addEventListener("click", () => {
    const full = [
      "Subjective:",
      soapSubjective.value,
      "",
      "Objective:",
      soapObjective.value,
      "",
      "Assessment:",
      soapAssessmentOut.value,
      "",
      "Plan:",
      soapPlanOut.value,
      "",
      "Medications Dispensed:",
      soapMedsOut.value,
      "",
      "Aftercare:",
      soapAftercareOut.value
    ].join("\n");
    copyToClipboard(full.trim());
  });

  copyPlanMedsAftercareBtn.addEventListener("click", () => {
    const text = [
      "Plan:",
      soapPlanOut.value,
      "",
      "Medications Dispensed:",
      soapMedsOut.value,
      "",
      "Aftercare:",
      soapAftercareOut.value
    ].join("\n");
    copyToClipboard(text.trim());
  });

  // ---- Mic / Speech recognition ----------------------------------------

  let lastFocusedElement = null;

  function trackFocus(el) {
    if (!el) return;
    el.addEventListener("focus", () => {
      lastFocusedElement = el;
    });
  }

  [
    appointmentReason,
    appointmentTpr,
    appointmentQuick,
    appointmentHistory,
    appointmentPe,
    appointmentDiagnostics,
    appointmentAssessment,
    appointmentPlan,
    appointmentMeds,
    surgeryAsa,
    surgeryIvCath,
    surgeryEtt,
    surgeryFluids,
    surgeryPremeds,
    surgeryInduction,
    surgeryIntraop,
    surgeryProcedure,
    surgeryDentalExtractions,
    surgeryMassDetails,
    surgeryTpr,
    surgeryDurations,
    consultText,
    toolboxLabText
  ].forEach(trackFocus);

  let recognition = null;
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (SR) {
      recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (lastFocusedElement && typeof lastFocusedElement.value === "string") {
          const sep = lastFocusedElement.value ? " " : "";
          lastFocusedElement.value += sep + transcript;
        }
      };
    }
  }

  micButton.addEventListener("click", () => {
    if (!recognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    try {
      recognition.start();
      statusMessage.textContent = "Listening...";
    } catch (e) {
      console.error("Speech start error:", e);
    }
  });

  // ---- QR code ----------------------------------------------------------

  function initQr() {
    if (!qrCanvas || !window.QRCode) return;
    const url = window.location.href;
    QRCode.toCanvas(
      qrCanvas,
      url,
      { width: 180, margin: 1 },
      (error) => {
        if (error) {
          console.error("QR error:", error);
        }
      }
    );
  }

  window.addEventListener("load", initQr);
})();
