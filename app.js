"use strict";

// ---------- TAB SWITCHING ----------
(function () {
  var tabs = document.querySelectorAll(".tab");
  var panels = {
    appointment: document.getElementById("tab-appointment"),
    surgery: document.getElementById("tab-surgery"),
    freeform: document.getElementById("tab-freeform"),
    toolbox: document.getElementById("tab-toolbox")
  };

  function showTab(name) {
    for (var key in panels) {
      if (!panels.hasOwnProperty(key)) continue;
      var panel = panels[key];
      if (!panel) continue;
      panel.style.display = key === name ? "block" : "none";
    }
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.getAttribute("data-tab") === name) t.classList.add("active");
      else t.classList.remove("active");
    }
  }

  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function () {
      var name = this.getAttribute("data-tab");
      if (name) showTab(name);
    });
  }

  showTab("appointment");
})();

// ---------- SURGERY TEMPLATE HINTS + FLUIDS DISABLE ----------
(function () {
  var select = document.getElementById("sxTemplate");
  var hintEl = document.getElementById("sxTemplateHint");
  var fluidsDeclined = document.getElementById("sxFluidsDeclined");
  var fluidsRate = document.getElementById("sxFluidsRate");

  if (!select || !hintEl) return;

  var hints = {
    "canine-spay-standard":
      "Canine spay – clinic: standard OVH, linea alba approach; 2–0 Monocryl for body wall/SQ, 3–0 intradermal skin unless overrides used.",
    "canine-spay-rescue":
      "Canine spay – rescue: as clinic spay, plus ensure rescue notes/tattoo documented in Avimark (no ID numbers in SOAP).",
    "canine-neuter-standard":
      "Canine neuter – clinic: prescrotal approach; default 2–0 Monocryl (<35 kg) or 0 Monocryl (>35 kg) unless overridden.",
    "canine-neuter-rescue":
      "Canine neuter – rescue: as standard neuter; mention tattoo/ear notch if performed; rescue identifiers only in Avimark.",
    "feline-spay-standard":
      "Feline spay – clinic: midline or flank per clinic preference; mention approach in Procedure notes if relevant.",
    "feline-spay-rescue":
      "Feline spay – rescue: often flank with ear tip; note ear tip and rescue status.",
    "feline-neuter-standard":
      "Feline neuter – clinic: scrotal castration; note if incisions left open vs closed.",
    "feline-neuter-rescue":
      "Feline neuter – rescue: similar to clinic; mention ear tip if done.",
    "dental-cohat":
      "Dental – COHAT: full-mouth rads unless declined, subgingival scaling, polishing, charting, nerve blocks, extractions as needed per AAHA/AVDC.",
    "dental-cohat-no-rads":
      "Dental – COHAT (no rads): chart thoroughly and document that radiographs were declined; extractions still per AAHA/AVDC.",
    "mass-removal":
      "Mass removal: include location, size, margins, closure pattern, drain use, and histopathology yes/no.",
    "other":
      "Custom procedure: be explicit in Procedure notes about approach, findings, closure, complications."
  };

  function updateHint() {
    var key = select.value;
    hintEl.textContent = hints[key] || "Custom procedure – fill in details below.";
  }

  select.addEventListener("change", updateHint);
  updateHint();

  // fluidsDeclined disables rate field
  function updateFluidsState() {
    if (!fluidsRate) return;
    if (fluidsDeclined && fluidsDeclined.checked) {
      fluidsRate.disabled = true;
      fluidsRate.placeholder = "Fluids declined";
    } else {
      fluidsRate.disabled = false;
      fluidsRate.placeholder = "e.g., 5 ml/kg/hr dogs, 3 ml/kg/hr cats";
    }
  }
  if (fluidsDeclined) {
    fluidsDeclined.addEventListener("change", updateFluidsState);
    updateFluidsState();
  }
})();

// ---------- COMMON HELPERS ----------
var statusEl = document.getElementById("queryStatus");
var lastSoapPayload = null;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function callBackend(mode, payload) {
  setStatus("Working...");
  return fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: mode, payload: payload })
  })
    .then(function (resp) {
      if (!resp.ok) {
        setStatus("Error from server.");
        throw new Error("Server error");
      }
      return resp.json();
    })
    .then(function (data) {
      setStatus("Ready.");
      return data.result || "";
    })
    .catch(function (err) {
      console.error(err);
      setStatus("Error from server.");
      throw err;
    });
}

