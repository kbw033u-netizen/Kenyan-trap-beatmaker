const TRACKS = [
  { id: "kick", name: "Kick", mark: "K", className: "kick-mark" },
  { id: "snare", name: "Snare", mark: "S", className: "snare-mark" },
  { id: "hat", name: "Hi-hat", mark: "H", className: "hat-mark" },
  { id: "log", name: "Log drum", mark: "L", className: "log-mark" },
  { id: "shaker", name: "Shaker", mark: "Sh", className: "shaker-mark" },
];
const STEPS_PER_BAR = 16;
const BAR_COUNT = 4;
const STEP_COUNT = STEPS_PER_BAR * BAR_COUNT;
const DEFAULT_PATTERN = {
  kick:   [true, false, false, false, false, false, true, false, true, false, false, true, false, false, false, false],
  snare:  [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  hat:    [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
  log:    [true, false, false, false, false, true, false, false, true, false, false, false, false, false, true, false],
  shaker: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
};

const sequencer = document.querySelector("#sequencer");
const playButton = document.querySelector("#play-button");
const bpmInput = document.querySelector("#bpm-input");
const bpmSlider = document.querySelector("#bpm-slider");
const swingSlider = document.querySelector("#swing-slider");
const swingValue = document.querySelector("#swing-value");
const sequenceStatus = document.querySelector("#sequence-status");
const statusDisplay = document.querySelector(".sequence-status");
const pattern = Object.fromEntries(Object.entries(DEFAULT_PATTERN).map(([track, steps]) => [
  track,
  Array.from({ length: BAR_COUNT }, () => [...steps]).flat(),
]));

let audioContext;
let timerId;
let isPlaying = false;
let nextStep = 0;
let nextStepTime = 0;
let activeBar = 0;
let swing = Number(swingSlider.value);
const stepButtons = {};
const barButtons = [...document.querySelectorAll(".bar-tab")];

function buildSequencer() {
  const numberCell = document.createElement("span");
  numberCell.className = "step-number";
  sequencer.append(numberCell);
  for (let step = 0; step < STEPS_PER_BAR; step += 1) {
    const number = document.createElement("span");
    number.className = `step-number${step % 4 === 0 ? " beat-start" : ""}`;
    number.textContent = String(step + 1).padStart(2, "0");
    sequencer.append(number);
  }

  TRACKS.forEach((track) => {
    const label = document.createElement("div");
    label.className = "track-label";
    label.innerHTML = `<span class="voice-mark ${track.className}">${track.mark}</span><span>${track.name}</span>`;
    sequencer.append(label);
    stepButtons[track.id] = [];

    for (let step = 0; step < STEPS_PER_BAR; step += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "step-button";
      button.setAttribute("aria-label", `${track.name}, bar ${activeBar + 1}, step ${step + 1}`);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const absoluteStep = activeBar * STEPS_PER_BAR + step;
        pattern[track.id][absoluteStep] = !pattern[track.id][absoluteStep];
        updateStep(track.id, step);
        updateCounts();
      });
      stepButtons[track.id].push(button);
      sequencer.append(button);
    }
  });
  renderPattern();
}

function updateStep(track, visibleStep) {
  const absoluteStep = activeBar * STEPS_PER_BAR + visibleStep;
  const active = Boolean(pattern[track][absoluteStep]);
  stepButtons[track][visibleStep].classList.toggle("is-active", active);
  stepButtons[track][visibleStep].setAttribute("aria-pressed", String(active));
}

function renderPattern() {
  TRACKS.forEach(({ id }) => {
    for (let step = 0; step < STEPS_PER_BAR; step += 1) updateStep(id, step);
  });
  updateCounts();
}

