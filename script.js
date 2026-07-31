(() => {
  "use strict";

  /* ============================================================
     Shared helpers
     ============================================================ */

  const MAX_INT_DIGITS = 15;
  const MAX_DECIMALS = 10;

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

  function fmtDisplay(n, maxDecimals = 10) {
    if (!isFinite(n)) return "Error";
    if (Object.is(n, -0)) n = 0;
    return n.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
  }

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

  function digitCount(str) {
    return (str || "").replace(/[^0-9]/g, "").length;
  }

  function shrinkClassFor(text) {
    const len = text.replace(/[,.\-]/g, "").length;
    if (len > 15) return "shrink-3";
    if (len > 11) return "shrink-2";
    if (len > 8) return "shrink-1";
    return "";
  }

  function applyShrink(el) {
    el.classList.remove("shrink-1", "shrink-2", "shrink-3");
    const cls = shrinkClassFor(el.textContent);
    if (cls) el.classList.add(cls);
  }

  function triggerUpdateAnimation(el) {
    el.classList.remove("animate-update");
    void el.offsetWidth;
    el.classList.add("animate-update");
  }

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

  let toastTimer = null;
  const toastEl = document.getElementById("toast");

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
    }, 2200);
  }

  /* ============================================================
     Theme
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

  function setMode(mode, { focus = false } = {}) {
    modeButtons.forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    modeSwitch.setAttribute("data-active", mode);
    document.body.setAttribute("data-mode", mode);

    const showCalc = mode === "calc";
    calcPanel.classList.toggle("is-active", showCalc);
    calcPanel.setAttribute("aria-hidden", String(!showCalc));
    templatePanel.classList.toggle("is-active", !showCalc);
    templatePanel.setAttribute("aria-hidden", String(showCalc));

    localStorage.setItem("calc-mode", mode);
    if (!showCalc && focus) originalInput.focus();
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode, { focus: true }));
  });

  const savedMode = localStorage.getItem("calc-mode") === "template" ? "template" : "calc";
  setMode(savedMode);

  /* ============================================================
     Standard calculator core with Windows-style % & precedence
     ============================================================ */
  const exprEl = document.getElementById("calcExpr");
  const valueEl = document.getElementById("calcValue");

  const OPS = {
    "+": (a, b) => a + b,
    "−": (a, b) => a - b,
    "×": (a, b) => a * b,
    "÷": (a, b) => a / b,
  };

  let tokens = [];
  let current = "0";
  let awaitingOperand = false;
  let resultShown = false;
  let errorShown = false;
  let lastOp = null;
  let lastOperand = null;
  let lastExprText = null;

  function exprTextFromTokens(list, trailing) {
    const parts = list.map((t) => (t.type === "num" ? fmtDisplay(t.value) : t.value));
    if (trailing !== undefined) parts.push(trailing);
    return parts.join(" ");
  }

  function render({ animate = false } = {}) {
    if (errorShown) {
      valueEl.textContent = "Cannot divide by zero";
      valueEl.classList.add("is-error");
      valueEl.classList.remove("shrink-1", "shrink-2", "shrink-3");
      exprEl.textContent = lastExprText || "\u00A0";
      return;
    }
    valueEl.classList.remove("is-error");

    const text = formatLive(current) || "0";
    if (valueEl.textContent !== text) {
      valueEl.textContent = text;
      if (animate) triggerUpdateAnimation(valueEl);
    }
    applyShrink(valueEl);

    if (tokens.length) {
      exprEl.textContent = exprTextFromTokens(tokens);
    } else if (lastExprText) {
      exprEl.textContent = lastExprText;
    } else {
      exprEl.textContent = "\u00A0";
    }
  }

  function highlightOp(nextOp) {
    document.querySelectorAll(".key-op").forEach((k) => {
      k.classList.toggle("is-selected", k.dataset.op === nextOp);
    });
  }
  function clearOpHighlight() {
    document.querySelectorAll(".key-op").forEach((k) => k.classList.remove("is-selected"));
  }

  function inputDigit(d) {
    if (resultShown || errorShown) {
      current = d === "." ? "0." : d;
      tokens = []; lastExprText = null; resultShown = false; errorShown = false; awaitingOperand = false;
      clearOpHighlight();
      render({ animate: true });
      return;
    }
    if (awaitingOperand) {
      current = d === "." ? "0." : d;
      awaitingOperand = false;
      render({ animate: true });
      return;
    }
    if (d === ".") {
      if (!current.includes(".")) current += current === "" ? "0." : ".";
      render({ animate: false });
      return;
    }
    const dotIdx = current.indexOf(".");
    if (dotIdx !== -1 && current.length - dotIdx - 1 >= MAX_DECIMALS) return;
    if (digitCount(current) >= MAX_INT_DIGITS) return;

    current = current === "0" ? d : current + d;
    render({ animate: false });
  }

  function chooseOperator(nextOp) {
    resultShown = false;
    errorShown = false;
    lastExprText = null;
    const val = parseFloat(stripCommas(current));

    if (awaitingOperand && tokens.length && tokens[tokens.length - 1].type === "op") {
      tokens[tokens.length - 1].value = nextOp;
    } else {
      tokens.push({ type: "num", value: val });
      tokens.push({ type: "op", value: nextOp });
    }

    awaitingOperand = true;
    highlightOp(nextOp);
    render({ animate: false });
  }

  function evaluateTokens(list) {
    const arr = list.map((t) => ({ ...t }));
    for (let i = 1; i < arr.length - 1; ) {
      if (arr[i].type === "op" && (arr[i].value === "×" || arr[i].value === "÷")) {
        const a = arr[i - 1].value, b = arr[i + 1].value;
        if (arr[i].value === "÷" && b === 0) return { error: "divzero" };
        const r = arr[i].value === "×" ? a * b : a / b;
        arr.splice(i - 1, 3, { type: "num", value: r });
      } else {
        i += 2;
      }
    }
    let result = arr[0].value;
    for (let i = 1; i < arr.length - 1; i += 2) {
      const op = arr[i].value, b = arr[i + 1].value;
      result = OPS[op](result, b);
    }
    return { value: result };
  }

  function showDivideByZero() {
    tokens = [];
    current = "0";
    awaitingOperand = true;
    resultShown = false;
    errorShown = true;
    clearOpHighlight();
    render({ animate: true });
  }

  function equals() {
    if (tokens.length) {
      const finalList = tokens.concat([{ type: "num", value: parseFloat(stripCommas(current)) }]);
      const exprText = exprTextFromTokens(finalList, "=");
      const outcome = evaluateTokens(finalList);

      if (outcome.error === "divzero") {
        showDivideByZero();
        return;
      }

      lastOp = finalList[finalList.length - 2].value;
      lastOperand = finalList[finalList.length - 1].value;
      lastExprText = exprText;
      tokens = [];
      current = fmtPlain(outcome.value);
      awaitingOperand = true;
      resultShown = true;
      errorShown = false;
    } else if (lastOp !== null) {
      const base = parseFloat(stripCommas(current));
      if (lastOp === "÷" && lastOperand === 0) { showDivideByZero(); return; }
      const result = OPS[lastOp](base, lastOperand);
      lastExprText = `${fmtDisplay(base)} ${lastOp} ${fmtDisplay(lastOperand)} =`;
      current = fmtPlain(result);
      awaitingOperand = true;
      resultShown = true;
      errorShown = false;
    }
    clearOpHighlight();
    render({ animate: true });
  }

  function clearAll() {
    tokens = []; current = "0"; awaitingOperand = false; resultShown = false; errorShown = false;
    lastOp = null; lastOperand = null; lastExprText = null;
    clearOpHighlight();
    render({ animate: true });
  }

  function clearEntry() {
    current = "0";
    resultShown = false;
    errorShown = false;
    render({ animate: true });
  }

  function backspace() {
    if (awaitingOperand || resultShown || errorShown) return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    render({ animate: false });
  }

  function negate() {
    if (errorShown) return;
    if (current === "0") return;
    current = current.startsWith("-") ? current.slice(1) : "-" + current;
    resultShown = false;
    if (awaitingOperand) awaitingOperand = false;
    render({ animate: true });
  }

  function percent() {
    if (errorShown) return;
    const n = parseFloat(stripCommas(current));
    if (isNaN(n)) return;

    if (tokens.length >= 2) {
      const lastOpVal = tokens[tokens.length - 1].value;
      const baseNum = tokens[tokens.length - 2].value;
      if (lastOpVal === "+" || lastOpVal === "−") {
        current = fmtPlain(baseNum * (n / 100));
      } else if (lastOpVal === "×" || lastOpVal === "÷") {
        current = fmtPlain(n / 100);
      }
    } else {
      current = fmtPlain(n / 100);
    }
    resultShown = false;
    render({ animate: true });
  }

  document.querySelectorAll('[data-num], [data-action="decimal"]').forEach((btn) => {
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

  render({ animate: false });

  /* Keyboard shortcuts */
  window.addEventListener("keydown", (e) => {
    const inCalc = calcPanel.classList.contains("is-active");
    const activeIsInput = document.activeElement && document.activeElement.tagName === "INPUT";

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      themeToggle.click();
      return;
    }

    if (inCalc && !activeIsInput) {
      const keyOpMap = { "+": "+", "-": "−", "*": "×", "/": "÷" };

      if (e.key >= "0" && e.key <= "9") { inputDigit(e.key); return; }
      if (e.key === ".") { inputDigit("."); return; }
      if (keyOpMap[e.key]) { e.preventDefault(); chooseOperator(keyOpMap[e.key]); return; }
      if (e.key === "Enter" || e.key === "=") { e.preventDefault(); equals(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") { e.preventDefault(); clearAll(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") { e.preventDefault(); clearEntry(); return; }
      if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
      if (e.key === "Escape") { clearAll(); return; }
      if (e.key === "%") { percent(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyText(stripCommas(current));
        showToast("Copied result to clipboard");
        triggerUpdateAnimation(valueEl);
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
  const baseHint = document.getElementById("baseHint");
  const diffValue = document.getElementById("diffValue");
  const diffCopyBtn = document.getElementById("diffCopyBtn");
  const resultValue = document.getElementById("resultValue");
  const resultLabel = document.getElementById("resultLabel");
  const resultFormula = document.getElementById("resultFormula");
  const statusBadge = document.getElementById("statusBadge");
  const copyBtn = document.getElementById("copyBtn");

  const DEFAULT_BASE = "100";
  const TEMPLATE_DECIMALS = 8;
  let resultRawText = "";
  let diffRawText = "";

  function formatFieldLive(el, allowNegative = true) {
    let raw = stripCommas(el.value);
    raw = raw.replace(/[^0-9.\-]/g, "");
    if (!allowNegative) raw = raw.replace(/-/g, "");
    const neg = raw.startsWith("-");
    raw = raw.replace(/-/g, "");
    if (neg && allowNegative) raw = "-" + raw;
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

    const baseTrim = baseInput.value.trim();
    const baseNum = fieldNumber(baseInput);
    let baseValid = 100, hint = "", warn = false;
    
    if (baseTrim === "" || isNaN(baseNum) || baseNum <= 0) {
      if (baseTrim !== "") {
        baseInput.value = DEFAULT_BASE;
        hint = "Invalid base — reset to 100";
        warn = true;
      } else {
        hint = "Using default 100";
      }
    } else {
      baseValid = baseNum;
    }
    
    baseHint.textContent = hint;
    baseHint.classList.toggle("is-warning", warn);
    baseInput.classList.toggle("is-invalid", warn);

    resultLabel.firstChild.textContent = baseValid === 100 ? "% Change " : "Result ";
    resultFormula.textContent = baseValid === 100
      ? "((original − final) / original) × 100"
      : `((original − final) / original) × ${fmtDisplay(baseValid)}`;

    if (isNaN(original) || isNaN(final)) {
      diffValue.textContent = "—";
      resultValue.textContent = "—";
      resultValue.classList.remove("is-negative", "is-positive");
      statusBadge.hidden = true;
      resultRawText = "";
      diffRawText = "";
      copyBtn.disabled = true;
      return;
    }

    copyBtn.disabled = false;
    const diff = original - final;
    diffValue.textContent = fmtDisplay(diff, 10);
    diffValue.classList.toggle("is-negative", diff < 0);
    diffValue.classList.toggle("is-positive", diff > 0);
    diffRawText = fmtPlain(diff, 10);

    if (original === 0) {
      resultValue.textContent = "Undefined";
      resultValue.classList.remove("is-negative", "is-positive");
      statusBadge.hidden = true;
      resultRawText = "";
      copyBtn.disabled = true;
      return;
    }

    const percentage = ((original - final) / original) * baseValid;
    const displayText = percentage.toLocaleString(undefined, { maximumFractionDigits: TEMPLATE_DECIMALS });
    resultRawText = fmtPlain(percentage, TEMPLATE_DECIMALS);

    if (resultValue.textContent !== displayText) {
      resultValue.textContent = displayText;
      triggerUpdateAnimation(resultValue);
    }
    resultValue.classList.toggle("is-negative", percentage < 0);
    resultValue.classList.toggle("is-positive", percentage > 0);
    applyShrink(resultValue);

    statusBadge.hidden = false;
    statusBadge.classList.remove("is-increase", "is-decrease", "is-same");
    if (diff > 0) {
      statusBadge.textContent = "▼ Decrease";
      statusBadge.classList.add("is-decrease");
    } else if (diff < 0) {
      statusBadge.textContent = "▲ Increase";
      statusBadge.classList.add("is-increase");
    } else {
      statusBadge.textContent = "No change";
      statusBadge.classList.add("is-same");
    }
  }

  originalInput.addEventListener("input", () => { formatFieldLive(originalInput); computeChange(); });
  finalInput.addEventListener("input", () => { formatFieldLive(finalInput); computeChange(); });
  baseInput.addEventListener("input", () => { formatFieldLive(baseInput, false); computeChange(); });

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

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && activeIsInput) {
      e.preventDefault();
      document.activeElement.select();
      return;
    }

    if (e.key === "Escape") { resetTemplate(); return; }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !activeIsInput) {
      if (resultRawText) {
        e.preventDefault();
        copyText(resultRawText);
        showToast("Copied % change result");
        triggerUpdateAnimation(resultValue);
      }
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (!resultRawText) return;
    await copyText(resultRawText);
    showToast("Copied % change result");
    triggerUpdateAnimation(resultValue);
  });

  diffCopyBtn.addEventListener("click", async () => {
    if (!diffRawText) return;
    await copyText(diffRawText);
    showToast("Copied difference value");
    triggerUpdateAnimation(diffValue);
  });

  baseInput.value = DEFAULT_BASE;
  computeChange();
})();