function splitSoapIntoSections(text) {
  var sections = {
    "Subjective": "",
    "Objective": "",
    "Assessment": "",
    "Plan": "",
    "Medications Dispensed": "",
    "Aftercare": ""
  };

  var current = null;
  var lines = (text || "").split(/\r?\n/);

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (/^Subjective:/i.test(trimmed)) { current = "Subjective"; continue; }
    if (/^Objective:/i.test(trimmed)) { current = "Objective"; continue; }
    if (/^Assessment:/i.test(trimmed)) { current = "Assessment"; continue; }
    if (/^Plan:/i.test(trimmed)) { current = "Plan"; continue; }
    if (/^Medications Dispensed:/i.test(trimmed)) { current = "Medications Dispensed"; continue; }
    if (/^Aftercare:/i.test(trimmed)) { current = "Aftercare"; continue; }

    if (!current) continue;
    sections[current] += (sections[current] ? "\n" : "") + line;
  }

  // Fallback: if parsing failed, dump everything into Subjective
  var anyContent = false;
  for (var key in sections) {
    if (!sections.hasOwnProperty(key)) continue;
    if (sections[key] && sections[key].trim()) {
      anyContent = true;
      break;
    }
  }
  if (!anyContent && text && text.trim()) {
    sections["Subjective"] = text.trim();
  }

  return sections;
}

function renderSoapSections(sections) {
  var map = {
    subjectiveOutput: "Subjective",
    objectiveOutput: "Objective",
    assessmentOutput: "Assessment",
    planOutput: "Plan",
    medsOutput: "Medications Dispensed",
    aftercareOutput: "Aftercare"
  };
  for (var id in map) {
    if (!map.hasOwnProperty(id)) continue;
    var name = map[id];
    var el = document.getElementById(id);
    if (el) el.textContent = sections[name] || "";
  }
  var card = document.getElementById("soapOutputCard");
  var fb = document.getElementById("feedbackBar");
  if (card) card.style.display = "block";
  if (fb) fb.style.display = "block";

  updateFeedbackBarText(lastSoapPayload);
}

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function () {});
  }
}

// ---------- FEEDBACK BAR HELPER ----------
function updateFeedbackBarText(payload) {
  var fbText = document.getElementById("feedbackText");
  if (!fbText || !payload) return;

  var missing = [];
  if (payload.soapType === "surgery") {
    var f = payload.fields || {};
    if (!f.template) missing.push("choose template");
    if (!f.asa) missing.push("ASA");
    if (!f.ett) missing.push("ET tube size");
    if (!f.catheter) missing.push("IV catheter");
    if (!f.fluidsDeclined && !f.fluidsRate) missing.push("fluids rate");
    if (!f.premeds) missing.push("premeds");
    if (!f.induction) missing.push("induction/maintenance");
    if (!f.procedureNotes) missing.push("procedure notes");
  } else if (payload.soapType === "appointment") {
    var a = payload.fields || {};
    if (!a.reason) missing.push("reason for visit");
    if (!a.history) missing.push("history");
    if (!a.physicalExam) missing.push("PE data");
    if (!a.diagnostics) missing.push("diagnostics");
    if (!a.assessment) missing.push("assessment");
    if (!a.plan) missing.push("plan");
    // meds optional
  }

  if (!missing.length) {
    fbText.textContent = " This looks pretty complete. Add any small details and hit Refine if you like.";
    return;
  }

  var top = missing.slice(0, 4).join(", ");
  fbText.textContent = " Most helpful extra details next: " + top + ".";
}

// ---------- APPOINTMENT ----------
var genApptBtn = document.getElementById("generateAppointmentBtn");
if (genApptBtn) {
  genApptBtn.addEventListener("click", function () {
    var caseLabel = (document.getElementById("caseLabel").value || "").trim();
    var accuracyMode = document.getElementById("accuracyMode").value || "help";
    var strictMode = accuracyMode === "strict";

    var fields = {
      reason: document.getElementById("apptReason").value,
      tpr: document.getElementById("apptTPR").value,
      history: document.getElementById("apptHistory").value,
      physicalExam: document.getElementById("apptPE").value,
      diagnostics: document.getElementById("apptDiagnostics").value,
      assessment: document.getElementById("apptAssessment").value,
      plan: document.getElementById("apptPlan").value,
      meds: document.getElementById("apptMeds").value
    };

    var payload = {
      soapType: "appointment",
      strictMode: strictMode,
      caseLabel: caseLabel,
      fields: fields,
      refinementNote: null
    };
    lastSoapPayload = payload;

    callBackend("soap", payload).then(function (text) {
      var sections = splitSoapIntoSections(text);
      renderSoapSections(sections);
    });
  });
}

