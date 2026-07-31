(() => {
  "use strict";

  /* ============================================================
     Shared helpers
     ============================================================ */

  // Live-typing display: adds thousand separators to the integer
  // part while preserving whatever decimal digits (including
  // trailing zeros / a trailing dot) the user actually typed.
  function formatLive(raw) {
    if (raw === "" || raw === "-") return raw;
    const neg = raw.startsWith("-");
    let s = neg ? raw.slice(1) : raw;
    const dotIndex = s.indexOf(".");
    let intPart = dotIndex === -1 ? s : s.slice(0, dotIndex);
    const decPart = dotIndex === -1 ? "" : s.slice(dotIndex);
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + intPart + decPart;
  }

  // Comma-grouped display of a finished number (not mid-typing).
  function fmtDisplay(n, maxDecimals = 10) {
    if (!isFinite(n)) return "Error";
    if (Object.is(n, -0)) n = 0;
    return n.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
  }

  // Plain numeric string (no commas), trimmed of noise trailing zeros,
  // used internally as the "raw entry" representation.
  function fmtPlain(n, maxDecimals = 10) {
    if (!isFinite(n)) return "Error";
    if (Object.is(n, -0)) n = 0;
    let s = n.toFixed(maxDecimals);
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "" || s === "-" ? "0" : s;
  }

  function stripCommas(str) {
    return (str || "").replace(/,/g, "");
  }

  function shrinkClassFor(text) {
    const len = text.replace(/[,.\-]/g, "").length;
    if (len > 15) return "shrink-3";
    if (len > 11) return "shrink-2";
    if (len > 8) return "shrink-1";
    return "";
  }

  function applyShrink(el, baseClasses) {
    el.classList.remove("shrink-1", "shrink-2", "shrink-3");
    const cls = shrinkClassFor(el.textContent);
    if (cls) el.classList.add(cls);
  }

  /* ============================================================
     Theme (remembered across refreshes)
     ============================================================ */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");

  const savedTheme = localStorage.getItem("calc-theme");
  if (savedTheme === "dark") {
    root.setAttribute("data-theme", "dark");
    themeToggle.setAttribute("aria-pressed", "true");
  }

  themeToggle.addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    themeToggle.setAttribute("aria-pressed", String(!isDark));
    localStorage.setItem("calc-theme", next);
  });

  /* ============================================================
     Mode switching
     ============================================================ */
  const modeSwitch = document.querySelector(".mode-switch");
  const modeButtons = document.querySelectorAll(".mode-btn");
  const calcPanel = document.getElementById("calcPanel");
  const templatePanel = document.getElementById("templatePanel");
  const appEl = document.getElementById("app");

  document.body.setAttribute("data-mode", "calc");

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;

      modeButtons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      modeSwitch.setAttribute("data-active", mode);
      document.body.setAttribute("data-mode", mode);

      const showCalc = mode === "calc";
      calcPanel.classList.toggle("is-active", showCalc);
      calcPanel.setAttribute("aria-hidden", String(!showCalc));
      templatePanel.classList.toggle("is-active", !showCalc);
      templatePanel.setAttribute("aria-hidden", String(showCalc));

      if (!showCalc) {
        originalInput.focus();
      }
    });
  });

  /* ============================================================
     Calculator history
     ============================================================ */
  const historyToggle = document.getElementById("historyToggle");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const historyClearBtn = document.getElementById("historyClear");

  let history = [];
  try { history = JSON.parse(localStorage.getItem("calc-history") || "[]"); } catch { history = []; }

  function saveHistory() {
    try { localStorage.setItem("calc-history", JSON.stringify(history.slice(0, 25))); } catch {}
  }

  function renderHistory() {
    historyList.querySelectorAll(".history-item").forEach((el) => el.remove());
    historyEmpty.style.display = history.length ? "none" : "block";

    history.forEach((entry) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "history-item";
      btn.type = "button";
      btn.innerHTML = `<div class="history-item-expr">${entry.expr}</div><div class="history-item-result">${entry.result}</div>`;
      btn.addEventListener("click", () => recallHistory(entry));
      li.appendChild(btn);
      historyList.appendChild(li);
    });
  }

  function addHistory(expr, resultDisplay, resultRaw) {
    history.unshift({ expr, result: resultDisplay, raw: resultRaw });
    history = history.slice(0, 25);
    saveHistory();
    renderHistory();
  }

  function recallHistory(entry) {
    current = fmtPlain(entry.raw);
    acc = null;
    op = null;
    awaitingOperand = false;
    resultShown = true;
    lastExprText = null;
    clearOpHighlight();
    render();
  }

  historyToggle.addEventListener("click", () => {
    const isOpen = appEl.classList.toggle("has-history");
    historyToggle.classList.toggle("is-active", isOpen);
    historyToggle.setAttribute("aria-pressed", String(isOpen));
  });

  historyClearBtn.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  renderHistory();

  /* ============================================================
     Standard calculator — state machine
     ============================================================ */
  const exprEl = document.getElementById("calcExpr");
  const valueEl = document.getElementById("calcValue");

  const OPS = {
    "+": (a, b) => a + b,
    "−": (a, b) => a - b,
    "×": (a, b) => a * b,
    "÷": (a, b) => (b === 0 ? NaN : a / b),
  };

  let current = "0";        // raw string being typed / last computed value
  let acc = null;            // accumulator (left-hand operand)
  let op = null;              // pending operator
  let awaitingOperand = false; // next digit starts a fresh number
  let resultShown = false;    // true right after "="
  let lastOp = null;          // for repeated "="
  let lastOperand = null;

  function render() {
    const text = formatLive(current) || "0";
    valueEl.textContent = text;
    applyShrink(valueEl);

    if (op !== null && acc !== null) {
      exprEl.textContent = `${fmtDisplay(acc)} ${op}`;
    } else if (lastExprText) {
      exprEl.textContent = lastExprText;
    } else {
      exprEl.textContent = "\u00A0";
    }
  }

  let lastExprText = null;

  function highlightOp(nextOp) {
    document.querySelectorAll(".key-op").forEach((k) => {
      k.classList.toggle("is-selected", k.dataset.op === nextOp);
    });
  }
  function clearOpHighlight() {
    document.querySelectorAll(".key-op").forEach((k) => k.classList.remove("is-selected"));
  }

  function inputDigit(d) {
    if (resultShown) {
      current = d === "." ? "0." : d;
      acc = null; op = null; lastExprText = null; resultShown = false; awaitingOperand = false;
      clearOpHighlight();
      render();
      return;
    }
    if (awaitingOperand) {
      current = d === "." ? "0." : d;
      awaitingOperand = false;
      render();
      return;
    }
    if (d === ".") {
      if (!current.includes(".")) current += current === "" ? "0." : ".";
    } else {
      current = current === "0" ? d : current + d;
    }
    render();
  }

  function chooseOperator(nextOp) {
    resultShown = false;
    lastExprText = null;
    const val = parseFloat(stripCommas(current));

    if (op !== null && !awaitingOperand) {
      const result = OPS[op](acc, val);
      acc = result;
      current = fmtPlain(result);
    } else if (acc === null) {
      acc = val;
    }
    // if awaitingOperand was already true, we just swap the pending
    // operator (operator replacement) without recomputing.

    op = nextOp;
    awaitingOperand = true;
    highlightOp(nextOp);
    render();
  }

  function equals() {
    if (op !== null) {
      const val = parseFloat(stripCommas(current));
      const result = OPS[op](acc, val);
      lastExprText = `${fmtDisplay(acc)} ${op} ${fmtDisplay(val)} =`;
      addHistory(lastExprText, fmtDisplay(result), result);
      lastOp = op; lastOperand = val;
      acc = result;
      current = fmtPlain(result);
      op = null;
      awaitingOperand = true;
      resultShown = true;
    } else if (lastOp !== null) {
      const base = parseFloat(stripCommas(current));
      const result = OPS[lastOp](base, lastOperand);
      lastExprText = `${fmtDisplay(base)} ${lastOp} ${fmtDisplay(lastOperand)} =`;
      addHistory(lastExprText, fmtDisplay(result), result);
      acc = result;
      current = fmtPlain(result);
      awaitingOperand = true;
      resultShown = true;
    }
    clearOpHighlight();
    render();
  }

  function clearAll() {
    current = "0"; acc = null; op = null; awaitingOperand = false; resultShown = false;
    lastOp = null; lastOperand = null; lastExprText = null;
    clearOpHighlight();
    render();
  }

  function clearEntry() {
    current = "0";
    resultShown = false;
    render();
  }

  function backspace() {
    if (awaitingOperand || resultShown) return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    render();
  }

  function negate() {
    if (current === "0") return;
    current = current.startsWith("-") ? current.slice(1) : "-" + current;
    resultShown = false;
    // let further digits extend this value instead of overwriting it
    if (awaitingOperand) awaitingOperand = false;
    render();
  }

  function percent() {
    const n = parseFloat(stripCommas(current));
    if (isNaN(n)) return;
    current = fmtPlain(n / 100);
    resultShown = false;
    render();
  }

  document.querySelectorAll("[data-num]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "decimal") inputDigit(".");
      else inputDigit(btn.dataset.num);
    });
  });

  document.querySelectorAll('[data-action="op"]').forEach((btn) => {
    btn.addEventListener("click", () => chooseOperator(btn.dataset.op));
  });

  document.querySelector('[data-action="clear"]').addEventListener("click", clearAll);
  document.querySelector('[data-action="ce"]').addEventListener("click", clearEntry);
  document.querySelector('[data-action="backspace"]').addEventListener("click", backspace);
  document.querySelector('[data-action="negate"]').addEventListener("click", negate);
  document.querySelector('[data-action="percent"]').addEventListener("click", percent);
  document.querySelector('[data-action="equals"]').addEventListener("click", equals);

  render();

  /* keyboard support (desktop-first) */
  window.addEventListener("keydown", (e) => {
    const inCalc = calcPanel.classList.contains("is-active");
    const activeIsInput = document.activeElement && document.activeElement.tagName === "INPUT";

    if (inCalc && !activeIsInput) {
      const keyOpMap = { "+": "+", "-": "−", "*": "×", "/": "÷" };

      if (e.key >= "0" && e.key <= "9") { inputDigit(e.key); return; }
      if (e.key === ".") { inputDigit("."); return; }
      if (keyOpMap[e.key]) { e.preventDefault(); chooseOperator(keyOpMap[e.key]); return; }
      if (e.key === "Enter" || e.key === "=") { e.preventDefault(); equals(); return; }
      if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
      if (e.key === "Escape") { clearAll(); return; }
      if (e.key === "%") { percent(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyText(stripCommas(current));
        flashCopy(valueEl);
        return;
      }
    }
  });

  /* ============================================================
     % Change template
     ============================================================ */
  const originalInput = document.getElementById("originalInput");
  const finalInput = document.getElementById("finalInput");
  const baseInput = document.getElementById("baseInput");
  const diffValue = document.getElementById("diffValue");
  const resultValue = document.getElementById("resultValue");
  const resultLabel = document.getElementById("resultLabel");
  const resultFormula = document.getElementById("resultFormula");
  const copyBtn = document.getElementById("copyBtn");
  const copyLabel = document.getElementById("copyLabel");

  const DEFAULT_BASE = "100";
  const TEMPLATE_DECIMALS = 8;
  let resultRawText = "";

  function formatFieldLive(el) {
    let raw = stripCommas(el.value);
    raw = raw.replace(/[^0-9.\-]/g, "");
    const neg = raw.startsWith("-");
    raw = raw.replace(/-/g, "");
    if (neg) raw = "-" + raw;
    const dot = raw.indexOf(".");
    if (dot !== -1) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "");
    el.value = formatLive(raw);
  }

  function fieldNumber(el) {
    const v = stripCommas(el.value).trim();
    if (v === "" || v === "-") return NaN;
    return parseFloat(v);
  }

  function computeChange() {
    const original = fieldNumber(originalInput);
    const final = fieldNumber(finalInput);
    const base = fieldNumber(baseInput);
    const baseValid = !isNaN(base) ? base : 100;

    resultLabel.firstChild.textContent = baseValid === 100 ? "% Change " : "Result ";
    resultFormula.textContent = baseValid === 100
      ? "((original − final) / original) × 100"
      : `((original − final) / original) × ${fmtDisplay(baseValid)}`;

    if (isNaN(original) || isNaN(final)) {
      diffValue.textContent = "—";
      resultValue.textContent = "—";
      resultValue.classList.remove("is-negative", "is-positive");
      resultRawText = "";
      return;
    }

    const diff = original - final;
    diffValue.textContent = fmtDisplay(diff, 10);
    diffValue.classList.toggle("is-negative", diff < 0);
    diffValue.classList.toggle("is-positive", diff > 0);

    if (original === 0) {
      resultValue.textContent = "Undefined";
      resultValue.classList.remove("is-negative", "is-positive");
      resultRawText = "";
      return;
    }

    const percentage = ((original - final) / original) * baseValid;
    const displayText = percentage.toLocaleString(undefined, { maximumFractionDigits: TEMPLATE_DECIMALS });
    resultRawText = fmtPlain(percentage, TEMPLATE_DECIMALS);

    resultValue.textContent = displayText;
    resultValue.classList.toggle("is-negative", percentage < 0);
    resultValue.classList.toggle("is-positive", percentage > 0);
    applyShrink(resultValue);
  }

  originalInput.addEventListener("input", () => { formatFieldLive(originalInput); computeChange(); });
  finalInput.addEventListener("input", () => { formatFieldLive(finalInput); computeChange(); });
  baseInput.addEventListener("input", () => { formatFieldLive(baseInput); computeChange(); });

  [originalInput, finalInput, baseInput].forEach((el) => {
    el.addEventListener("focus", () => el.select());
  });

  originalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finalInput.focus(); }
  });
  finalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); baseInput.focus(); }
  });
  baseInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); baseInput.blur(); }
  });

  function resetTemplate() {
    originalInput.value = "";
    finalInput.value = "";
    baseInput.value = DEFAULT_BASE;
    computeChange();
    originalInput.focus();
  }

  window.addEventListener("keydown", (e) => {
    if (!templatePanel.classList.contains("is-active")) return;
    const activeIsInput = document.activeElement && document.activeElement.tagName === "INPUT";

    if (e.key === "Escape") { resetTemplate(); return; }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !activeIsInput) {
      if (resultRawText) {
        e.preventDefault();
        copyText(resultRawText);
        flashCopy(resultValue);
      }
    }
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  function flashCopy(el) {
    el.classList.add("flash-copied");
    setTimeout(() => el.classList.remove("flash-copied"), 350);
  }

  copyBtn.addEventListener("click", async () => {
    if (!resultRawText) return;
    await copyText(resultRawText);
    flashCopy(resultValue);
    copyBtn.classList.add("is-copied");
    copyLabel.textContent = "Copied";
    setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      copyLabel.textContent = "Copy";
    }, 1400);
  });

  // Base always starts at 100 on load (never persisted).
  baseInput.value = DEFAULT_BASE;
  computeChange();
})();
