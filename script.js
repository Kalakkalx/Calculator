(() => {
  "use strict";

  /* ============================================================
     Ticker Configuration (Request 2)
     ============================================================ */
  const CustomText = "PLEASE RECOMMEND MY WEBSITE TO YOUR FRIENDS";
  const TextSpeed = 1; // Choose a speed level from 1 (slowest) to 5 (fastest)

  const tickerEl = document.getElementById("newsTicker");
  if (tickerEl) {
    tickerEl.textContent = CustomText;
    
    // Map speed levels 1-5 to CSS animation duration in seconds
    const speedMap = {
      1: "30s",
      2: "20s",
      3: "15s",
      4: "10s",
      5: "5s"
    };
    const animationDuration = speedMap[TextSpeed] || "15s";
    
    // Apply left-to-right animation
    tickerEl.style.animation = `ticker-ltr ${animationDuration} linear infinite`;
  }

  /* ============================================================
     Shared helpers
     ============================================================ */
  const TEMPLATE_DECIMALS = 8;
  const DEFAULT_BASE = "100";

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

  /* Keyboard shortcuts globally */
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      themeToggle.click();
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
