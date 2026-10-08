/* Sound Button — simple PWA that plays a customizable sound.
   All settings (including the chosen audio file, as a data URL)
   are persisted in localStorage. */

const STORAGE_KEY = "soundAppSettings";

const DEFAULTS = {
  source: "tone",      // "file" | "tone"
  fileDataUrl: null,
  fileName: null,
  tonePreset: "ding",  // "ding" | "beep" | "chime" | "alarm" | "custom"
  freq: 440,
  volume: 80,
  loop: false,
};

/* ---------- state ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Most likely: audio file too big for the ~5MB localStorage quota.
    alert("Couldn't save — the audio file may be too large for on-device storage. Try a shorter/smaller file.");
  }
}

/* ---------- UI references ---------- */

const $ = (id) => document.getElementById(id);
const playBtn = $("playBtn");
const gearBtn = $("gearBtn");
const settings = $("settings");
const sourceSel = $("soundSource");
const fileRow = $("fileRow");
const toneRow = $("toneRow");
const customFreqRow = $("customFreqRow");
const tonePresetSel = $("tonePreset");
const freqSlider = $("freq");
const freqVal = $("freqVal");
const volSlider = $("volume");
const volVal = $("volVal");
const loopChk = $("loop");
const fileInput = $("fileInput");
const fileNameEl = $("fileName");
const pickFileBtn = $("pickFileBtn");
const removeFileBtn = $("removeFileBtn");
const uploadBtn = $("uploadBtn");
const recBtn = $("recBtn");
const recBtn2 = $("recBtn2");
const recTimer = $("recTimer");

/* ---------- sync UI <-> state ---------- */

function refreshUI() {
  sourceSel.value = state.source;
  tonePresetSel.value = state.tonePreset;
  freqSlider.value = state.freq;
  freqVal.textContent = state.freq;
  volSlider.value = state.volume;
  volVal.textContent = state.volume;
  loopChk.checked = state.loop;

  const fileMode = state.source === "file";
  fileRow.style.display = fileMode ? "" : "none";
  toneRow.style.display = fileMode ? "none" : "";
  customFreqRow.style.display =
    state.tonePreset === "custom" ? "" : "none";

  const hasFile = !!state.fileDataUrl;
  fileNameEl.textContent = hasFile ? state.fileName : "No file selected";
  removeFileBtn.style.display = hasFile ? "" : "none";
}

/* ---------- tone presets (Web Audio) ---------- */

// Each preset: list of notes {freq, type, dur, gap}
const TONES = {
  ding:   [{ f: 880,  type: "sine",   dur: 0.5, gap: 0 }],
  beep:   [{ f: 660,  type: "square", dur: 0.25, gap: 0 }],
  chime:  [{ f: 880,  type: "sine",   dur: 0.2, gap: 0 },
           { f: 1320, type: "sine",   dur: 0.5, gap: 0 }],
  alarm:  [{ f: 440,  type: "square", dur: 0.25, gap: 0.05 },
           { f: 880,  type: "square", dur: 0.25, gap: 0.15 },
           { f: 440,  type: "square", dur: 0.25, gap: 0.05 },
           { f: 880,  type: "square", dur: 0.25, gap: 0 }],
};

let audioCtx = null;
let audioEl = null;          // for file playback
let playing = false;
let toneTimer = null;        // keeps looping tones alive
let toneStopped = false;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playToneSequence() {
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume();

  const vol = state.volume / 100;
  let preset = TONES[state.tonePreset];
  if (!preset) preset = [{ f: state.freq, type: "sine", dur: 0.4, gap: 0 }];

  let t = ctx.currentTime + 0.02;
  let total = 0;

  for (const note of preset) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type;
    osc.frequency.value = note.f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + note.dur + 0.05);
    total = t + note.dur + (note.gap || 0);
    t = total;
  }

  const durMs = (total - ctx.currentTime) * 1000;
  if (state.loop) {
    toneTimer = setTimeout(() => {
      if (playing && state.loop) playToneSequence();
    }, Math.max(durMs, 100));
  } else {
    setTimeout(stopAll, durMs);
  }
}

function startFilePlayback() {
  stopAll();
  audioEl = new Audio(state.fileDataUrl);
  audioEl.volume = state.volume / 100;
  audioEl.loop = state.loop;
  audioEl.onended = () => { if (!state.loop) stopAll(); };
  audioEl.play().catch(() => {
    alert("Couldn't play the file. It may be an unsupported format — try MP3, WAV or OGG.");
    stopAll();
  });
}

