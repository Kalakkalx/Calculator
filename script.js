(() => {
  "use strict";

  // Throttled Optimized Cursor Glow (Desktop Only)
  const cursorGlow = document.getElementById("cursorGlow");
  if (window.matchMedia("(pointer: fine)").matches) {
    let mouseX = 0, mouseY = 0, glowScheduled = false;
    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!glowScheduled) {
        glowScheduled = true;
        requestAnimationFrame(() => {
          cursorGlow.style.left = mouseX + "px";
          cursorGlow.style.top = mouseY + "px";
          glowScheduled = false;
        });
      }
    });
  }

  // Helpers
  function formatLive(raw) {
    if (raw === "" || raw === "-" || raw === "—" || raw === "Cannot divide by zero" || raw === "Error") return raw;
    const parts = raw.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function stripCommas(str) {
    return (str || "").replace(/,/g, "");
  }

  // Robust Parsing for Paste Support (₹50,000, 50 000, 50_000)
  function cleanPastedValue(val) {
    if (!val) return "";
    let cleaned = val.replace(/[₹$€£,\s_]/g, "");
    return cleaned;
  }

  // Ripple Effect with automated DOM cleanup on animationend
  document.querySelectorAll('.ripple-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const circle = document.createElement('span');
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add('ripple');
      circle.addEventListener('animationend', () => circle.remove());
      const oldRipple = this.querySelector('.ripple');
      if (oldRipple) oldRipple.remove();
      this.appendChild(circle);
    });
  });

  // State & Themes & Remember Panel/Window settings
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("calc-theme") || "light";
  root.setAttribute("data-theme", savedTheme);
  
  function toggleTheme() {
    const isDark = root.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    root.setAttribute("data-theme", newTheme);
    localStorage.setItem("calc-theme", newTheme);
  }
  themeToggle.addEventListener("click", toggleTheme);

  // Mode Switcher (Mobile viewports)
  const modeBtns = document.querySelectorAll(".mode-btn");
  const panels = document.querySelectorAll(".panel");
  const modeSwitch = document.getElementById("modeSwitch");
  const savedPanel = localStorage.getItem("calc-active-panel") || "calc";

  function switchMode(mode) {
    modeBtns.forEach(b => {
      if (b.dataset.mode === mode) b.classList.add("is-active");
      else b.classList.remove("is-active");
    });
    modeSwitch.setAttribute("data-active", mode);
    localStorage.setItem("calc-active-panel", mode);
    
    if (window.innerWidth <= 1100) {
      panels.forEach(p => p.classList.remove("is-active"));
      document.getElementById(mode + "Panel").classList.add("is-active");
    }
  }

  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });
  switchMode(savedPanel);

  // Window Controls Simulation
  document.querySelector(".win-min").addEventListener("click", () => showToastMessage("Minimized to taskbar"));
  document.querySelector(".win-max").addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
  document.querySelector(".win-close").addEventListener("click", () => {
    document.getElementById("app").style.opacity = "0";
    setTimeout(() => alert("Application closed."), 200);
  });

  // ===================== CALCULATOR ENGINE =====================
  const exprEl = document.getElementById("calcExpr");
  const valueEl = document.getElementById("calcValue");
  const exprContainer = document.getElementById("exprContainer");
  
  let tokens = []; 
  let currentInput = "0";
  let isResult = false;
  let lastOp = null;
  let lastOperand = null;
  let calculationFinished = false;

  function updateCalcDisplay() {
    let val = formatLive(currentInput) || "0";
    if (val === "Cannot divide by zero" || val === "Error") valueEl.style.fontSize = "28px";
    else if (val.length > 15) valueEl.style.fontSize = "26px";
    else if (val.length > 11) valueEl.style.fontSize = "36px";
    else valueEl.style.fontSize = "52px";
    
    valueEl.textContent = val;
    exprEl.textContent = tokens.join(" ") || "\u00A0";
    exprContainer.scrollLeft = exprContainer.scrollWidth;
  }

  function evaluateExpression(exprArray) {
    try {
      let sanitized = exprArray.join(" ").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      if (sanitized.includes("/ 0") || sanitized.includes("/0")) return "Cannot divide by zero";
      const fn = new Function('"use strict"; return (' + sanitized + ')');
      const result = fn();
      if (!isFinite(result)) return "Cannot divide by zero";
      return Number(Math.round(result + "e10") + "e-10").toString();
    } catch {
      return "Error";
    }
  }

  function inputNum(num) {
    if (calculationFinished) {
      tokens = [];
      calculationFinished = false;
    }
    if (isResult) { 
      currentInput = num; 
      isResult = false; 
    } else if (currentInput === "0" && num !== ".") { 
      currentInput = num; 
    } else if (num === "." && currentInput.includes(".")) { 
      return; 
    } else { 
      currentInput += num; 
    }
    
    if (currentInput.replace(/[^0-9]/g,"").length > 18) currentInput = currentInput.slice(0, -1);
    updateCalcDisplay();
  }

  function inputOp(op) {
    if (currentInput === "Cannot divide by zero" || currentInput === "Error") clearCalcAll();
    calculationFinished = false;
    
    const operators = ["+", "−", "×", "÷"];
    // Operator replacement / multi-operator protection
    if (currentInput === "0" && tokens.length > 0 && operators.includes(tokens[tokens.length - 1]) && !isResult) {
      tokens[tokens.length - 1] = op;
    } else {
      if (isResult) { 
        tokens = [currentInput, op]; 
        isResult = false; 
      } else { 
        tokens.push(stripCommas(currentInput), op); 
      }
    }
    
    currentInput = "0";
    lastOp = null; 
    lastOperand = null;
    updateCalcDisplay();
  }

  function calculate() {
    if (tokens.length === 0 && !isResult) return;
    
    let exprString = "";
    if (calculationFinished && lastOp && lastOperand) {
      // Repeated equals flow
      tokens = [currentInput, lastOp, lastOperand];
      exprString = `${formatLive(tokens[0])} ${tokens[1]} ${formatLive(tokens[2])} =`;
    } else {
      lastOp = tokens[tokens.length - 1];
      lastOperand = stripCommas(currentInput);
      tokens.push(lastOperand);
      exprString = tokens.join(" ") + " =";
    }
    
    const finalResult = evaluateExpression(tokens);
    addToHistory(exprString, formatLive(finalResult), [...tokens]);
    
    currentInput = finalResult;
    tokens = [exprString]; // Keep expression visible: 5 x 8 =
    isResult = true;
    calculationFinished = true;
    updateCalcDisplay();
  }

  // Windows-style % behavior
  function percentLogic() {
    if (currentInput === "Cannot divide by zero" || currentInput === "Error") return;
    const val = parseFloat(stripCommas(currentInput));
    if (isNaN(val)) return;

    const operators = ["+", "−", "×", "÷"];
    const lastToken = tokens[tokens.length - 1];

    if (tokens.length > 0 && operators.includes(lastToken)) {
      // e.g. 200 + 10% -> 200 + (200 * 10 / 100)
      const firstOperand = parseFloat(stripCommas(tokens[0]));
      const pctValue = (firstOperand * val) / 100;
      currentInput = pctValue.toString();
    } else {
      currentInput = (val / 100).toString();
    }
    updateCalcDisplay();
  }

  function clearCalcAll() { 
    currentInput = "0"; 
    tokens = []; 
    isResult = false; 
    calculationFinished = false;
    lastOp = null; 
    lastOperand = null; 
    updateCalcDisplay(); 
  }

  function clearCalcEntry() { 
    currentInput = "0"; 
    isResult = false; 
    calculationFinished = false;
    updateCalcDisplay(); 
  }

  function backspace() {
    if (calculationFinished) return;
    if (!isResult && currentInput.length > 1 && currentInput !== "Cannot divide by zero") {
      currentInput = currentInput.slice(0, -1);
    } else if (!isResult) {
      currentInput = "0";
    }
    updateCalcDisplay();
  }

  // Calculator Event Bindings
  document.querySelectorAll(".key-num").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "decimal") inputNum(".");
      else inputNum(btn.dataset.num);
    });
  });

  document.querySelectorAll(".key-op").forEach(btn => {
    if(btn.dataset.action === "op") btn.addEventListener("click", () => inputOp(btn.dataset.op));
  });

  document.querySelector('[data-action="equals"]').addEventListener("click", calculate);
  document.querySelector('[data-action="clear"]').addEventListener("click", clearCalcAll);
  document.querySelector('[data-action="clear-entry"]').addEventListener("click", clearCalcEntry);
  document.querySelector('[data-action="backspace"]').addEventListener("click", backspace);
  document.querySelector('[data-action="percent"]').addEventListener("click", percentLogic);
  
  document.querySelector('[data-action="negate"]').addEventListener("click", () => {
    if (currentInput !== "0" && !isResult && currentInput !== "Cannot divide by zero") {
      currentInput = currentInput.startsWith("-") ? currentInput.slice(1) : "-" + currentInput;
      updateCalcDisplay();
    }
  });

  // ===================== HISTORY & EXPORT =====================
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const historySearch = document.getElementById("historySearch");
  let historyData = JSON.parse(localStorage.getItem("calc-history-pro") || "[]");

  document.getElementById("historyToggleBtn").addEventListener("click", () => historyPanel.classList.add("is-open"));
  document.getElementById("closeHistoryBtn").addEventListener("click", () => historyPanel.classList.remove("is-open"));

  function highlightText(text, filter) {
    if (!filter) return text;
    const safeFilter = filter.replace(/,/g, "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeFilter})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }

  function renderHistory(filter = "") {
    historyList.innerHTML = "";
    const searchStr = filter.replace(/,/g, "").toLowerCase();
    
    const filtered = historyData.filter(h => 
      h.expr.replace(/,/g, "").toLowerCase().includes(searchStr) || 
      h.res.replace(/,/g, "").toLowerCase().includes(searchStr) ||
      h.time.toLowerCase().includes(searchStr)
    );
    
    if (filtered.length === 0) {
      historyList.appendChild(historyEmpty);
      historyEmpty.style.display = "block";
      return;
    }
    historyEmpty.style.display = "none";

    let lastDateStr = "";

    filtered.forEach((item) => {
      const itemDate = new Date(item.timestamp);
      const today = new Date();
      let dateLabel = itemDate.toLocaleDateString();
      if (itemDate.toDateString() === today.toDateString()) dateLabel = "Today";
      else if (new Date(today.setDate(today.getDate() - 1)).toDateString() === itemDate.toDateString()) dateLabel = "Yesterday";

      if (dateLabel !== lastDateStr && !filter) {
        const groupHead = document.createElement("div");
        groupHead.className = "history-group-label";
        groupHead.textContent = dateLabel;
        historyList.appendChild(groupHead);
        lastDateStr = dateLabel;
      }

      const li = document.createElement("li");
      li.className = "history-item";
      li.innerHTML = `
        <button class="history-del" data-id="${item.id}" title="Delete item">✖</button>
        <div class="history-expr">${highlightText(item.expr, filter)}</div>
        <div class="history-res">${highlightText(item.res, filter)}</div>
        <div class="history-time">${highlightText(item.time, filter)}</div>
      `;
      
      li.addEventListener("click", (e) => {
        if(e.target.classList.contains("history-del")) {
          if (confirm("Delete this history item?")) {
            historyData = historyData.filter(h => h.id !== parseInt(e.target.dataset.id));
            localStorage.setItem("calc-history-pro", JSON.stringify(historyData));
            renderHistory(historySearch.value);
          }
          return;
        }
        currentInput = stripCommas(item.res);
        tokens = item.tokens ? [...item.tokens] : [];
        isResult = true;
        calculationFinished = false;
        updateCalcDisplay();
        if(window.innerWidth <= 1100) historyPanel.classList.remove("is-open");
      });
      historyList.appendChild(li);
    });
  }

  function addToHistory(expr, res, tokenArr) {
    if (res === "Error" || res === "Cannot divide by zero") return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    historyData.unshift({ id: Date.now(), timestamp: now.getTime(), expr, res, time: timeStr, tokens: tokenArr });
    if(historyData.max && historyData.length > 100) historyData.pop();
    localStorage.setItem("calc-history-pro", JSON.stringify(historyData));
    renderHistory(historySearch.value);
  }

  document.getElementById("historyClear").addEventListener("click", () => {
    if (confirm("Clear all calculation history?")) {
      historyData = [];
      localStorage.removeItem("calc-history-pro");
      renderHistory();
    }
  });

  // History Export (CSV / TXT)
  document.getElementById("historyExportCsv").addEventListener("click", () => {
    if (historyData.length === 0) { alert("No history to export."); return; }
    let csv = "Expression,Result,Timestamp\n" + historyData.map(h => `"${h.expr}","${h.res}","${h.time}"`).join("\n");
    downloadFile(csv, "calculator_history.csv", "text/csv");
  });

  document.getElementById("historyExportTxt").addEventListener("click", () => {
    if (historyData.length === 0) { alert("No history to export."); return; }
    let txt = historyData.map(h => `${h.expr} ${h.res} (${h.time})`).join("\n");
    downloadFile(txt, "calculator_history.txt", "text/plain");
  });

  function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  historySearch.addEventListener("input", (e) => renderHistory(e.target.value));
  renderHistory();

  // ===================== % CHANGE TEMPLATE =====================
  const inputs = {
    orig: document.getElementById("originalInput"),
    fin: document.getElementById("finalInput"),
    base: document.getElementById("baseInput")
  };
  const diffVal = document.getElementById("diffValue");
  const resVal = document.getElementById("resultValue");
  const statusBadge = document.getElementById("statusBadge");
  const copyBtn = document.getElementById("copyBtn");
  
  // Set explicit default for Base
  inputs.base.value = "100";

  // Enter Key Navigation between inputs
  inputs.orig.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inputs.fin.focus(); }});
  inputs.fin.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inputs.base.focus(); }});
  inputs.base.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inputs.base.blur(); }});
  
  // Disable mouse wheel on Base field
  inputs.base.addEventListener("wheel", e => e.preventDefault(), { passive: false });

  function cleanInput(el) {
    let raw = cleanPastedValue(el.value).replace(/[^0-9.-]/g, "");
    const parts = raw.split(".");
    if(parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
    // Handle leading minus properly
    if (raw.lastIndexOf("-") > 0) raw = "-" + raw.replace(/-/g, "");
    el.value = formatLive(raw);
  }

  // Cancelable Animation Frame for Number Counting
  let animIdDiff = null;
  let animIdRes = null;

  function animateValue(obj, start, end, duration, formatPrecision = 8, isDiff = false) {
    if (isDiff && animIdDiff) cancelAnimationFrame(animIdDiff);
    if (!isDiff && animIdRes) cancelAnimationFrame(animIdRes);

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = start + progress * (end - start);
      obj.textContent = formatLive(current.toFixed(formatPrecision).replace(/\.?0+$/, ""));
      if (progress < 1) {
        if (isDiff) animIdDiff = window.requestAnimationFrame(step);
        else animIdRes = window.requestAnimationFrame(step);
      }
    };
    if (isDiff) animIdDiff = window.requestAnimationFrame(step);
    else animIdRes = window.requestAnimationFrame(step);
  }

  let lastPercent = 0;
  let lastDiffVal = 0;

  function calcTemplate() {
    const orig = parseFloat(stripCommas(inputs.orig.value));
    const fin = parseFloat(stripCommas(inputs.fin.value));
    let baseRaw = stripCommas(inputs.base.value);
    let base = parseFloat(baseRaw);
    
    // Invalid Base validation: reset visually and internally to 100 if invalid (abc, 0, negative, empty)
    if (baseRaw !== "" && (isNaN(base) || base <= 0)) {
      inputs.base.value = "100";
      base = 100;
    } else if (baseRaw === "") {
      base = 100; // default internal
    }

    if (isNaN(orig) || isNaN(fin)) {
      diffVal.textContent = "—"; 
      resVal.textContent = "—";
      statusBadge.classList.remove("show", "is-increase", "is-decrease");
      resVal.className = "stat-value";
      copyBtn.disabled = true;
      lastPercent = 0; lastDiffVal = 0;
      return;
    }

    copyBtn.disabled = false;
    const diff = orig - fin;
    const absDiff = Math.abs(diff);

    // Difference Decimal precision formatting (.00 if integer)
    const diffDecimals = (absDiff.toString().split('.')[1] || '').length;
    const formattedDiff = absDiff % 1 === 0 && diffDecimals === 0 ? absDiff.toFixed(2) : absDiff.toString();

    if (absDiff !== lastDiffVal) {
      animateValue(diffVal, lastDiffVal, absDiff, 300, Math.max(diffDecimals, 2), true);
      lastDiffVal = absDiff;
    } else {
      diffVal.textContent = formatLive(formattedDiff);
    }
    
    if (orig === 0) { 
      resVal.textContent = "—"; 
      copyBtn.disabled = true;
      return; 
    }

    const percent = (diff / orig) * base;
    const absPercent = Math.abs(percent);

    if (absPercent !== lastPercent) {
      animateValue(resVal, lastPercent, absPercent, 300, 8, false);
      lastPercent = absPercent;
    } else {
      resVal.textContent = formatLive(absPercent.toFixed(8).replace(/\.?0+$/, ""));
    }
    
    statusBadge.classList.add("show");
    if (diff > 0) { // Decrease
      resVal.className = "stat-value text-red";
      statusBadge.className = "badge show is-decrease"; 
      statusBadge.innerHTML = "▼ Decrease";
    } else if (diff < 0) { // Increase
      resVal.className = "stat-value text-green";
      statusBadge.className = "badge show is-increase";
      statusBadge.innerHTML = "▲ Increase";
    } else {
      resVal.className = "stat-value";
      statusBadge.classList.remove("show", "is-increase", "is-decrease");
    }
  }

  Object.values(inputs).forEach(input => {
    input.addEventListener("input", () => { cleanInput(input); calcTemplate(); });
    input.addEventListener("paste", (e) => {
      setTimeout(() => { cleanInput(input); calcTemplate(); }, 10);
    });
    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); input.select(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") { e.preventDefault(); input.value = ""; calcTemplate(); }
    });
  });

  // ===================== KEYBOARD SHORTCUTS & GLOBALS =====================
  window.addEventListener("keydown", (e) => {
    const isInputActive = document.activeElement.tagName === "INPUT";
    
    // Global Shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
      e.preventDefault(); toggleTheme(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault(); historyPanel.classList.toggle("is-open"); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault(); clearCalcAll(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isInputActive) {
      e.preventDefault(); copyToClipboard(stripCommas(valueEl.textContent)); return;
    }
    if (e.key === "F11") {
      e.preventDefault();
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
      else document.exitFullscreen().catch(()=>{});
      return;
    }

    if (isInputActive) return;

    // Calculator Keyboard Engine
    const key = e.key;
    if (/[0-9]/.test(key)) inputNum(key);
    if (key === ".") inputNum(".");
    if (key === "+" || key === "-") inputOp(key === "-" ? "−" : "+");
    if (key === "*" || key === "x") inputOp("×");
    if (key === "/") inputOp("÷");
    if (key === "%") percentLogic();
    if (key === "Enter" || key === "=") { e.preventDefault(); calculate(); }
    if (key === "Backspace") backspace();
    if (key === "Escape") clearCalcAll();
  });

  // Toasts and Copy Operations
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");

  function showToastMessage(msg) {
    toastText.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function copyToClipboard(text) {
    if(!text || text === "0" || text === "—" || text === "Cannot divide by zero") return;
    navigator.clipboard.writeText(text).then(() => showToastMessage("Copied to clipboard"));
  }

  copyBtn.addEventListener("click", () => {
    copyToClipboard(stripCommas(resVal.textContent));
  });
  
  document.getElementById("copyDiffBtn").addEventListener("click", () => {
    copyToClipboard(stripCommas(diffVal.textContent));
  });

})();
