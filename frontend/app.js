// Simple helper for status line
function setStatus(msg) {
  const el = document.getElementById("statusMessage");
  if (el) el.textContent = msg;
}

// Generic fetch wrapper for Netlify functions
async function callFunction(name, payload) {
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error calling ${name}`);
  }

  return res.json();
}

// Convert FileList -> base64 payload for vision
async function filesToBase64Payload(fileList) {
  if (!fileList || fileList.length === 0) return [];

  const promises = Array.from(fileList).map(
    (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const base64 = String(result).split(",")[1] || "";
          resolve({
            name: file.name,
            type: file.type || "application/octet-stream",
            data: base64,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
  );

  return Promise.all(promises);
}

// Ask backend to summarize attached images/docs
async function getVisionSummary(sharedFilesInput) {
  if (!sharedFilesInput) return null;
  if (!sharedFilesInput.files || sharedFilesInput.files.length === 0) return null;

  setStatus("Analyzing attachments with Vision...");
  const filesPayload = await filesToBase64Payload(sharedFilesInput.files);
  if (!filesPayload.length) return null;

  const response = await callFunction("vision", { files: filesPayload });
  const summary = response && response.summary ? response.summary : null;
  setStatus("Vision summary ready; generating output...");
  return summary;
}

// Tabs
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-button");
  const sections = {
    appointment: document.getElementById("appointmentSection"),
    surgery: document.getElementById("surgerySection"),
    toolbox: document.getElementById("toolboxSection"),
    consult: document.getElementById("consultSection"),
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab) return;

      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.keys(sections).forEach((key) => {
        if (sections[key]) {
          sections[key].classList.toggle(
            "section-visible",
            key === tab,
          );
          sections[key].classList.toggle(
            "section-hidden",
            key !== tab,
          );
        }
      });
    });
  });
}

// File summary line under the shared file input
function setupFileSummary() {
  const input = document.getElementById("sharedFiles");
  const summary = document.getElementById("fileSummary");
  if (!input || !summary) return;

  input.addEventListener("change", () => {
    if (!input.files || input.files.length === 0) {
      summary.textContent = "No files selected.";
      return;
    }
    const names = Array.from(input.files).map((f) => f.name);
    summary.textContent = `${input.files.length} file(s): ${names.join(", ")}`;
  });
}

// Appointment SOAP
function setupAppointment() {
  const sharedFiles = document.getElementById("sharedFiles");
  const generateBtn = document.getElementById("generateApptSoapBtn");
  const outputBox = document.getElementById("apptSoapOutput");
  const refineInput = document.getElementById("apptRefineInput");
  const refineBtn = document.getElementById("apptRefineBtn");
  const copyBtn = document.getElementById("apptCopyBtn");
  const transcriptBox = document.getElementById("apptTranscript");
  const useTranscript = document.getElementById("useTranscriptForAppt");

  if (!generateBtn) return;

  generateBtn.addEventListener("click", async () => {
    try {
      generateBtn.disabled = true;
      setStatus("Generating appointment SOAP...");

      const visionSummary = await getVisionSummary(sharedFiles);

      const payload = {
        mode: "appointment",
        action: "generate",
        fields: {
          reason: document.getElementById("apptReason")?.value || "",
          history: document.getElementById("apptHistory")?.value || "",
          pe: document.getElementById("apptPE")?.value || "",
          diagnostics: document.getElementById("apptDiagnostics")?.value || "",
          assessmentHints:
            document.getElementById("apptAssessmentHints")?.value || "",
          planHints: document.getElementById("apptPlanHints")?.value || "",
          medsHints: document.getElementById("apptMedsHints")?.value || "",
          transcript:
            useTranscript && useTranscript.checked && transcriptBox
              ? transcriptBox.value
              : "",
        },
        visionSummary: visionSummary || "",
      };

      const data = await callFunction("soap", payload);
      outputBox.value = data.output || "";
      setStatus("Appointment SOAP ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error generating appointment SOAP.");
    } finally {
      generateBtn.disabled = false;
    }
  });

  if (refineBtn && outputBox && refineInput) {
    refineBtn.addEventListener("click", async () => {
      try {
        refineBtn.disabled = true;
        setStatus("Refining appointment SOAP...");

        const payload = {
          mode: "appointment",
          action: "refine",
          existingOutput: outputBox.value || "",
          feedback: refineInput.value || "",
        };

        const data = await callFunction("soap", payload);
        outputBox.value = data.output || "";
        setStatus("Refined appointment SOAP ready.");
      } catch (err) {
        console.error(err);
        setStatus("Error refining appointment SOAP.");
      } finally {
        refineBtn.disabled = false;
      }
    });
  }

  if (copyBtn && outputBox) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(outputBox.value || "");
        setStatus("Appointment SOAP copied to clipboard.");
      } catch (err) {
        console.error(err);
        setStatus("Could not copy SOAP.");
      }
    });
  }
}

// Surgery SOAP
function setupSurgery() {
  const sharedFiles = document.getElementById("sharedFiles");
  const generateBtn = document.getElementById("generateSxSoapBtn");
  const outputBox = document.getElementById("sxSoapOutput");
  const refineInput = document.getElementById("sxRefineInput");
  const refineBtn = document.getElementById("sxRefineBtn");
  const copyBtn = document.getElementById("sxCopyBtn");

  if (!generateBtn) return;

  generateBtn.addEventListener("click", async () => {
    try {
      generateBtn.disabled = true;
      setStatus("Generating surgery SOAP...");

      const visionSummary = await getVisionSummary(sharedFiles);

      const payload = {
        mode: "surgery",
        action: "generate",
        fields: {
          reason: document.getElementById("sxReason")?.value || "",
          history: document.getElementById("sxHistory")?.value || "",
          pe: document.getElementById("sxPE")?.value || "",
          diagnostics: document.getElementById("sxDiagnostics")?.value || "",
          premed: document.getElementById("sxPremed")?.value || "",
          induction: document.getElementById("sxInduction")?.value || "",
          intraOp: document.getElementById("sxIntraOp")?.value || "",
          postOp: document.getElementById("sxPostOp")?.value || "",
          procedure: document.getElementById("sxProcedureNotes")?.value || "",
          recovery: document.getElementById("sxRecovery")?.value || "",
          medsDispensed: document.getElementById("sxMedsDispensed")?.value || "",
        },
        visionSummary: visionSummary || "",
      };

      const data = await callFunction("soap", payload);
      outputBox.value = data.output || "";
      setStatus("Surgery SOAP ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error generating surgery SOAP.");
    } finally {
      generateBtn.disabled = false;
    }
  });

  if (refineBtn && outputBox && refineInput) {
    refineBtn.addEventListener("click", async () => {
      try {
        refineBtn.disabled = true;
        setStatus("Refining surgery SOAP...");

        const payload = {
          mode: "surgery",
          action: "refine",
          existingOutput: outputBox.value || "",
          feedback: refineInput.value || "",
        };

        const data = await callFunction("soap", payload);
        outputBox.value = data.output || "";
        setStatus("Refined surgery SOAP ready.");
      } catch (err) {
        console.error(err);
        setStatus("Error refining surgery SOAP.");
      } finally {
        refineBtn.disabled = false;
      }
    });
  }

  if (copyBtn && outputBox) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(outputBox.value || "");
        setStatus("Surgery SOAP copied to clipboard.");
      } catch (err) {
        console.error(err);
        setStatus("Could not copy surgery SOAP.");
      }
    });
  }
}

// Toolbox
function setupToolbox() {
  const sharedFiles = document.getElementById("sharedFiles");
  const generateBtn = document.getElementById("toolboxGenerateBtn");
  const outputBox = document.getElementById("toolboxOutput");
  const refineInput = document.getElementById("toolboxRefineInput");
  const refineBtn = document.getElementById("toolboxRefineBtn");
  const copyBtn = document.getElementById("toolboxCopyBtn");

  if (!generateBtn) return;

  generateBtn.addEventListener("click", async () => {
    try {
      generateBtn.disabled = true;
      setStatus("Generating toolbox output...");

      const visionSummary = await getVisionSummary(sharedFiles);

      const payload = {
        action: "generate",
        tool: document.getElementById("toolboxMode")?.value || "bloodwork",
        text: document.getElementById("toolboxInput")?.value || "",
        visionSummary: visionSummary || "",
      };

      const data = await callFunction("toolbox", payload);
      outputBox.value = data.output || "";
      setStatus("Toolbox output ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error generating toolbox output.");
    } finally {
      generateBtn.disabled = false;
    }
  });

  if (refineBtn && outputBox && refineInput) {
    refineBtn.addEventListener("click", async () => {
      try {
        refineBtn.disabled = true;
        setStatus("Refining toolbox output...");

        const payload = {
          action: "refine",
          tool: document.getElementById("toolboxMode")?.value || "bloodwork",
          existingOutput: outputBox.value || "",
          feedback: refineInput.value || "",
        };

        const data = await callFunction("toolbox", payload);
        outputBox.value = data.output || "";
        setStatus("Refined toolbox output ready.");
      } catch (err) {
        console.error(err);
        setStatus("Error refining toolbox output.");
      } finally {
        refineBtn.disabled = false;
      }
    });
  }

  if (copyBtn && outputBox) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(outputBox.value || "");
        setStatus("Toolbox output copied to clipboard.");
      } catch (err) {
        console.error(err);
        setStatus("Could not copy toolbox output.");
      }
    });
  }
}

// Consult
function setupConsult() {
  const sharedFiles = document.getElementById("sharedFiles");
  const generateBtn = document.getElementById("consultGenerateBtn");
  const outputBox = document.getElementById("consultOutput");
  const refineInput = document.getElementById("consultRefineInput");
  const refineBtn = document.getElementById("consultRefineBtn");
  const copyBtn = document.getElementById("consultCopyBtn");

  if (!generateBtn) return;

  generateBtn.addEventListener("click", async () => {
    try {
      generateBtn.disabled = true;
      setStatus("Generating consult...");

      const visionSummary = await getVisionSummary(sharedFiles);

      const payload = {
        action: "generate",
        question: document.getElementById("consultQuestion")?.value || "",
        context: document.getElementById("consultContext")?.value || "",
        visionSummary: visionSummary || "",
      };

      const data = await callFunction("consult", payload);
      outputBox.value = data.output || "";
      setStatus("Consult output ready.");
    } catch (err) {
      console.error(err);
      setStatus("Error generating consult output.");
    } finally {
      generateBtn.disabled = false;
    }
  });

  if (refineBtn && outputBox && refineInput) {
    refineBtn.addEventListener("click", async () => {
      try {
        refineBtn.disabled = true;
        setStatus("Refining consult output...");

        const payload = {
          action: "refine",
          question: document.getElementById("consultQuestion")?.value || "",
          context: document.getElementById("consultContext")?.value || "",
          existingOutput: outputBox.value || "",
          feedback: refineInput.value || "",
        };

        const data = await callFunction("consult", payload);
        outputBox.value = data.output || "";
        setStatus("Refined consult output ready.");
      } catch (err) {
        console.error(err);
        setStatus("Error refining consult output.");
      } finally {
        refineBtn.disabled = false;
      }
    });
  }

  if (copyBtn && outputBox) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(outputBox.value || "");
        setStatus("Consult output copied to clipboard.");
      } catch (err) {
        console.error(err);
        setStatus("Could not copy consult output.");
      }
    });
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupFileSummary();
  setupAppointment();
  setupSurgery();
  setupToolbox();
  setupConsult();
});