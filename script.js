(() => {
  "use strict";

  // Helpers
  function formatLive(raw) {
    if (raw === "" || raw === "-") return raw;
    const parts = raw.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function stripCommas(str) {
    return (str || "").replace(/,/g, "");
  }

  // Ripple Effect Setup
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
      const ripple = this.querySelector('.ripple');
      if (ripple) ripple.remove();
      this.appendChild(circle);
    });
  });

  // State & Themes
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("calc-theme") || "light";
  root.setAttribute("data-theme", savedTheme);
  
  themeToggle.addEventListener("click", () => {
    const isDark = root.getAttribute("data-theme") === "dark";
    root.setAttribute("data-theme", isDark ? "light" : "dark");
    localStorage.setItem("calc-theme", isDark ? "light" : "dark");
  });

  // Mode Switcher (Mobile)
  const modeBtns = document.querySelectorAll(".mode-btn");
  const panels = document.querySelectorAll(".panel");
  const modeSwitch = document.getElementById("modeSwitch");
  
  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      modeBtns.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const mode = btn.dataset.mode;
      modeSwitch.setAttribute("data-active", mode);
      
      if (window.innerWidth <= 950) {
        panels.forEach(p => p.classList.remove("is-active"));
        document.getElementById(mode + "Panel").classList.add("is-active");
      }
    });
  });

  // ===================== CALCULATOR ENGINE =====================
  const exprEl = document.getElementById("calcExpr");
  const valueEl = document.getElementById("calcValue");
  let tokens = []; 
  let currentInput = "0";
  let isResult = false;

  function updateCalcDisplay() {
    valueEl.textContent = formatLive(currentInput) || "0";
    exprEl.textContent = tokens.join(" ") || "\u00A0";
  }

  function evaluateExpression(exprArray) {
    try {
      let sanitized = exprArray.join(" ").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      if (sanitized.includes("/ 0") || sanitized.includes("/0")) return "Cannot divide by zero";
      const fn = new Function('"use strict"; return (' + sanitized + ')');
      const result = fn();
      if (!isFinite(result)) return "Error";
      return Number(Math.round(result + "e10") + "e-10").toString();
    } catch {
      return "Error";
    }
  }

  function inputNum(num) {
    if (isResult) { currentInput = num; tokens = []; isResult = false; }
    else if (currentInput === "0" && num !== ".") currentInput = num;
    else if (num === "." && currentInput.includes(".")) return;
    else currentInput += num;
    
    if (currentInput.replace(/[^0-9]/g,"").length > 15) {
      currentInput = currentInput.slice(0, -1);
    }
    updateCalcDisplay();
  }

  function inputOp(op) {
    if (currentInput === "Cannot divide by zero" || currentInput === "Error") clearCalcAll();
    if (isResult) { tokens = [currentInput, op]; isResult = false; } 
    else { tokens.push(stripCommas(currentInput), op); }
    currentInput = "0";
    updateCalcDisplay();
  }

  function calculate() {
    if (tokens.length === 0 || isResult) return;
    tokens.push(stripCommas(currentInput));
    const finalResult = evaluateExpression(tokens);
    const exprString = tokens.join(" ") + " =";
    addToHistory(exprString, formatLive(finalResult));
    currentInput = finalResult;
    tokens = [];
    isResult = true;
    updateCalcDisplay();
  }

  function clearCalcAll() { currentInput = "0"; tokens = []; isResult = false; updateCalcDisplay(); }
  function clearCalcEntry() { currentInput = "0"; isResult = false; updateCalcDisplay(); }
  function backspace() {
    if (!isResult && currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
    } else if (!isResult) {
      currentInput = "0";
    }
    updateCalcDisplay();
  }

  // Calc Event Listeners
  document.querySelectorAll(".key-num").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "decimal") inputNum(".");
      else inputNum(btn.dataset.num);
    });
  });

  document.querySelectorAll(".key-op").forEach(btn => {
    btn.addEventListener("click", () => inputOp(btn.dataset.op));
  });

  document.querySelector('[data-action="equals"]').addEventListener("click", calculate);
  document.querySelector('[data-action="clear"]').addEventListener("click", clearCalcAll);
  document.querySelector('[data-action="clear-entry"]').addEventListener("click", clearCalcEntry);
  document.querySelector('[data-action="backspace"]').addEventListener("click", backspace);
  
  document.querySelector('[data-action="negate"]').addEventListener("click", () => {
    if (currentInput !== "0" && !isResult) {
      currentInput = currentInput.startsWith("-") ? currentInput.slice(1) : "-" + currentInput;
      updateCalcDisplay();
    }
  });

  // ===================== HISTORY =====================
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const historySearch = document.getElementById("historySearch");
  let historyData = JSON.parse(localStorage.getItem("calc-history") || "[]");

  document.getElementById("historyToggleBtn").addEventListener("click", () => historyPanel.classList.add("is-open"));
  document.getElementById("closeHistoryBtn").addEventListener("click", () => historyPanel.classList.remove("is-open"));

  function highlightText(text, filter) {
    if (!filter) return text;
    const regex = new RegExp(`(${filter})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }

  function renderHistory(filter = "") {
    historyList.innerHTML = "";
    const filtered = historyData.filter(h => h.expr.includes(filter) || h.res.includes(filter));
    
    if (filtered.length === 0) {
      historyList.appendChild(historyEmpty);
      historyEmpty.style.display = "block";
      return;
    }
    historyEmpty.style.display = "none";

    let lastDateStr = "";

    filtered.forEach((item) => {
      // Grouping by Date
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
        <button class="history-del" data-id="${item.id}">✖</button>
        <div class="history-expr">${highlightText(item.expr, filter)}</div>
        <div class="history-res">${highlightText(item.res, filter)}</div>
        <div class="history-time">${item.time}</div>
      `;
      // Recall 
      li.addEventListener("click", (e) => {
        if(e.target.classList.contains("history-del")) return;
        currentInput = stripCommas(item.res);
        // Also restore expression to history
        tokens = item.expr.replace(" =", "").split(" "); 
        isResult = true;
        updateCalcDisplay();
        if(window.innerWidth <= 950) historyPanel.classList.remove("is-open");
      });
      historyList.appendChild(li);
    });

    document.querySelectorAll(".history-del").forEach(btn => {
      btn.addEventListener("click", (e) => {
        historyData = historyData.filter(h => h.id !== parseInt(e.target.dataset.id));
        localStorage.setItem("calc-history", JSON.stringify(historyData));
        renderHistory();
      });
    });
  }

  function addToHistory(expr, res) {
    if (res === "Error" || res === "Cannot divide by zero") return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    historyData.unshift({ id: Date.now(), timestamp: now.getTime(), expr, res, time: timeStr });
    if(historyData.length > 50) historyData.pop();
    localStorage.setItem("calc-history", JSON.stringify(historyData));
    renderHistory();
  }

  document.getElementById("historyClear").addEventListener("click", () => {
    historyData = [];
    localStorage.removeItem("calc-history");
    renderHistory();
  });
  
  historySearch.addEventListener("input", (e) => renderHistory(e.target.value));
  renderHistory();

  // ===================== % CHANGE =====================
  const inputs = {
    orig: document.getElementById("originalInput"),
    fin: document.getElementById("finalInput"),
    base: document.getElementById("baseInput")
  };
  const diffVal = document.getElementById("diffValue");
  const resVal = document.getElementById("resultValue");
  const statusBadge = document.getElementById("statusBadge");
  
  function cleanInput(el) {
    let raw = stripCommas(el.value).replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    if(parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
    el.value = formatLive(raw);
  }

  function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = start + progress * (end - start);
      obj.textContent = formatLive(current.toFixed(8).replace(/\.?0+$/, ""));
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  let lastPercent = 0;

  function calcTemplate() {
    const orig = parseFloat(stripCommas(inputs.orig.value));
    const fin = parseFloat(stripCommas(inputs.fin.value));
    let base = parseFloat(stripCommas(inputs.base.value));
    
    if (isNaN(base) || base <= 0) base = 100; 
    
    if (isNaN(orig) || isNaN(fin)) {
      diffVal.textContent = "0"; resVal.textContent = "0";
      statusBadge.classList.remove("show", "inc", "dec");
      resVal.className = "stat-value";
      lastPercent = 0;
      return;
    }

    // Formula correction: Difference = Original - Final
    const diff = orig - fin;
    diffVal.textContent = formatLive(Math.abs(diff).toString());
    
    if (orig === 0) { resVal.textContent = "Undefined"; return; }

    const percent = ((diff) / orig) * base;
    
    // Animate Number
    if (percent !== lastPercent) {
      animateValue(resVal, lastPercent, Math.abs(percent), 400);
      lastPercent = Math.abs(percent);
    } else {
      resVal.textContent = formatLive(Math.abs(percent).toFixed(8).replace(/\.?0+$/, ""));
    }
    
    // Status Logic
    statusBadge.classList.add("show");
    if (diff > 0) {
      // Original > Final => Decrease
      resVal.className = "stat-value text-red";
      statusBadge.className = "badge show inc"; 
      statusBadge.innerHTML = "▼ Decrease";
    } else if (diff < 0) {
      // Original < Final => Increase
      resVal.className = "stat-value text-green";
      statusBadge.className = "badge show dec";
      statusBadge.innerHTML = "▲ Increase";
    } else {
      resVal.className = "stat-value";
      statusBadge.classList.remove("show", "inc", "dec");
    }
  }

  Object.values(inputs).forEach(input => {
    input.addEventListener("input", () => { cleanInput(input); calcTemplate(); });
    // Selection and Clear logic
    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); input.select(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") { e.preventDefault(); input.value = ""; calcTemplate(); }
    });
  });

  // Global Keyboard listener for Calc 
  window.addEventListener("keydown", (e) => {
    if(document.activeElement.tagName === "INPUT") return;
    const key = e.key;
    if (/[0-9]/.test(key)) inputNum(key);
    if (key === ".") inputNum(".");
    if (key === "+" || key === "-") inputOp(key === "-" ? "−" : "+");
    if (key === "*" || key === "x") inputOp("×");
    if (key === "/") inputOp("÷");
    if (key === "Enter" || key === "=") { e.preventDefault(); calculate(); }
    if (key === "Backspace") backspace();
    if (key === "Escape") clearCalcAll();
  });

  // Toasts and Copying
  const toast = document.getElementById("toast");
  function showToast() {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function copyToClipboard(text) {
    if(!text || text === "0" || text === "Undefined") return;
    navigator.clipboard.writeText(text).then(() => showToast());
  }

  document.getElementById("copyBtn").addEventListener("click", () => {
    const sign = statusBadge.classList.contains("inc") ? "-" : ""; // If it's a decrease, we usually represent negative % change internally
    copyToClipboard(sign + stripCommas(resVal.textContent));
  });
  document.getElementById("copyDiffBtn").addEventListener("click", () => {
    const sign = statusBadge.classList.contains("inc") ? "-" : "";
    copyToClipboard(sign + stripCommas(diffVal.textContent));
  });

  // Default Focus check if mobile
  if(window.innerWidth <= 950 && document.getElementById("calcPanel").classList.contains("is-active")){
    // Calc active by default on mobile
  } else {
    // Both active on desktop
    inputs.orig.value = "";
  }
})();