// ---------- SURGERY ----------
var genSxBtn = document.getElementById("generateSurgeryBtn");
if (genSxBtn) {
  genSxBtn.addEventListener("click", function () {
    var caseLabel = (document.getElementById("caseLabel").value || "").trim();
    var accuracyMode = document.getElementById("accuracyMode").value || "help";
    var strictMode = accuracyMode === "strict";

    var fields = {
      template: document.getElementById("sxTemplate").value,
      asa: document.getElementById("sxASA").value,
      ett: document.getElementById("sxETT").value,
      catheter: document.getElementById("sxCatheter").value,
      fluidsRate: document.getElementById("sxFluidsRate").value,
      fluidsDeclined: document.getElementById("sxFluidsDeclined").checked,
      premeds: document.getElementById("sxPremeds").value,
      induction: document.getElementById("sxInduction").value,
      intraOpMeds: document.getElementById("sxIntraOpMeds").value,
      procedureNotes: document.getElementById("sxProcedureNotes").value,
      monocryl0: document.getElementById("sxMonocryl0").checked,
      monocryl2_0: document.getElementById("sxMonocryl2_0").checked,
      monocryl3_0: document.getElementById("sxMonocryl3_0").checked,
      tpr: document.getElementById("sxTPR").value,
      durations: document.getElementById("sxDurations").value
    };

    var payload = {
      soapType: "surgery",
      strictMode: strictMode,
      caseLabel: caseLabel,
      fields: fields,
      refinementNote: null
    };
    lastSoapPayload = payload;

    callBackend("soap", payload).then(function (text) {
      var sections = splitSoapIntoSections(text);
      renderSoapSections(sections);
    });
  });
}

// ---------- REFINE ----------
var refineBtn = document.getElementById("refineBtn");
if (refineBtn) {
  refineBtn.addEventListener("click", function () {
    if (!lastSoapPayload) return;
    var note = document.getElementById("refineNote").value.trim();
    var payload = JSON.parse(JSON.stringify(lastSoapPayload));
    payload.refinementNote = note || "(no extra details provided)";
    callBackend("soap", payload).then(function (text) {
      var sections = splitSoapIntoSections(text);
      renderSoapSections(sections);
    });
  });
}

// ---------- COPY BUTTONS ----------
window.copySection = function (name) {
  var idMap = {
    "Subjective": "subjectiveOutput",
    "Objective": "objectiveOutput",
    "Assessment": "assessmentOutput",
    "Plan": "planOutput",
    "Medications Dispensed": "medsOutput",
    "Aftercare": "aftercareOutput"
  };
  var id = idMap[name];
  if (!id) return;
  var el = document.getElementById(id);
  var text = el ? el.textContent : "";
  copyToClipboard(text);
};

var copyFullBtn = document.getElementById("copyFullSoapBtn");
if (copyFullBtn) {
  copyFullBtn.addEventListener("click", function () {
    var s = document.getElementById("subjectiveOutput").textContent;
    var o = document.getElementById("objectiveOutput").textContent;
    var a = document.getElementById("assessmentOutput").textContent;
    var p = document.getElementById("planOutput").textContent;
    var m = document.getElementById("medsOutput").textContent;
    var ac = document.getElementById("aftercareOutput").textContent;
    var full = [
      "Subjective:",
      s,
      "",
      "Objective:",
      o,
      "",
      "Assessment:",
      a,
      "",
      "Plan:",
      p,
      "",
      "Medications Dispensed:",
      m,
      "",
      "Aftercare:",
      ac
    ].join("\n");
    copyToClipboard(full);
  });
}

