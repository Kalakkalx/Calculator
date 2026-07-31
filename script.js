(() => {
  "use strict";

  /* ============================================================
     Theme + mode switching
     ============================================================ */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const modeSwitch = document.querySelector(".mode-switch");
  const modeButtons = document.querySelectorAll(".mode-btn");
  const calcPanel = document.getElementById("calcPanel");
  const templatePanel = document.getElementById("templatePanel");

  themeToggle.addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark";
    root.setAttribute("data-theme", isDark ? "light" : "dark");
    themeToggle.setAttribute("aria-pressed", String(!isDark));
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;

      modeButtons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      modeSwitch.setAttribute("data-active", mode);

      const showCalc = mode === "calc";
      calcPanel.classList.toggle("is-active", showCalc);
      calcPanel.setAttribute("aria-hidden", String(!showCalc));
      templatePanel.classList.toggle("is-active", !showCalc);
      templatePanel.setAttribute("aria-hidden", String(showCalc));

      if (!showCalc) originalInput.focus();
    });
  });

  /* ============================================================
     Standard calculator
     ============================================================ */
  const exprEl = document.getElementById("calcExpr");
  const valueEl = document.getElementById("calcValue");

  let current = "0";      // value currently being typed / displayed
  let previous = null;    // stored left-hand operand
  let operator = null;    // pending operator
  let justEvaluated = false;

  const OPS = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, "÷": (a, b) => (b === 0 ? NaN : a / b) };

  function formatNumber(n) {
    if (!isFinite(n)) return "Error";
    if (Object.is(n, -0)) n = 0;
    const str = n.toLocaleString(undefined, { maximumFractionDigits: 10, useGrouping: true });
    return str;
  }

  function render() {
    valueEl.textContent = current;
    if (operator && previous !== null) {
      exprEl.textContent = `${formatNumber(previous)} ${operator}`;
    } else {
      exprEl.textContent = "\u00A0";
    }
  }

  function inputDigit(d) {
    if (justEvaluated) {
      current = d;
      justEvaluated = false;
    } else {
      current = current === "0" ? d : current + d;
    }
    render();
  }

  function inputDecimal() {
    if (justEvaluated) {
      current = "0.";
      justEvaluated = false;
      render();
      return;
    }
    if (!current.includes(".")) {
      current += current === "" ? "0." : ".";
      render();
    }
  }

  function clearAll() {
    current = "0";
    previous = null;
    operator = null;
    justEvaluated = false;
    render();
  }

  function negate() {
    if (current === "0") return;
    current = current.startsWith("-") ? current.slice(1) : "-" + current;
    render();
  }

  function percent() {
    const n = parseFloat(current);
    if (isNaN(n)) return;
    current = String(n / 100);
    render();
  }

  function chooseOperator(nextOp) {
    const val = parseFloat(current);

    if (operator && previous !== null && !justEvaluated) {
      const result = OPS[operator](previous, val);
      previous = result;
      current = formatNumber(result).replace(/,/g, "");
    } else {
      previous = val;
    }

    operator = nextOp;
    justEvaluated = false;
    current = "0";
    // display previous as the "typed so far" line, keep current at 0 ready for next entry
    render();
    // show previous number instead of 0 while waiting for next operand
    valueEl.textContent = formatNumber(previous);
  }

  function equals() {
    if (operator === null || previous === null) return;
    const val = parseFloat(current === "0" && justEvaluated ? current : current);
    const result = OPS[operator](previous, parseFloat(current));
    exprEl.textContent = `${formatNumber(previous)} ${operator} ${formatNumber(parseFloat(current))} =`;
    current = formatNumber(result).replace(/,/g, "");
    valueEl.textContent = current;
    previous = null;
    operator = null;
    justEvaluated = true;
  }

  document.querySelectorAll("[data-num]").forEach((btn) => {
    btn.addEventListener("click", () => inputDigit(btn.dataset.num));
  });

  document.querySelectorAll('[data-action="op"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".key-op").forEach((k) => k.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      chooseOperator(btn.dataset.op);
    });
  });

  document.querySelector('[data-action="clear"]').addEventListener("click", clearAll);
  document.querySelector('[data-action="negate"]').addEventListener("click", negate);
  document.querySelector('[data-action="percent"]').addEventListener("click", percent);
  document.querySelector('[data-action="decimal"]').addEventListener("click", inputDecimal);
  document.querySelector('[data-action="equals"]').addEventListener("click", () => {
    document.querySelectorAll(".key-op").forEach((k) => k.classList.remove("is-selected"));
    equals();
  });

  render();

  /* keyboard support (desktop-first) */
  window.addEventListener("keydown", (e) => {
    if (!calcPanel.classList.contains("is-active")) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;

    const keyOpMap = { "+": "+", "-": "−", "*": "×", "/": "÷" };

    if (e.key >= "0" && e.key <= "9") { inputDigit(e.key); return; }
    if (e.key === ".") { inputDecimal(); return; }
    if (keyOpMap[e.key]) {
      e.preventDefault();
      document.querySelectorAll(".key-op").forEach((k) => k.classList.remove("is-selected"));
      const btn = document.querySelector(`[data-op="${keyOpMap[e.key]}"]`);
      if (btn) btn.classList.add("is-selected");
      chooseOperator(keyOpMap[e.key]);
      return;
    }
    if (e.key === "Enter" || e.key === "=") {
      e.preventDefault();
      document.querySelectorAll(".key-op").forEach((k) => k.classList.remove("is-selected"));
      equals();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      current = current.length > 1 ? current.slice(0, -1) : "0";
      render();
      return;
    }
    if (e.key === "Escape") { clearAll(); return; }
    if (e.key === "%") { percent(); return; }
  });

  /* ============================================================
     % Change template
     ============================================================ */
  const originalInput = document.getElementById("originalInput");
  const finalInput = document.getElementById("finalInput");
  const resultValue = document.getElementById("resultValue");
  const copyBtn = document.getElementById("copyBtn");
  const copyLabel = document.getElementById("copyLabel");

  const DEFAULT_FINAL = "100";

  function sanitizeNumericInput(el) {
    // allow digits, one leading minus, one decimal point
    let v = el.value.replace(/[^0-9.\-]/g, "");
    const neg = v.startsWith("-");
    v = v.replace(/-/g, "");
    if (neg) v = "-" + v;
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    if (v !== el.value) el.value = v;
  }

  function computeChange() {
    const original = parseFloat(originalInput.value);
    const final = parseFloat(finalInput.value);

    if (originalInput.value.trim() === "" || isNaN(original)) {
      resultValue.textContent = "—";
      resultValue.classList.remove("is-negative", "is-positive");
      return;
    }
    if (original === 0) {
      resultValue.textContent = "Undefined";
      resultValue.classList.remove("is-negative", "is-positive");
      return;
    }
    if (isNaN(final)) {
      resultValue.textContent = "—";
      resultValue.classList.remove("is-negative", "is-positive");
      return;
    }

    const percentage = ((original - final) / original) * 100;
    const display = percentage.toLocaleString(undefined, { maximumFractionDigits: 8 });

    resultValue.textContent = display + "%";
    resultValue.classList.toggle("is-negative", percentage < 0);
    resultValue.classList.toggle("is-positive", percentage > 0);
  }

  originalInput.addEventListener("input", () => { sanitizeNumericInput(originalInput); computeChange(); });
  finalInput.addEventListener("input", () => { sanitizeNumericInput(finalInput); computeChange(); });

  originalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finalInput.focus();
      finalInput.select();
    }
  });

  finalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finalInput.blur();
    }
  });

  copyBtn.addEventListener("click", async () => {
    const text = resultValue.textContent;
    if (!text || text === "—" || text === "Undefined") return;

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

    copyBtn.classList.add("is-copied");
    copyLabel.textContent = "Copied";
    setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      copyLabel.textContent = "Copy";
    }, 1400);
  });

  // ensure default state on load (fresh refresh = 100)
  finalInput.value = DEFAULT_FINAL;
  computeChange();
})();
