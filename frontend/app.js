// ===== Basic helpers =====

const statusEl = document.getElementById("statusMessage");
const consoleEl = document.getElementById("consoleOutput");

function logStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
  appendConsole(`[STATUS] ${msg}`);
}

function appendConsole(msg) {
  if (!consoleEl) return;
  const ts = new Date().toLocaleTimeString();
  consoleEl.value += `[${ts}] ${msg}\n`;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function describeFiles(inputEl) {
  if (!inputEl || !inputEl.files) return [];
  return Array.from(inputEl.files).map((f) => ({
    name: f.name,
    type: f.type || "",
    size: f.size || 0,
  }));
}

async function postJSON(path, payload) {
  const url = `/.netlify/functions/${path}`;
  appendConsole(`POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    appendConsole(`HTTP ${res.status} – ${text || "no body"}`);
    throw new Error(`Request failed (${res.status})`);
  }

  const data = await res.json();
  appendConsole(`Response from ${path}: ${JSON.stringify(data).slice(0, 400)}…`);
  return data;
}

// ===== Tab switching =====

(function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tabTarget;
      if (!targetId) return;

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      panels.forEach((panel) => {
        if (panel.id === targetId) {
          panel.classList.remove("hidden");
        } else {
          panel.classList.add("hidden");
        }
      });
    });
  });
})();

// ===== Privacy modal (stub, but safe) =====

(function setupPrivacyModal() {
  const modal = document.getElementById("privacyModal");
  const targetLabel = document.getElementById("privacyTargetLabel");
  const closeBtn = document.getElementById("closePrivacyModalBtn");

  function openModal(targetId) {
    if (!modal) return;
    if (targetLabel) {
      let label = "Unknown";
      if (targetId === "apptFiles") label = "Appointment attachments";
      else if (targetId === "sxFiles") label = "Surgery attachments";
      else if (targetId === "toolboxFiles") label = "Toolbox attachments";
      else if (targetId === "consultFiles") label = "Consult attachments";
      targetLabel.textContent = label;
    }
    modal.classList.remove("hidden");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
  }

  document.querySelectorAll("[data-privacy-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.privacyTarget;
      openModal(targetId);
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
})();

// ===== Appointment tab =====

(function setupAppointment() {
  const apptFiles = document.getElementById("apptFiles");
  const apptReason = document.getElementById("apptReason");
  const apptHistory = document.getElementById("apptHistory");
  const apptPE = document.getElementById("apptPE");
  const apptDiagnostics = document.getElementById("apptDiagnostics");
  const apptAssessmentHints = document.getElementById("apptAssessmentHints");
  const apptPlanHints = document.getElementById("apptPlanHints");
  const apptMedsHints = document.getElementById("apptMedsHints");

  const apptSoapOutput = document.getElementById("apptSoapOutput");

  const generateBtn = document.getElementById("generateApptSoapBtn");
  const copySoapBtn = document.getElementById("copyApptSoapBtn");

  const extraOutput = document.getElementById("apptTransformOutput");
  const copyExtraBtn = document.getElementById("copyApptTransformBtn");

  const feedbackInput = document.getElementById("apptSoapFeedbackInput");
  const refineBtn = document.getElementById("improveApptSoapBtn");

  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      try {
        logStatus("Generating appointment SOAP…");

        const files = describeFiles(apptFiles);
        const body = {
          mode: "appointment",
          files,
          reason: apptReason?.value || "",
          history: apptHistory?.value || "",
          pe: apptPE?.value || "",
          diagnostics: apptDiagnostics?.value || "",
          assessmentHints: apptAssessmentHints?.value || "",
          planHints: apptPlanHints?.value || "",
          medsHints: apptMedsHints?.value || "",
        };

        const data = await postJSON("soap", body);
        apptSoapOutput.value = data.soap || "";
        logStatus("Appointment SOAP ready.");
      } catch (err) {
        console.error(err);
        logStatus("Error generating appointment SOAP.");
        alert("Error generating appointment SOAP. Check log.");
      }
    });
  }

  if (copySoapBtn) {
    copySoapBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(apptSoapOutput.value || "");
        logStatus("Appointment SOAP copied.");
      } catch {
        alert("Could not copy SOAP (clipboard error).");
      }
    });
  }

  // Additional transforms
  document.querySelectorAll("button[data-transform][data-target='apptSoapOutput']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const type = btn.dataset.transform;
      try {
        if (!apptSoapOutput.value.trim()) {
          alert("Generate a SOAP first.");
          return;
        }
        logStatus(`Transforming appointment SOAP → ${type}…`);
        const data = await postJSON("toolbox", {
          mode: "soap-transform",
          transformType: type,
          sourceText: apptSoapOutput.value,
        });
        extraOutput.value = data.result || "";
        logStatus("Transform ready.");
      } catch (err) {
        console.error(err);
        logStatus("Error transforming SOAP.");
        alert("Error transforming SOAP. Check log.");
      }
    });
  });

  if (copyExtraBtn) {
    copyExtraBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(extraOutput.value || "");
        logStatus("Transformed text copied.");
      } catch {
        alert("Could not copy transformed text.");
      }
    });
  }

  if (refineBtn) {
    refineBtn.addEventListener("click", async () => {
      try {
        const feedback = feedbackInput?.value || "";
        if (!apptSoapOutput.value.trim()) {
          alert("Generate a SOAP first.");
          return;
        }
        if (!feedback.trim()) {
          alert("Add some feedback / instructions first.");
          return;
        }
        logStatus("Refining appointment SOAP…");
        const data = await postJSON("feedback", {
          type: "soap-refine",
          mode: "appointment",
          original: apptSoapOutput.value,
          feedback,
        });
        apptSoapOutput.value = data.improved || apptSoapOutput.value;
        logStatus("Appointment SOAP refined.");
      } catch (err) {
        console.error(err);
        logStatus("Error refining appointment SOAP.");
        alert("Error refining SOAP. Check log.");
      }
    });
  }
})();

// ===== Surgery tab =====

(function setupSurgery() {
  const sxFiles = document.getElementById("sxFiles");
  const sxReason = document.getElementById("sxReason");
  const sxHistory = document.getElementById("sxHistory");
  const sxPE = document.getElementById("sxPE");
  const sxDiagnostics = document.getElementById("sxDiagnostics");

  const sxPreset = document.getElementById("sxPreset");

  const sxModeButtons = document.querySelectorAll(".sx-mode-btn");
  const sxAdvancedBlock = document.getElementById("sxAdvancedBlock");

  const sxPremed = document.getElementById("sxPremed");
  const sxInduction = document.getElementById("sxInduction");
  const sxFluids = document.getElementById("sxFluids");
  const sxLines = document.getElementById("sxLines");
  const sxIntraOp = document.getElementById("sxIntraOp");
  const sxPostOp = document.getElementById("sxPostOp");
  const sxRecovery = document.getElementById("sxRecovery");
  const sxProcedureNotes = document.getElementById("sxProcedureNotes");
  const sxMedsDispensed = document.getElementById("sxMedsDispensed");

  const generateBtn = document.getElementById("generateSxSoapBtn");
  const sxSoapOutput = document.getElementById("sxSoapOutput");
  const copySxSoapBtn = document.getElementById("copySxSoapBtn");

  const sxTransformOutput = document.getElementById("sxTransformOutput");
  const copySxTransformBtn = document.getElementById("copySxTransformBtn");

  const sxFeedbackInput = document.getElementById("sxSoapFeedbackInput");
  const refineSxBtn = document.getElementById("improveSxSoapBtn");

  let sxMode = "simple";

  // mode toggle
  sxModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sxModeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sxMode = btn.dataset.sxMode || "simple";
      if (sxAdvancedBlock) {
        if (sxMode === "advanced") {
          sxAdvancedBlock.classList.remove("hidden");
        } else {
          sxAdvancedBlock.classList.add("hidden");
        }
      }
    });
  });

  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      try {
        logStatus("Generating surgery SOAP…");
        const files = describeFiles(sxFiles);

        const body = {
          mode: "surgery",
          sxMode,
          files,
          preset: sxPreset?.value || "",
          reason: sxReason?.value || "",
          history: sxHistory?.value || "",
          pe: sxPE?.value || "",
          diagnostics: sxDiagnostics?.value || "",
          premed: sxPremed?.value || "",
          induction: sxInduction?.value || "",
          fluids: sxFluids?.value || "",
          lines: sxLines?.value || "",
          intraOp: sxIntraOp?.value || "",
          postOp: sxPostOp?.value || "",
          recovery: sxRecovery?.value || "",
          procedureNotes: sxProcedureNotes?.value || "",
          medsDispensed: sxMedsDispensed?.value || "",
        };

        const data = await postJSON("soap", body);
        sxSoapOutput.value = data.soap || "";
        logStatus("Surgery SOAP ready.");
      } catch (err) {
        console.error(err);
        logStatus("Error generating surgery SOAP.");
        alert("Error generating surgery SOAP. Check log.");
      }
    });
  }

  if (copySxSoapBtn) {
    copySxSoapBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sxSoapOutput.value || "");
        logStatus("Surgery SOAP copied.");
      } catch {
        alert("Could not copy surgery SOAP.");
      }
    });
  }

  // Additional transforms
  document.querySelectorAll("button[data-transform][data-target='sxSoapOutput']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const type = btn.dataset.transform;
      try {
        if (!sxSoapOutput.value.trim()) {
          alert("Generate a surgery SOAP first.");
          return;
        }
        logStatus(`Transforming surgery SOAP → ${type}…`);
        const data = await postJSON("toolbox", {
          mode: "soap-transform",
          transformType: type,
          sourceText: sxSoapOutput.value,
        });
        sxTransformOutput.value = data.result || "";
        logStatus("Transform ready.");
      } catch (err) {
        console.error(err);
        logStatus("Error transforming surgery SOAP.");
        alert("Error transforming SOAP. Check log.");
      }
    });
  });

  if (copySxTransformBtn) {
    copySxTransformBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sxTransformOutput.value || "");
        logStatus("Transformed surgery text copied.");
      } catch {
        alert("Could not copy transformed text.");
      }
    });
  }

  if (refineSxBtn) {
    refineSxBtn.addEventListener("click", async () => {
      try {
        const feedback = sxFeedbackInput?.value || "";
        if (!sxSoapOutput.value.trim()) {
          alert("Generate a surgery SOAP first.");
          return;
        }
        if (!feedback.trim()) {
          alert("Add some feedback / instructions first.");
          return;
        }
        logStatus("Refining surgery SOAP…");
        const data = await postJSON("feedback", {
          type: "soap-refine",
          mode: "surgery",
          original: sxSoapOutput.value,
          feedback,
        });
        sxSoapOutput.value = data.improved || sxSoapOutput.value;
        logStatus("Surgery SOAP refined.");
      } catch (err) {
        console.error(err);
        logStatus("Error refining surgery SOAP.");
        alert("Error refining surgery SOAP. Check log.");
      }
    });
  }
})();

// ===== Toolbox tab =====

(function setupToolbox() {
  const toolboxFiles = document.getElementById("toolboxFiles");
  const toolboxMode = document.getElementById("toolboxMode");
  const toolboxNotes = document.getElementById("toolboxNotes");
  const toolboxInput = document.getElementById("toolboxInput");
  const runBtn = document.getElementById("runToolboxBtn");

  const toolboxOutput = document.getElementById("toolboxOutput");
  const copyBtn = document.getElementById("copyToolboxOutputBtn");

  const feedbackInput = document.getElementById("toolboxFeedbackInput");
  const refineBtn = document.getElementById("refineToolboxBtn");

  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      try {
        logStatus("Running Toolbox…");
        const files = describeFiles(toolboxFiles);
        const data = await postJSON("toolbox", {
          mode: toolboxMode?.value || "bloodwork-summary",
          notes: toolboxNotes?.value || "",
          text: toolboxInput?.value || "",
          files,
        });
        toolboxOutput.value = data.result || "";
        logStatus("Toolbox output ready.");
      } catch (err) {
        console.error(err);
        logStatus("Error running Toolbox.");
        alert("Error running Toolbox. Check log.");
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(toolboxOutput.value || "");
        logStatus("Toolbox output copied.");
      } catch {
        alert("Could not copy Toolbox output.");
      }
    });
  }

  if (refineBtn) {
    refineBtn.addEventListener("click", async () => {
      try {
        const feedback = feedbackInput?.value || "";
        if (!toolboxOutput.value.trim()) {
          alert("Run the Toolbox first.");
          return;
        }
        if (!feedback.trim()) {
          alert("Add feedback / instructions first.");
          return;
        }
        logStatus("Refining Toolbox output…");
        const data = await postJSON("feedback", {
          type: "toolbox-refine",
          original: toolboxOutput.value,
          feedback,
        });
        toolboxOutput.value = data.improved || toolboxOutput.value;
        logStatus("Toolbox output refined.");
      } catch (err) {
        console.error(err);
        logStatus("Error refining Toolbox output.");
        alert("Error refining Toolbox output. Check log.");
      }
    });
  }
})();

// ===== Consult tab =====

(function setupConsult() {
  const consultFiles = document.getElementById("consultFiles");
  const consultQuestion = document.getElementById("consultQuestion");
  const runBtn = document.getElementById("runConsultBtn");
  const consultOutput = document.getElementById("consultOutput");
  const copyBtn = document.getElementById("copyConsultOutputBtn");

  const feedbackInput = document.getElementById("consultFeedbackInput");
  const refineBtn = document.getElementById("refineConsultBtn");

  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      try {
        logStatus("Sending consult…");
        const files = describeFiles(consultFiles);
        const data = await postJSON("consult", {
          question: consultQuestion?.value || "",
          files,
        });
        consultOutput.value = data.answer || "";
        logStatus("Consult answer ready.");
      } catch (err) {
        console.error(err);
        logStatus("Error getting consult answer.");
        alert("Error getting consult answer. Check log.");
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(consultOutput.value || "");
        logStatus("Consult answer copied.");
      } catch {
        alert("Could not copy consult answer.");
      }
    });
  }

  if (refineBtn) {
    refineBtn.addEventListener("click", async () => {
      try {
        const feedback = feedbackInput?.value || "";
        if (!consultOutput.value.trim()) {
          alert("Get a consult answer first.");
          return;
        }
        if (!feedback.trim()) {
          alert("Add feedback / instructions first.");
          return;
        }
        logStatus("Refining consult answer…");
        const data = await postJSON("feedback", {
          type: "consult-refine",
          original: consultOutput.value,
          feedback,
        });
        consultOutput.value = data.improved || consultOutput.value;
        logStatus("Consult answer refined.");
      } catch (err) {
        console.error(err);
        logStatus("Error refining consult answer.");
        alert("Error refining consult answer. Check log.");
      }
    });
  }
})();

// ===== Transfer tab =====

(function setupTransfer() {
  const fromPhone = document.getElementById("transferFromPhone");
  const scratch = document.getElementById("transferScratch");
  const copyFromPhoneBtn = document.getElementById("copyTransferFromPhoneBtn");
  const copyScratchBtn = document.getElementById("copyTransferScratchBtn");

  if (copyFromPhoneBtn) {
    copyFromPhoneBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fromPhone.value || "");
        logStatus("Transfer 'from phone' text copied.");
      } catch {
        alert("Could not copy text.");
      }
    });
  }

  if (copyScratchBtn) {
    copyScratchBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(scratch.value || "");
        logStatus("Transfer scratchpad text copied.");
      } catch {
        alert("Could not copy text.");
      }
    });
  }
})();
