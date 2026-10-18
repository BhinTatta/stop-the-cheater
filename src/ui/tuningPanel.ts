import {
  TUNING_FIELDS,
  clearSavedTuning,
  aspectBlend,
  isAutoTuning,
  onTuningChange,
  resetTuning,
  saveTuning,
  setTuning,
  tuning,
  tuningLink,
  type TuningField,
  type TuningKey,
} from "../scene/tuning";

/**
 * On-screen tuning harness: drag the scene into the framing that actually
 * looks right on the device in hand, read the numbers off the screen, and
 * paste them back so they can become the baked-in defaults.
 *
 * Only mounted when the harness is wanted (`?tune=1`, or a dev-server
 * run) — see tuningEnabled(). It deliberately prints its state as plain
 * text as well as copying it, because a phone on a LAN dev server has no
 * clipboard API (non-secure origin) and a screenshot has to be enough.
 */

/** What the scene reports back for the readout — the numbers that explain clipping. */
export interface TuningDiagnostics {
  widthPx: number;
  heightPx: number;
  aspect: number;
  frustum: number;
  /** Worst |NDC| across every idle home slot: > 1 means that slot is off-screen. */
  worstX: number;
  worstY: number;
  /** Labels of anything currently outside the frame. */
  clipped: string[];
  /** Per-frame renderer cost — bank depth multiplies this hard. */
  drawCalls: number;
  triangles: number;
}

export interface TuningPanel {
  setDiagnostics(d: TuningDiagnostics): void;
  destroy(): void;
}

const PANEL_CSS = `
#tune-fab {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  z-index: 50;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 10px;
  background: rgba(10, 26, 34, 0.72);
  color: #eaf7ff;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(4px);
}
#tune-fab[data-dirty="1"] { border-color: #ffc145; color: #ffc145; }
#tune-panel {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  z-index: 51;
  width: min(300px, calc(100vw - 20px));
  max-height: min(78vh, 680px);
  overflow-y: auto;
  touch-action: pan-y;
  padding: 10px 12px 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  background: rgba(8, 22, 30, 0.92);
  color: #eaf7ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.35;
  backdrop-filter: blur(6px);
  -webkit-overflow-scrolling: touch;
}
#tune-panel[hidden], #tune-fab[hidden] { display: none; }
.tune-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.tune-head strong { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #9fc4d1; }
.tune-head button { width: 24px; height: 24px; border: 0; border-radius: 6px; background: rgba(255,255,255,0.1); color: #eaf7ff; cursor: pointer; font-size: 13px; }
.tune-group { margin: 9px 0 2px; color: #ffc145; letter-spacing: 0.05em; text-transform: uppercase; font-size: 10px; }
.tune-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 6px; align-items: center; margin-bottom: 5px; }
.tune-row label { color: #cfe6ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tune-row .tune-hint { color: #6d8b97; }
.tune-row input[type="number"] { width: 58px; padding: 2px 4px; border: 1px solid rgba(255,255,255,0.16); border-radius: 5px; background: rgba(0,0,0,0.35); color: #fff; font: inherit; text-align: right; }
.tune-row input[type="range"] { grid-column: 1 / -1; width: 100%; height: 22px; margin: 0; accent-color: #ffc145; }
.tune-readout { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.14); color: #9fc4d1; white-space: pre-line; }
.tune-readout b { color: #eaf7ff; font-weight: 600; }
.tune-readout .bad { color: #ff7a9c; }
.tune-readout .good { color: #86e0a8; }
.tune-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.tune-actions button { flex: 1 1 auto; padding: 7px 8px; border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; background: rgba(255,255,255,0.08); color: #eaf7ff; font: inherit; cursor: pointer; }
.tune-actions button.primary { background: #ffc145; border-color: #ffc145; color: #3a2600; font-weight: 700; }
#tune-text { width: 100%; height: 118px; margin-top: 8px; padding: 6px; border: 1px solid rgba(255,255,255,0.16); border-radius: 7px; background: rgba(0,0,0,0.4); color: #eaf7ff; font: inherit; resize: vertical; }
`;

function fmt(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return value.toFixed(decimals);
}