function stopAll() {
  playing = false;
  toneStopped = true;
  if (toneTimer) { clearTimeout(toneTimer); toneTimer = null; }
  if (audioEl) {
    audioEl.pause();
    audioEl = null;
  }
  playBtn.textContent = "\u266D";
  playBtn.style.transform = "";
}

function startPlayback() {
  if (!state.source || state.source === "tone") {
    playToneSequence();
  } else if (state.fileDataUrl) {
    startFilePlayback();
  } else {
    alert("No sound selected. Tap the gear icon to pick a file or tone.");
    return;
  }
  playing = true;
  playBtn.textContent = "\u23F9";
  playBtn.style.transform = "scale(0.94)";
}

/* ---------- events ---------- */

playBtn.addEventListener("click", () => {
  if (playing) stopAll();
  else startPlayback();
});

gearBtn.addEventListener("click", () => settings.classList.toggle("open"));

sourceSel.addEventListener("change", () => {
  state.source = sourceSel.value;
  saveState();
  refreshUI();
});

tonePresetSel.addEventListener("change", () => {
  state.tonePreset = tonePresetSel.value;
  saveState();
  refreshUI();
});

freqSlider.addEventListener("input", () => {
  state.freq = +freqSlider.value;
  freqVal.textContent = state.freq;
  saveState();
});

volSlider.addEventListener("input", () => {
  state.volume = +volSlider.value;
  volVal.textContent = state.volume;
  if (audioEl) audioEl.volume = state.volume / 100;
  saveState();
});

loopChk.addEventListener("change", () => {
  state.loop = loopChk.checked;
  if (audioEl) audioEl.loop = state.loop;
  saveState();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.fileDataUrl = reader.result;
    state.fileName = file.name;
    saveState();
    refreshUI();
  };
  reader.readAsDataURL(file);
  fileInput.value = "";
});

removeFileBtn.addEventListener("click", () => {
  state.fileDataUrl = null;
  state.fileName = null;
  saveState();
  refreshUI();
});

/* ---------- quick actions: upload + record ---------- */

uploadBtn.addEventListener("click", () => fileInput.click());
pickFileBtn.addEventListener("click", () => fileInput.click());

let mediaRecorder = null;
let recStream = null;
let recChunks = [];
let recInterval = null;
let recStartedAt = 0;

function setRecUI(recording) {
  recBtn.classList.toggle("recording", recording);
  recBtn2.textContent = recording ? "Stop" : "Record";
  recTimer.textContent = "";
  if (!recording) {
    clearInterval(recInterval);
    recInterval = null;
  }
}

function saveRecordedBlob(blob) {
  const reader = new FileReader();
  reader.onload = () => {
    state.fileDataUrl = reader.result;
    state.fileName = "Recording " + new Date().toLocaleTimeString();
    state.source = "file";
    saveState();
    refreshUI();
    // Play it back so the user immediately hears what they saved
    startPlayback();
  };
  reader.readAsDataURL(blob);
}

async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    alert("Microphone access denied or unavailable. Note: recording needs HTTPS or localhost.");
    return;
  }
  recChunks = [];
  let options = {};
  if (MediaRecorder.isTypeSupported("audio/webm")) options.mimeType = "audio/webm";
  else if (MediaRecorder.isTypeSupported("audio/ogg")) options.mimeType = "audio/ogg";
  mediaRecorder = new MediaRecorder(recStream, options);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    recStream.getTracks().forEach((t) => t.stop());
    recStream = null;
    setRecUI(false);
    if (recChunks.length) {
      saveRecordedBlob(new Blob(recChunks, { type: mediaRecorder.mimeType || "audio/webm" }));
    }
  };
  mediaRecorder.start(250); // flush every 250ms

  recStartedAt = Date.now();
  recInterval = setInterval(() => {
    const s = Math.floor((Date.now() - recStartedAt) / 1000);
    recTimer.textContent = "Recording " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " — tap to stop";
  }, 500);
  setRecUI(true);
}

recBtn.addEventListener("click", toggleRecording);
recBtn2.addEventListener("click", toggleRecording);

/* ---------- service worker (offline support) ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

refreshUI();
