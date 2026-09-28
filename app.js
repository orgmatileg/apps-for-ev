/**
 * Kalkulator kWh Charging EV — pure client-side
 * Contract: kWh = capacity * (target - current) / 100
 *           if loss ON → × 1.1
 * Display: toFixed(1); if >0 but rounds to 0.0 → show 0.1
 * Copy: angka murni (tanpa "kWh")
 */
(function () {
  "use strict";

  // Brochure/usable kWh for popular ID EVs (approx usable when known).
  // Jaecoo J5 usable ~58.9 (gross 60.9). Others: brochure pack size rounded to 1 decimal.
  const PRESETS = {
    mobil: [
      { id: "jaecoo-j5", label: "Jaecoo J5", kwh: 58.9 },
      { id: "lepas-e4", label: "Lepas E4", kwh: 67, approx: true },
      { id: "byd-atto1", label: "BYD Atto 1", kwh: 38.9 },
      { id: "geely-ex2", label: "Geely EX2", kwh: 39.4 },
      { id: "byd-m6", label: "BYD M6", kwh: 58.0 },
      { id: "sealion-7", label: "Sealion 7", kwh: 82.6 },
      { id: "byd-atto3", label: "BYD Atto 3", kwh: 60.5 },
    ],
    motor: [
      { id: "polytron-fox-r", label: "Polytron Fox-R", kwh: 3.75 },
      { id: "alva-cervo-x", label: "Alva Cervo X", kwh: 3.3 },
      { id: "alva-one", label: "Alva One", kwh: 2.7 },
      { id: "alva-cervo-q", label: "Alva Cervo Q", kwh: 1.8 },
      { id: "smoot-tempur", label: "Smoot Tempur", kwh: 1.3 },
    ],
  };

  function presetKwhList(kind) {
    return PRESETS[kind].map(function (p) { return p.kwh; });
  }

  const el = {
    capacity: document.getElementById("capacity"),
    current: document.getElementById("current"),
    target: document.getElementById("target"),
    loss: document.getElementById("loss"),
    presets: document.getElementById("presets"),
    resultValue: document.getElementById("result-value"),
    resultUnit: document.getElementById("result-unit"),
    resultLoss: document.getElementById("result-loss"),
    resultMsg: document.getElementById("result-msg"),
    resultBlock: document.querySelector(".result"),
    btnCopy: document.getElementById("btn-copy"),
    capacityError: document.getElementById("capacity-error"),
    currentError: document.getElementById("current-error"),
    targetError: document.getElementById("target-error"),
    btnMobil: document.getElementById("btn-mobil"),
    btnMotor: document.getElementById("btn-motor"),
  };

  let vehicle = "mobil";
  let lastValidKwh = null;
  const LS_TARGET = "ev-calc-target-pct";
  const LS_CAPACITY = "ev-calc-capacity-kwh";
  const LS_VEHICLE = "ev-calc-vehicle";
  const LS_MAX_LEGACY = "ev-calc-max-charge";

  function parseNum(raw) {
    if (raw === null || raw === undefined) return NaN;
    const s = String(raw).trim().replace(",", ".");
    if (s === "") return NaN;
    return Number(s);
  }

  function setError(node, message) {
    if (!message) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = message;
  }

  function markInvalid(input, invalid) {
    input.classList.toggle("invalid", !!invalid);
  }

  function renderPresets() {
    const list = PRESETS[vehicle];
    el.presets.innerHTML = "";
    list.forEach(function (preset) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      var kwhLabel = preset.approx ? ("~" + String(preset.kwh)) : String(preset.kwh);
      btn.textContent = preset.label + " · " + kwhLabel;
      btn.title = preset.label + " · " + kwhLabel + " kWh" + (preset.approx ? " (brochure/approx)" : " usable");
      btn.dataset.kwh = String(preset.kwh);
      btn.dataset.id = preset.id;
      btn.addEventListener("click", function () {
        el.capacity.value = String(preset.kwh);
        persistCapacity();
        syncChipActive();
        calculate();
      });
      el.presets.appendChild(btn);
    });
    syncChipActive();
  }

  function syncChipActive() {
    const cap = parseNum(el.capacity.value);
    Array.from(el.presets.querySelectorAll(".chip")).forEach(function (chip) {
      const k = parseNum(chip.dataset.kwh);
      chip.classList.toggle("active", !Number.isNaN(cap) && Math.abs(cap - k) < 0.05);
    });
  }

  function applyVehicleUI(next) {
    vehicle = next;
    el.btnMobil.classList.toggle("active", vehicle === "mobil");
    el.btnMotor.classList.toggle("active", vehicle === "motor");
    el.btnMobil.setAttribute("aria-pressed", vehicle === "mobil" ? "true" : "false");
    el.btnMotor.setAttribute("aria-pressed", vehicle === "motor" ? "true" : "false");
    renderPresets();
  }

  function setVehicle(next) {
    if (next !== vehicle) {
      applyVehicleUI(next);
      // Prefill first preset if capacity empty or was a known other-vehicle preset
      const first = PRESETS[vehicle][0].kwh;
      const cap = parseNum(el.capacity.value);
      const otherKwh = presetKwhList(vehicle === "mobil" ? "motor" : "mobil");
      if (Number.isNaN(cap) || otherKwh.some(function (p) { return Math.abs(p - cap) < 0.05; })) {
        el.capacity.value = String(first);
      }
    }
    persistVehicle();
    persistCapacity();
    syncChipActive();
    calculate();
  }

  function validate() {
    const capacity = parseNum(el.capacity.value);
    const current = parseNum(el.current.value);
    const target = parseNum(el.target.value);

    let ok = true;
    let fieldMsg = null; // first field-level message for result area fallback

    // Capacity
    if (String(el.capacity.value).trim() === "" || Number.isNaN(capacity)) {
      setError(el.capacityError, "Isi kapasitas usable (angka > 0)");
      markInvalid(el.capacity, true);
      ok = false;
      fieldMsg = fieldMsg || "Isi kapasitas usable";
    } else if (capacity <= 0) {
      setError(el.capacityError, "Kapasitas harus lebih dari 0");
      markInvalid(el.capacity, true);
      ok = false;
      fieldMsg = fieldMsg || "Kapasitas harus > 0";
    } else {
      setError(el.capacityError, null);
      markInvalid(el.capacity, false);
    }

    // Current %
    if (String(el.current.value).trim() === "" || Number.isNaN(current)) {
      setError(el.currentError, "Isi % sekarang (0–100)");
      markInvalid(el.current, true);
      ok = false;
      fieldMsg = fieldMsg || "Isi % sekarang";
    } else if (current < 0 || current > 100) {
      setError(el.currentError, "Harus antara 0–100");
      markInvalid(el.current, true);
      ok = false;
      fieldMsg = fieldMsg || "% sekarang harus 0–100";
    } else {
      setError(el.currentError, null);
      markInvalid(el.current, false);
    }

    // Target %
    if (String(el.target.value).trim() === "" || Number.isNaN(target)) {
      setError(el.targetError, "Isi % target (0–100)");
      markInvalid(el.target, true);
      ok = false;
      fieldMsg = fieldMsg || "Isi % target";
    } else if (target < 0 || target > 100) {
      setError(el.targetError, "Harus antara 0–100");
      markInvalid(el.target, true);
      ok = false;
      fieldMsg = fieldMsg || "% target harus 0–100";
    } else {
      setError(el.targetError, null);
      markInvalid(el.target, false);
    }

    return { ok: ok, capacity: capacity, current: current, target: target, fieldMsg: fieldMsg };
  }

  function calculate() {
    syncChipActive();
    const v = validate();

    if (!v.ok) {
      showDisabled(v.fieldMsg || "Periksa input");
      return;
    }

    if (v.current >= v.target) {
      showDisabled("Target harus lebih tinggi dari sisa baterai");
      return;
    }

    let kwh = v.capacity * (v.target - v.current) / 100;
    if (el.loss.checked) {
      kwh = kwh * 1.1;
    }

    // Ceil tiny positive results to 0.1 so motor top-ups never show as 0.0
    let display = kwh.toFixed(1);
    if (kwh > 0 && display === "0.0") {
      display = "0.1";
    }
    lastValidKwh = display;
    el.resultValue.textContent = display;
    el.resultUnit.hidden = false;
    if (el.loss.checked) {
      el.resultLoss.hidden = false;
    } else {
      el.resultLoss.hidden = true;
    }
    el.resultMsg.hidden = true;
    el.resultMsg.textContent = "";
    el.resultBlock.classList.remove("is-disabled");
    el.btnCopy.disabled = false;
  }

  function showDisabled(message) {
    lastValidKwh = null;
    el.resultValue.textContent = "—";
    el.resultUnit.hidden = false;
    el.resultLoss.hidden = true;
    el.resultMsg.hidden = false;
    el.resultMsg.textContent = message;
    el.resultBlock.classList.add("is-disabled");
    el.btnCopy.disabled = true;
  }

  async function copyResult() {
    if (lastValidKwh === null) return;
    const text = lastValidKwh; // angka murni untuk app charger
    // Flash segera biar tidak kalah race dengan await clipboard (automation / clipboard lambat).
    flashCopied();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
    } catch (e) {
      try {
        fallbackCopy(text);
      } catch (e2) {
        el.btnCopy.classList.remove("copied");
        el.btnCopy.textContent = "Salin";
        el.resultMsg.hidden = false;
        el.resultMsg.textContent = "Gagal menyalin — salin manual: " + text;
      }
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function flashCopied() {
    el.btnCopy.classList.add("copied");
    el.btnCopy.textContent = "Disalin!";
    setTimeout(function () {
      el.btnCopy.classList.remove("copied");
      el.btnCopy.textContent = "Salin";
    }, 1400);
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* private mode / blocked storage */
    }
  }

  function lsGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function persistTarget() {
    const raw = String(el.target.value).trim();
    const n = parseNum(raw);
    if (raw !== "" && !Number.isNaN(n) && n >= 0 && n <= 100) {
      lsSet(LS_TARGET, raw);
    }
  }

  function persistCapacity() {
    const raw = String(el.capacity.value).trim();
    const n = parseNum(raw);
    if (raw !== "" && !Number.isNaN(n) && n > 0) {
      lsSet(LS_CAPACITY, raw);
    }
  }

  function persistVehicle() {
    lsSet(LS_VEHICLE, vehicle);
  }

  function loadPrefs() {
    try {
      localStorage.removeItem(LS_MAX_LEGACY);
    } catch (e) {
      /* ignore */
    }

    const savedVehicle = lsGet(LS_VEHICLE);
    if (savedVehicle === "mobil" || savedVehicle === "motor") {
      applyVehicleUI(savedVehicle);
    } else {
      applyVehicleUI("mobil");
    }

    const savedCap = lsGet(LS_CAPACITY);
    const capN = parseNum(savedCap);
    if (savedCap && !Number.isNaN(capN) && capN > 0) {
      el.capacity.value = savedCap;
    } else if (String(el.capacity.value).trim() === "") {
      el.capacity.value = String(PRESETS[vehicle][0].kwh);
    }

    const savedTarget = lsGet(LS_TARGET);
    const tN = parseNum(savedTarget);
    if (savedTarget && !Number.isNaN(tN) && tN >= 0 && tN <= 100) {
      el.target.value = savedTarget;
    }
  }

  function onTargetInput() {
    persistTarget();
    calculate();
  }

  function onCapacityInput() {
    persistCapacity();
    calculate();
  }

  // Events
  el.btnMobil.addEventListener("click", function () { setVehicle("mobil"); });
  el.btnMotor.addEventListener("click", function () { setVehicle("motor"); });
  el.capacity.addEventListener("input", onCapacityInput);
  el.current.addEventListener("input", calculate);
  el.target.addEventListener("input", onTargetInput);
  el.loss.addEventListener("change", calculate);
  el.btnCopy.addEventListener("click", copyResult);

  // Init: restore Mobil/Motor + kapasitas + % target; % sekarang tetap default
  loadPrefs();
  syncChipActive();
  calculate();

  // PWA service worker (best-effort; needs http(s) origin)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {
        /* ignore offline-stub failures on file:// */
      });
    });
  }
})();