export function createTuningPanel(container: HTMLElement): TuningPanel {
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.id = "tune-fab";
  fab.type = "button";
  fab.title = "Tuning harness";
  fab.textContent = "⚙";
  container.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "tune-panel";
  panel.hidden = true;
  container.appendChild(panel);

  const head = document.createElement("div");
  head.className = "tune-head";
  head.innerHTML = "<strong>Tuning</strong>";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.title = "Close";
  head.appendChild(closeBtn);
  panel.appendChild(head);

  const numberInputs = new Map<TuningKey, HTMLInputElement>();
  const rangeInputs = new Map<TuningKey, HTMLInputElement>();

  function addRow(field: TuningField): void {
    const row = document.createElement("div");
    row.className = "tune-row";

    const label = document.createElement("label");
    label.textContent = field.label;
    if (field.hint) {
      const hint = document.createElement("span");
      hint.className = "tune-hint";
      hint.textContent = ` ${field.hint}`;
      label.appendChild(hint);
    }

    const number = document.createElement("input");
    number.type = "number";
    number.min = String(field.min);
    number.max = String(field.max);
    number.step = String(field.step);
    number.value = fmt(tuning[field.key], field.step);
    number.id = `tune-num-${field.key}`;
    label.htmlFor = number.id;

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(field.min);
    range.max = String(field.max);
    range.step = String(field.step);
    range.value = String(tuning[field.key]);
    range.setAttribute("aria-label", field.label);

    range.addEventListener("input", () => commit(field, Number(range.value)));
    number.addEventListener("change", () => commit(field, Number(number.value)));

    row.append(label, number, range);
    panel.appendChild(row);
    numberInputs.set(field.key, number);
    rangeInputs.set(field.key, range);
  }

  let lastGroup = "";
  TUNING_FIELDS.forEach((field) => {
    if (field.group !== lastGroup) {
      const heading = document.createElement("div");
      heading.className = "tune-group";
      heading.textContent = field.group;
      panel.appendChild(heading);
      lastGroup = field.group;
    }
    addRow(field);
  });

  const readout = document.createElement("div");
  readout.className = "tune-readout";
  readout.textContent = "measuring…";
  panel.appendChild(readout);

  const actions = document.createElement("div");
  actions.className = "tune-actions";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "primary";
  copyBtn.textContent = "Copy numbers";
  const linkBtn = document.createElement("button");
  linkBtn.type = "button";
  linkBtn.textContent = "Copy link";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.textContent = "Reset";
  actions.append(copyBtn, linkBtn, resetBtn);
  panel.appendChild(actions);

  const textBox = document.createElement("textarea");
  textBox.id = "tune-text";
  textBox.readOnly = true;
  textBox.spellcheck = false;
  panel.appendChild(textBox);

  let diagnostics: TuningDiagnostics | null = null;

  function commit(field: TuningField, value: number): void {
    setTuning(field.key, value);
    saveTuning();
  }

  function syncInputs(): void {
    TUNING_FIELDS.forEach((field) => {
      const value = tuning[field.key];
      const number = numberInputs.get(field.key)!;
      const range = rangeInputs.get(field.key)!;
      const text = fmt(value, field.step);
      if (document.activeElement !== number && number.value !== text) number.value = text;
      if (range.value !== String(value)) range.value = String(value);
    });
    fab.dataset.dirty = isAutoTuning() ? "0" : "1";
  }

  /** Which end of the aspect range these numbers belong to. */
  function presetLabel(aspect: number): string {
    const t = aspectBlend(aspect);
    const end = t <= 0.02 ? "portrait preset" : t >= 0.98 ? "landscape preset" : "between presets";
    return `${end} (t ${t.toFixed(2)})${isAutoTuning() ? "" : ", hand-set"}`;
  }

  /** The block the harness exists to produce — paste this back verbatim. */
  function reportText(): string {
    const lines = ["stop-the-cheater tuning"];
    if (diagnostics) {
      lines.push(
        `# ${diagnostics.widthPx}x${diagnostics.heightPx}px · aspect ${diagnostics.aspect.toFixed(3)} · frustum ${diagnostics.frustum.toFixed(2)}`,
        `# ${presetLabel(diagnostics.aspect)}`,
        `# fit x ${diagnostics.worstX.toFixed(2)} y ${diagnostics.worstY.toFixed(2)}${diagnostics.clipped.length ? ` · CLIPPED: ${diagnostics.clipped.join(", ")}` : " · ok"}`,
        `# ${diagnostics.drawCalls} draw calls · ${diagnostics.triangles} tris`,
      );
    }
    let group = "";
    TUNING_FIELDS.forEach((field) => {
      if (field.group !== group) {
        lines.push(`# ${field.group}`);
        group = field.group;
      }
      lines.push(`${field.key}: ${fmt(tuning[field.key], field.step)}`);
    });
    return lines.join("\n");
  }

  function refreshReadout(): void {
    if (!diagnostics) return;
    const { widthPx, heightPx, aspect, frustum, worstX, worstY, clipped } = diagnostics;
    const verdict = clipped.length
      ? `<span class="bad">clipped: ${clipped.join(", ")}</span>`
      : `<span class="good">everyone fits</span>`;
    readout.innerHTML =
      `<b>${widthPx}×${heightPx}</b>px · aspect <b>${aspect.toFixed(3)}</b> · frustum <b>${frustum.toFixed(2)}</b>\n` +
      `${presetLabel(aspect)}\n` +
      `widest point: x <b>${worstX.toFixed(2)}</b> y <b>${worstY.toFixed(2)}</b> (1.00 = frame edge)\n` +
      `<b>${diagnostics.drawCalls}</b> draw calls · <b>${(diagnostics.triangles / 1000).toFixed(1)}k</b> tris\n${verdict}`;
    textBox.value = reportText();
  }

  async function copy(text: string, button: HTMLButtonElement, label: string): Promise<void> {
    const original = label;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Non-secure origin (a phone on the LAN dev server) has no clipboard
      // API — fall back to selecting the text so it can be copied by hand.
      textBox.value = text;
      textBox.focus();
      textBox.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    button.textContent = ok ? "Copied ✓" : "Select & copy ↓";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  }

  copyBtn.addEventListener("click", () => void copy(reportText(), copyBtn, "Copy numbers"));
  linkBtn.addEventListener("click", () => void copy(tuningLink(), linkBtn, "Copy link"));
  resetBtn.addEventListener("click", () => {
    resetTuning();
    clearSavedTuning();
  });

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    fab.hidden = open;
    if (open) refreshReadout();
  }
  fab.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));

  onTuningChange(() => {
    syncInputs();
    refreshReadout();
  });
  syncInputs();

  return {
    setDiagnostics(d: TuningDiagnostics): void {
      diagnostics = d;
      if (!panel.hidden) refreshReadout();
    },
    destroy(): void {
      fab.remove();
      panel.remove();
      style.remove();
    },
  };
}
