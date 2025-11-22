:root {
  --bg: #020712;
  --bg-elevated: #081522;
  --bg-elevated-soft: #0c1c2c;
  --accent: #00e0b8;
  --accent-soft: rgba(0, 224, 184, 0.1);
  --accent-strong: #0df0c2;
  --danger: #ff4b6e;
  --text: #f8fbff;
  --text-soft: #a6b0c3;
  --border-soft: #1a2736;
  --radius-lg: 20px;
  --radius-md: 14px;
  --radius-pill: 999px;
  --shadow-soft: 0 24px 60px rgba(0, 0, 0, 0.65);
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: radial-gradient(circle at top left, #022440, #020712 55%);
  color: var(--text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

body {
  padding: 12px;
}

.page {
  max-width: 1120px;
  margin: 0 auto 64px;
}

/* HEADER */

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  background: radial-gradient(circle at top left, #11263a, #050a14);
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(255, 255, 255, 0.04);
  margin-bottom: 12px;
  gap: 16px;
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-logo {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  object-fit: contain;
  background: #020712;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
}

.app-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
}

.app-subtitle {
  font-size: 13px;
  color: var(--text-soft);
}

.app-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  border: 1px solid var(--border-soft);
  background: rgba(3, 15, 30, 0.9);
}

.status-pill--ready .status-dot {
  background: #1cf593;
}

.status-pill--error .status-dot {
  background: var(--danger);
}

.status-pill--unknown .status-dot {
  background: #f2c94c;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.version-pill {
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.04);
  font-size: 12px;
  color: var(--text-soft);
}

/* CARDS */

.card {
  background: linear-gradient(145deg, #050b15, #091625);
  border-radius: var(--radius-lg);
  padding: 16px 16px 18px;
  margin-top: 10px;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(255, 255, 255, 0.02);
}

.card-main {
  margin-top: 14px;
}

.card-header-row,
.tab-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.card-tag {
  font-size: 12px;
  color: var(--text-soft);
}

.card-note {
  font-size: 12px;
  color: var(--text-soft);
  margin-top: 4px;
}

/* ATTACHMENTS */

.card-attachments .attachments-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.file-input-label {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  border: 1px solid var(--accent);
  background: radial-gradient(circle at top left, var(--accent-soft), #050b15);
  cursor: pointer;
}

.file-input-label input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-input-label--large {
  width: 100%;
  padding: 16px 14px;
  border-radius: 24px;
  border-style: dashed;
  text-align: center;
}

.attachments-summary {
  font-size: 12px;
  color: var(--text-soft);
}

/* RECORDER */

.card-recorder .recorder-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}

.recorder-main {
  flex: 1 1 180px;
}

.recorder-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.recorder-status {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-soft);
}

/* TABS */

.tabs {
  display: inline-flex;
  background: #050a14;
  border-radius: var(--radius-pill);
  padding: 3px;
  margin-bottom: 10px;
  border: 1px solid var(--border-soft);
}

.tab-button {
  border: none;
  background: transparent;
  color: var(--text-soft);
  padding: 6px 16px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  cursor: pointer;
}

.tab-button--active {
  background: radial-gradient(circle at top left, var(--accent), var(--accent-strong));
  color: #041018;
  font-weight: 600;
}

.tab-content {
  display: none;
  margin-top: 8px;
}

.tab-content--active {
  display: block;
}

/* FORM ELEMENTS */

.field {
  margin-bottom: 10px;
}

.field-label {
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--text-soft);
}

.text-input,
.select-input,
.text-area {
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  background: #040916;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.text-input:focus,
.select-input:focus,
.text-area:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(0, 224, 184, 0.35);
}

.text-area {
  min-height: 80px;
  resize: vertical;
}

.text-area--output {
  min-height: 140px;
}

.helper-text {
  font-size: 11px;
  color: var(--text-soft);
  margin-top: 2px;
}

.checkbox-field {
  margin-top: 4px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.checkbox-label input {
  accent-color: var(--accent);
}

/* GRID */

.grid {
  display: grid;
  gap: 8px;
}

.grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field--inline-btn {
  display: flex;
  align-items: flex-end;
}

/* SEGMENTED CONTROL */

.segmented-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 12px;
}

.segmented-group {
  min-width: 0;
}

.segmented {
  display: inline-flex;
  border-radius: var(--radius-pill);
  padding: 3px;
  background: #050a14;
  border: 1px solid var(--border-soft);
}

.segmented-btn {
  border: none;
  background: transparent;
  color: var(--text-soft);
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  cursor: pointer;
}

.segmented-btn--active {
  background: radial-gradient(circle at top left, var(--accent), var(--accent-strong));
  color: #041018;
  font-weight: 600;
}

/* FIELDSETS */

.fieldset {
  margin-top: 10px;
  padding: 10px 10px 12px;
  border-radius: 16px;
  background: #050a14;
  border: 1px solid var(--border-soft);
}

.fieldset-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.fieldset-relay {
  margin-top: 16px;
}

.chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-soft);
}

.chip--muted {
  opacity: 0.7;
}

/* BUTTONS */

.btn {
  border-radius: var(--radius-pill);
  padding: 8px 16px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: #031118;
  font-weight: 600;
  margin-top: 8px;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-soft);
  color: var(--text-soft);
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.output-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

/* RELAY */

.relay-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

/* MODAL */

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background: #050b15;
  border-radius: 20px;
  padding: 18px 18px 16px;
  max-width: 360px;
  width: 100%;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-message {
  font-size: 14px;
  margin-bottom: 12px;
}

.modal-close-btn {
  width: 100%;
}

/* OUTPUT CARD */

.card-output {
  margin-top: 14px;
}

/* RESPONSIVE */

@media (max-width: 780px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .app-header-right {
    align-self: stretch;
    justify-content: space-between;
  }

  .grid-2,
  .grid-3 {
    grid-template-columns: minmax(0, 1fr);
  }

  .segmentized-row,
  .segmented-row {
    flex-direction: column;
  }

  .output-buttons {
    flex-direction: column;
  }

  .relay-buttons {
    flex-direction: column;
  }

  .recorder-row {
    flex-direction: column;
  }
}
