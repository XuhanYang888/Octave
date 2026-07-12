const channel = new BroadcastChannel("octave-tabs");
const myId = crypto.randomUUID();
const knownTabs = new Map();

let calibrationActive = false;
let currentSlot = 0;
let mySlot = null;
const slotAssignments = new Map();

knownTabs.set(myId, { joinTime: Date.now() });

// tab presence (announce / ack / leave)
function announce() {
  channel.postMessage({
    type: "announce",
    id: myId,
    joinTime: knownTabs.get(myId).joinTime,
  });
}

function getMyRank() {
  const sorted = [...knownTabs.entries()].sort(
    (a, b) => a[1].joinTime - b[1].joinTime,
  );
  const myIndex = sorted.findIndex(([id]) => id === myId);
  return { rank: myIndex + 1, total: sorted.length };
}

function updateStatus() {
  if (calibrationActive) return;
  const { rank, total } = getMyRank();
  document.getElementById("status").textContent =
    `${total} tab(s) detected. You are tab #${rank}.`;
}

window.addEventListener("beforeunload", () => {
  channel.postMessage({ type: "leave", id: myId });
});

// calibration
function resetCalibrationState() {
  mySlot = null;
  slotAssignments.clear();
}

function startNewCalibration() {
  channel.postMessage({ type: "calibration-reset" });
  resetCalibrationState();
  beginCalibration(1);
  channel.postMessage({ type: "calibration-prompt", slot: 1 });
}

function beginCalibration(slot) {
  calibrationActive = true;
  currentSlot = slot;
  openTabsBtn.style.display = "none";
  updateCalibrationUI();
}

function updateCalibrationUI() {
  if (mySlot !== null) {
    document.getElementById("status").textContent =
      `You are note ${mySlot}. Waiting for other tabs (currently on slot ${currentSlot})...`;
  } else {
    document.getElementById("status").textContent =
      `Calibration: Press Ctrl+${currentSlot} (or Cmd+${currentSlot} on Mac) now.`;
    startBtn.textContent = `Make this tab Note ${currentSlot}`;
    startBtn.onclick = () => claimSlot(currentSlot);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;

  if (calibrationActive && mySlot === null) {
    claimSlot(currentSlot);
    return;
  }

  if (!calibrationActive && mySlot !== null) {
    playNote(mySlot);
  }
});

function claimSlot(slot) {
  mySlot = slot;
  slotAssignments.set(slot, myId);
  ensureAudioContext();

  channel.postMessage({ type: "slot-claimed", slot, id: myId });

  document.getElementById("status").textContent = `You are note ${slot}!`;

  advanceCalibration(slot);
}

function advanceCalibration(justClaimedSlot) {
  const nextSlot = justClaimedSlot + 1;
  const totalTabs = knownTabs.size;

  if (nextSlot > totalTabs) {
    channel.postMessage({ type: "calibration-complete" });
    finishCalibration();
    return;
  }

  channel.postMessage({ type: "calibration-prompt", slot: nextSlot });
}

function finishCalibration() {
  calibrationActive = false;
  document.getElementById("status").textContent =
    `Calibration complete! You are note ${mySlot} of ${slotAssignments.size}.`;

  startBtn.textContent = "Restart Calibration";
  startBtn.onclick = startNewCalibration;
}

// buttons
const startBtn = document.getElementById("start-btn");
const openTabsBtn = document.getElementById("open-tabs-btn");

startBtn.onclick = startNewCalibration;

openTabsBtn.addEventListener("click", () => {
  window.open(window.location.href, "_blank");
});

// messages router
channel.onmessage = (event) => {
  const { type, id, joinTime, slot } = event.data;

  switch (type) {
    case "announce":
      knownTabs.set(id, { joinTime });
      channel.postMessage({
        type: "ack",
        id: myId,
        joinTime: knownTabs.get(myId).joinTime,
      });
      updateStatus();
      break;

    case "ack":
      knownTabs.set(id, { joinTime });
      updateStatus();
      break;

    case "leave":
      knownTabs.delete(id);
      updateStatus();
      break;

    case "calibration-reset":
      resetCalibrationState();
      break;

    case "calibration-prompt":
      beginCalibration(slot);
      break;

    case "slot-claimed":
      slotAssignments.set(slot, id);
      break;

    case "calibration-complete":
      finishCalibration();
      break;
  }
};

announce();

// notes
const noteFrequencies = {
  1: 261.63, // C4
  2: 293.66, // D4
  3: 329.63, // E4
  4: 349.23, // F4
  5: 392.0, // G4
  6: 440.0, // A4
  7: 493.88, // B4
  8: 523.25, // C5
};

let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playNote(slot) {
  const ctx = ensureAudioContext();
  const freq = noteFrequencies[slot];
  if (!freq) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.value = freq;
  osc.type = "sine";

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.6);
}