function showBar(bar) {
  activeBar = bar;
  barButtons.forEach((button, index) => {
    const selected = index === bar;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  TRACKS.forEach(({ id }) => {
    for (let step = 0; step < STEPS_PER_BAR; step += 1) {
      const button = stepButtons[id][step];
      button.setAttribute("aria-label", `${TRACKS.find((track) => track.id === id).name}, bar ${bar + 1}, step ${step + 1}`);
      button.classList.remove("is-current");
      updateStep(id, step);
    }
  });
}

function updateCounts() {
  TRACKS.forEach(({ id }) => {
    const count = pattern[id].filter(Boolean).length;
    document.querySelector(`#count-${id}`).textContent = String(count).padStart(2, "0");
  });
}

function setTempo(value) {
  const tempo = Math.min(200, Math.max(60, Number(value) || 140));
  bpmInput.value = tempo;
  bpmSlider.value = tempo;
}

function setPlaying(value) {
  isPlaying = value;
  playButton.setAttribute("aria-label", value ? "Pause pattern" : "Play pattern");
  playButton.title = value ? "Pause pattern" : "Play pattern";
  playButton.querySelector(".play-glyph").textContent = value ? "Ⅱ" : "▶";
  sequenceStatus.textContent = value ? "PLAYING" : "STOPPED";
  statusDisplay.classList.toggle("is-playing", value);
}

function clearHighlights() {
  document.querySelectorAll(".step-button.is-current").forEach((button) => button.classList.remove("is-current"));
}

function stopPlayback() {
  window.clearInterval(timerId);
  timerId = undefined;
  nextStep = 0;
  setPlaying(false);
  clearHighlights();
}

function scheduleStep(step, time) {
  TRACKS.forEach(({ id }) => {
    if (pattern[id][step]) playVoice(id, time);
  });
  window.setTimeout(() => {
    const bar = Math.floor(step / STEPS_PER_BAR);
    if (activeBar !== bar) showBar(bar);
    clearHighlights();
    TRACKS.forEach(({ id }) => stepButtons[id][step % STEPS_PER_BAR].classList.add("is-current"));
  }, Math.max(0, (time - audioContext.currentTime) * 1000));
}

function scheduler() {
  const secondsPerStep = 60 / Number(bpmInput.value) / 4;
  while (nextStepTime < audioContext.currentTime + 0.1) {
    scheduleStep(nextStep, nextStepTime);
    const swingOffset = (swing / 100) * secondsPerStep * 0.45;
    nextStepTime += secondsPerStep + (nextStep % 2 === 1 ? swingOffset : -swingOffset);
    nextStep = (nextStep + 1) % STEP_COUNT;
  }
}

async function startPlayback() {
  if (isPlaying) {
    stopPlayback();
    return;
  }
  audioContext ??= new window.AudioContext();
  await audioContext.resume();
  nextStep = 0;
  nextStepTime = audioContext.currentTime + 0.05;
  setPlaying(true);
  scheduler();
  timerId = window.setInterval(scheduler, 25);
}

function envelope(gain, time, peak, duration) {
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
}

function playVoice(voice, time, context = audioContext) {
  const output = context.createGain();
  output.gain.value = 0.72;
  output.connect(context.destination);

  if (voice === "kick" || voice === "log") {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = voice === "kick" ? "sine" : "triangle";
    const startFrequency = voice === "kick" ? 145 : 185;
    const endFrequency = voice === "kick" ? 43 : 66;
    oscillator.frequency.setValueAtTime(startFrequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + (voice === "kick" ? 0.14 : 0.22));
    envelope(gain, time, voice === "kick" ? 1 : 0.63, voice === "kick" ? 0.34 : 0.42);
    oscillator.connect(gain).connect(output);
    oscillator.start(time);
    oscillator.stop(time + 0.45);
    return;
  }

  const bufferLength = Math.floor(context.sampleRate * 0.3);
  const buffer = context.createBuffer(1, bufferLength, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < bufferLength; index += 1) channel[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = voice === "snare" ? 1400 : voice === "hat" ? 7500 : 5200;
  const duration = voice === "snare" ? 0.18 : voice === "hat" ? 0.055 : 0.1;
  envelope(gain, time, voice === "snare" ? 0.4 : 0.22, duration);
  source.connect(filter).connect(gain).connect(output);
  source.start(time);
  source.stop(time + duration + 0.02);
  if (voice === "snare") {
    const body = context.createOscillator();
    const bodyGain = context.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(190, time);
    envelope(bodyGain, time, 0.2, 0.1);
    body.connect(bodyGain).connect(output);
    body.start(time);
    body.stop(time + 0.12);
  }
}

function writeWaveString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWave(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = audioBuffer.length * blockAlign;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);
  writeWaveString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeWaveString(view, 8, "WAVE");
  writeWaveString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeWaveString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < audioBuffer.length; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return output;
}

async function exportWave() {
  const message = document.querySelector("#save-message");
  const button = document.querySelector("#export-button");
  const label = document.querySelector("#export-label");
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) {
    message.textContent = "WAV export is not supported in this browser.";
    return;
  }

  button.disabled = true;
  label.textContent = "Rendering…";
  try {
    const sampleRate = 44100;
    const secondsPerStep = 60 / Number(bpmInput.value) / 4;
    const frameCount = Math.ceil((STEP_COUNT * secondsPerStep + 0.6) * sampleRate);
    const offline = new OfflineContext(2, frameCount, sampleRate);
    let time = 0.05;
    for (let step = 0; step < STEP_COUNT; step += 1) {
      TRACKS.forEach(({ id }) => {
        if (pattern[id][step]) playVoice(id, time, offline);
      });
      const swingOffset = (swing / 100) * secondsPerStep * 0.45;
      time += secondsPerStep + (step % 2 === 1 ? swingOffset : -swingOffset);
    }

    const rendered = await offline.startRendering();
    const blob = new Blob([encodeWave(rendered)], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const customName = document.querySelector("#pattern-name").value.trim();
    const fileName = (customName || "jua-four-bar-groove")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${fileName || "jua-four-bar-groove"}.wav`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.textContent = "Four-bar WAV exported.";
  } catch {
    message.textContent = "WAV export failed. Try again in this browser.";
  } finally {
    button.disabled = false;
    label.textContent = "Export WAV";
  }
}

function randomizePattern() {
  const chances = { kick: 0.3, snare: 0.12, hat: 0.76, log: 0.23, shaker: 0.32 };
  TRACKS.forEach(({ id }) => {
    pattern[id] = Array.from({ length: STEP_COUNT }, (_, step) => {
      const barStep = step % STEPS_PER_BAR;
      const chance = (id === "snare" && barStep % 8 === 4) ? 0.82 : chances[id];
      return Math.random() < chance;
    });
  });
  renderPattern();
}

function clearPattern() {
  TRACKS.forEach(({ id }) => { pattern[id] = Array(STEP_COUNT).fill(false); });
  renderPattern();
}

function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function loadSavedPatterns() {
  const response = await fetch("/api/patterns/");
  if (!response.ok) throw new Error("Couldn't load saved patterns.");
  const data = await response.json();
  const list = document.querySelector("#saved-patterns");
  document.querySelector("#pattern-count").textContent = String(data.patterns.length).padStart(2, "0");
  list.replaceChildren();
  if (data.patterns.length === 0) {
    list.innerHTML = '<p class="empty-state">Your saved grooves<br>will land here.</p>';
    return;
  }
  data.patterns.forEach((saved) => {
    const row = document.createElement("div");
    row.className = "saved-pattern";
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "saved-pattern-load";
    loadButton.innerHTML = '<span class="saved-pattern-name"></span><span class="saved-pattern-meta"></span>';
    loadButton.querySelector(".saved-pattern-name").textContent = saved.name;
    loadButton.querySelector(".saved-pattern-meta").textContent = saved.bpm;
    loadButton.title = `Load ${saved.name}`;
    loadButton.addEventListener("click", () => {
      TRACKS.forEach(({ id }) => {
        const savedSteps = saved.steps[id];
        pattern[id] = Array.from({ length: STEP_COUNT }, (_, step) => Boolean(
          savedSteps[step % savedSteps.length]
        ));
      });
      setTempo(saved.bpm);
      swingSlider.value = saved.swing;
      swing = saved.swing;
      swingValue.textContent = `${swing}%`;
      showBar(0);
      renderPattern();
      document.querySelector("#save-message").textContent = `Loaded “${saved.name}”.`;
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "saved-pattern-delete";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${saved.name}`);
    deleteButton.title = `Delete ${saved.name}`;
    deleteButton.addEventListener("click", async () => {
      const response = await fetch(`/api/patterns/${saved.id}/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": readCookie("csrftoken") },
      });
      if (response.ok) loadSavedPatterns();
    });
    row.append(loadButton, deleteButton);
    list.append(row);
  });
}

buildSequencer();
barButtons.forEach((button, index) => button.addEventListener("click", () => showBar(index)));
bpmInput.addEventListener("input", () => setTempo(bpmInput.value));
bpmSlider.addEventListener("input", () => setTempo(bpmSlider.value));
swingSlider.addEventListener("input", () => {
  swing = Number(swingSlider.value);
  swingValue.textContent = `${swing}%`;
});
playButton.addEventListener("click", () => startPlayback().catch(() => {
  document.querySelector("#save-message").textContent = "Audio could not start in this browser.";
}));
document.querySelector("#stop-button").addEventListener("click", stopPlayback);
document.querySelector("#randomize-button").addEventListener("click", randomizePattern);
document.querySelector("#export-button").addEventListener("click", exportWave);
document.querySelector("#clear-button").addEventListener("click", clearPattern);
document.querySelector("#save-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#save-message");
  const name = document.querySelector("#pattern-name").value.trim();
  const response = await fetch("/api/patterns/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": readCookie("csrftoken") },
    body: JSON.stringify({ name, bpm: Number(bpmInput.value), swing, steps: pattern }),
  });
  const result = await response.json();
  if (!response.ok) {
    message.textContent = result.error || "Pattern could not be saved.";
    return;
  }
  document.querySelector("#pattern-name").value = "";
  message.textContent = `“${result.name}” saved.`;
  await loadSavedPatterns();
});

loadSavedPatterns().catch(() => {
  document.querySelector("#saved-patterns").innerHTML = '<p class="empty-state">Saved patterns are<br>temporarily unavailable.</p>';
});