var copyPMA = document.getElementById("copyPlanMedsAftercareBtn");
if (copyPMA) {
  copyPMA.addEventListener("click", function () {
    var p = document.getElementById("planOutput").textContent;
    var m = document.getElementById("medsOutput").textContent;
    var ac = document.getElementById("aftercareOutput").textContent;
    var combo = [
      "Plan:",
      p,
      "",
      "Medications Dispensed:",
      m,
      "",
      "Aftercare:",
      ac
    ].join("\n");
    copyToClipboard(combo);
  });
}

// ---------- CONSULT ----------
var runConsultBtn = document.getElementById("runConsultBtn");
if (runConsultBtn) {
  runConsultBtn.addEventListener("click", function () {
    var text = (document.getElementById("consultInput").value || "").trim();
    if (!text) return;
    callBackend("consult", { message: text }).then(function (out) {
      var body = document.getElementById("consultOutput");
      var sec = document.getElementById("consultOutputSection");
      if (body) body.textContent = out;
      if (sec) sec.style.display = "block";
    });
  });
}

// ---------- TOOLBOX: BLOODWORK ----------
var runBwHelperBtn = document.getElementById("runBwHelperBtn");
if (runBwHelperBtn) {
  runBwHelperBtn.addEventListener("click", function () {
    var text = (document.getElementById("bwText").value || "").trim();
    if (!text) return;
    var detailLevel = document.getElementById("bwDetail").value;
    var includeDiffs = document.getElementById("bwDiffs").checked;
    var includeClientFriendly = document.getElementById("bwClientFriendly").checked;

    callBackend("toolbox-bloodwork", {
      text: text,
      detailLevel: detailLevel,
      includeDiffs: includeDiffs,
      includeClientFriendly: includeClientFriendly
    }).then(function (out) {
      var body = document.getElementById("bwOutput");
      var sec = document.getElementById("bwOutputSection");
      if (body) body.textContent = out;
      if (sec) sec.style.display = "block";
    });
  });
}

// ---------- TOOLBOX: EMAIL ----------
var runEmailHelperBtn = document.getElementById("runEmailHelperBtn");
if (runEmailHelperBtn) {
  runEmailHelperBtn.addEventListener("click", function () {
    var payload = {
      emailType: document.getElementById("emailType").value,
      petName: document.getElementById("emailPetName").value,
      ownerName: document.getElementById("emailOwnerName").value,
      timeframe: document.getElementById("emailTimeframe").value,
      notes: document.getElementById("emailNotes").value
    };
    callBackend("toolbox-email", payload).then(function (out) {
      var body = document.getElementById("emailOutput");
      var sec = document.getElementById("emailOutputSection");
      if (body) body.textContent = out;
      if (sec) sec.style.display = "block";
    });
  });
}

// ---------- MIC BUBBLE ----------
var micBubble = document.getElementById("micBubble");
var lastFocusedElement = null;

document.addEventListener("focusin", function (e) {
  var t = e.target;
  if (!t) return;
  if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") {
    lastFocusedElement = t;
  }
});

function initMicBubble() {
  if (!micBubble) return;
  var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (isiOS || !SpeechRecognition) {
    micBubble.addEventListener("click", function () {
      alert(
        "On iPhone/iPad, use the keyboard mic to dictate into the focused box. Browser speech recognition is not supported."
      );
    });
    return;
  }

  var recognition = new SpeechRecognition();
  recognition.lang = "en-CA";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  var listening = false;

  recognition.addEventListener("result", function (event) {
    var transcript = event.results[0][0].transcript;
    if (!lastFocusedElement) return;
    var el = lastFocusedElement;
    var start = el.selectionStart || el.value.length;
    var end = el.selectionEnd || el.value.length;
    var before = el.value.slice(0, start);
    var after = el.value.slice(end);
    el.value =
      before +
      (before ? " " : "") +
      transcript +
      (after ? " " + after : "");
  });

  recognition.addEventListener("end", function () {
    listening = false;
    micBubble.classList.remove("listening");
  });

  micBubble.addEventListener("click", function () {
    if (listening) {
      recognition.stop();
      return;
    }
    listening = true;
    micBubble.classList.add("listening");
    recognition.start();
  });
}

initMicBubble();

// ---------- QR CODE FOR APP URL ----------
(function () {
  var img = document.getElementById("qrImage");
  if (!img) return;
  var url = window.location.href.split("#")[0];
  var qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" +
    encodeURIComponent(url);
  img.src = qrUrl;
})();