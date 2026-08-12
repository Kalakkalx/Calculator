(() => {
  "use strict";

  /* ============================================================
     Ticker Configuration
     ============================================================ */
  const CustomText = "FOLLOW ME INSTAGRAM @kalakkalx";
  const TextSpeed = 1;

  const tickerEl = document.getElementById("newsTicker");
  if (tickerEl) {
    tickerEl.textContent = CustomText;
    
    const speedMap = {
      1: "30s",
      2: "20s",
      3: "15s",
      4: "10s",
      5: "5s"
    };
    const animationDuration = speedMap[TextSpeed] || "20s";
    tickerEl.style.animation = `ticker-ltr ${animationDuration} linear infinite`;
  }

  /* ============================================================
     Shared helpers
     ============================================================ */
  const TEMPLATE_DECIMALS = 8;
  const DEFAULT_BASE = "100";
  const DEFAULT_PERCENT = "8.9";

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

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      themeToggle.click();
    }
  });


  /* ============================================================
     Tab Switching Logic
     ============================================================ */
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".template-panel");
  let activeTabId = "changePanel"; // Default

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove active from all
      tabBtns.forEach(b => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      panels.forEach(p => {
        p.classList.remove("is-active");
        p.hidden = true;
      });

      // Add active to selected
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      const targetId = btn.getAttribute("aria-controls");
      const targetPanel = document.getElementById(targetId);
      targetPanel.classList.add("is-active");
      targetPanel.hidden = false;
      
      activeTabId = targetId;

      // Focus first input of newly active panel
      if (activeTabId === "changePanel") {
        document.getElementById("originalInput").focus();
      } else {
        document.getElementById("deductionValueInput").focus();
      }
    });
  });


  /* ============================================================
     % Change Calculator Logic
     ============================================================ */
  const originalInput = document.getElementById("originalInput");
  const finalInput = document.getElementById("finalInput");
  const baseInput = document.getElementById("baseInput");
  const baseHint = document.getElementById("baseHint");
  
  const diffValue = document.getElementById("diffValue");
  const diffCopyBtn = document.getElementById("diffCopyBtn");
  
  const changeResultValue = document.getElementById("changeResultValue");
  const changeResultLabel = document.getElementById("changeResultLabel");
  const changeResultFormula = document.getElementById("changeResultFormula");
  const statusBadge = document.getElementById("statusBadge");
  const changeCopyBtn = document.getElementById("changeCopyBtn");

  let changeResultRawText = "";
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

    changeResultLabel.firstChild.textContent = baseValid === 100 ? "% Change " : "Result ";
    changeResultFormula.textContent = baseValid === 100
      ? "((original − final) / original) × 100"
      : `((original − final) / original) × ${fmtDisplay(baseValid)}`;

    if (isNaN(original) || isNaN(final)) {
      diffValue.textContent = "—";
      changeResultValue.textContent = "—";
      changeResultValue.classList.remove("is-negative", "is-positive");
      statusBadge.hidden = true;
      changeResultRawText = "";
      diffRawText = "";
      changeCopyBtn.disabled = true;
      return;
    }

    changeCopyBtn.disabled = false;
    const diff = original - final;
    diffValue.textContent = fmtDisplay(diff, 10);
    diffValue.classList.toggle("is-negative", diff < 0);
    diffValue.classList.toggle("is-positive", diff > 0);
    diffRawText = fmtPlain(diff, 10);

    if (original === 0) {
      changeResultValue.textContent = "Undefined";
      changeResultValue.classList.remove("is-negative", "is-positive");
      statusBadge.hidden = true;
      changeResultRawText = "";
      changeCopyBtn.disabled = true;
      return;
    }

    const percentage = ((original - final) / original) * baseValid;
    const displayText = percentage.toLocaleString(undefined, { maximumFractionDigits: TEMPLATE_DECIMALS });
    changeResultRawText = fmtPlain(percentage, TEMPLATE_DECIMALS);

    if (changeResultValue.textContent !== displayText) {
      changeResultValue.textContent = displayText;
      triggerUpdateAnimation(changeResultValue);
    }
    changeResultValue.classList.toggle("is-negative", percentage < 0);
    changeResultValue.classList.toggle("is-positive", percentage > 0);
    applyShrink(changeResultValue);

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

  function resetChangeTemplate() {
    originalInput.value = "";
    finalInput.value = "";
    baseInput.value = DEFAULT_BASE;
    computeChange();
    originalInput.focus();
  }

  changeCopyBtn.addEventListener("click", async () => {
    if (!changeResultRawText) return;
    await copyText(changeResultRawText);
    showToast("Copied % change result");
    triggerUpdateAnimation(changeResultValue);
  });

  diffCopyBtn.addEventListener("click", async () => {
    if (!diffRawText) return;
    await copyText(diffRawText);
    showToast("Copied difference value");
    triggerUpdateAnimation(diffValue);
  });

  baseInput.value = DEFAULT_BASE;
  computeChange();


  /* ============================================================
     Percentage% Deduction Calculator Logic
     ============================================================ */
  const deductionValueInput = document.getElementById("deductionValueInput");
  const deductionPercentInput = document.getElementById("deductionPercentInput");
  const deductionPercentHint = document.getElementById("deductionPercentHint");
  
  const deductionAmountValue = document.getElementById("deductionAmountValue");
  const deductionAmountCopyBtn = document.getElementById("deductionAmountCopyBtn");
  
  const deductionResultValue = document.getElementById("deductionResultValue");
  const deductionCopyBtn = document.getElementById("deductionCopyBtn");

  let deductionResultRawText = "";
  let deductionAmountRawText = "";

  function computeDeduction() {
    const originalValue = fieldNumber(deductionValueInput);

    const pctTrim = deductionPercentInput.value.trim();
    const pctNum = fieldNumber(deductionPercentInput);
    let pctValid = 8.9, hint = "", warn = false;
    
    if (pctTrim === "" || isNaN(pctNum)) {
      if (pctTrim !== "") {
        deductionPercentInput.value = DEFAULT_PERCENT;
        hint = "Invalid % — reset to 8.9";
        warn = true;
      } else {
        hint = "Using default 8.9%";
      }
    } else {
      pctValid = pctNum;
    }
    
    deductionPercentHint.textContent = hint;
    deductionPercentHint.classList.toggle("is-warning", warn);
    deductionPercentInput.classList.toggle("is-invalid", warn);

    if (isNaN(originalValue)) {
      deductionAmountValue.textContent = "—";
      deductionResultValue.textContent = "—";
      deductionResultValue.classList.remove("is-negative", "is-positive");
      deductionResultRawText = "";
      deductionAmountRawText = "";
      deductionCopyBtn.disabled = true;
      return;
    }

    deductionCopyBtn.disabled = false;
    
    const deduction = originalValue * (pctValid / 100);
    const finalResult = originalValue - deduction;

    deductionAmountValue.textContent = fmtDisplay(deduction, 10);
    deductionAmountRawText = fmtPlain(deduction, 10);

    const displayText = finalResult.toLocaleString(undefined, { maximumFractionDigits: TEMPLATE_DECIMALS });
    deductionResultRawText = fmtPlain(finalResult, TEMPLATE_DECIMALS);

    if (deductionResultValue.textContent !== displayText) {
      deductionResultValue.textContent = displayText;
      triggerUpdateAnimation(deductionResultValue);
    }
    
    deductionResultValue.classList.toggle("is-negative", finalResult < 0);
    applyShrink(deductionResultValue);
  }

  deductionValueInput.addEventListener("input", () => { formatFieldLive(deductionValueInput); computeDeduction(); });
  deductionPercentInput.addEventListener("input", () => { formatFieldLive(deductionPercentInput, false); computeDeduction(); });

  [deductionValueInput, deductionPercentInput].forEach((el) => {
    el.addEventListener("focus", () => el.select());
  });

  deductionValueInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); deductionPercentInput.focus(); }
  });
  deductionPercentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); deductionPercentInput.blur(); }
  });

  function resetDeductionTemplate() {
    deductionValueInput.value = "";
    deductionPercentInput.value = DEFAULT_PERCENT;
    computeDeduction();
    deductionValueInput.focus();
  }

  deductionCopyBtn.addEventListener("click", async () => {
    if (!deductionResultRawText) return;
    await copyText(deductionResultRawText);
    showToast("Copied final result");
    triggerUpdateAnimation(deductionResultValue);
  });

  deductionAmountCopyBtn.addEventListener("click", async () => {
    if (!deductionAmountRawText) return;
    await copyText(deductionAmountRawText);
    showToast("Copied deduction amount");
    triggerUpdateAnimation(deductionAmountValue);
  });

  deductionPercentInput.value = DEFAULT_PERCENT;
  computeDeduction();


  /* ============================================================
     Global Keyboard Shortcuts
     ============================================================ */
  window.addEventListener("keydown", (e) => {
    const activeIsInput = document.activeElement && document.activeElement.tagName === "INPUT";

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && activeIsInput) {
      e.preventDefault();
      document.activeElement.select();
      return;
    }

    if (e.key === "Escape") { 
      if (activeTabId === "changePanel") {
        resetChangeTemplate();
      } else {
        resetDeductionTemplate();
      }
      return; 
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !activeIsInput) {
      if (activeTabId === "changePanel" && changeResultRawText) {
        e.preventDefault();
        copyText(changeResultRawText);
        showToast("Copied % change result");
        triggerUpdateAnimation(changeResultValue);
      } else if (activeTabId === "deductionPanel" && deductionResultRawText) {
        e.preventDefault();
        copyText(deductionResultRawText);
        showToast("Copied final result");
        triggerUpdateAnimation(deductionResultValue);
      }
    }
  });

})();
