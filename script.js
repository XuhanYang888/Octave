document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("status").textContent = "not done yet bruh";
});

document.getElementById("open-tabs-btn").addEventListener("click", () => {
  window.open(window.location.href, "_blank");
});

const channel = new BroadcastChannel("octave-tabs");
const myId = crypto.randomUUID();
const knownTabs = new Map();

knownTabs.set(myId, { joinTime: Date.now() });

function announce() {
  channel.postMessage({
    type: "announce",
    id: myId,
    joinTime: knownTabs.get(myId).joinTime,
  });
}

channel.onmessage = (event) => {
  const { type, id, joinTime } = event.data;

  if (type === "announce") {
    knownTabs.set(id, { joinTime });
    channel.postMessage({
      type: "ack",
      id: myId,
      joinTime: knownTabs.get(myId).joinTime,
    });
  }

  if (type === "ack") {
    knownTabs.set(id, { joinTime });
  }
  if (type === "leave") {
    knownTabs.delete(id);
    updateStatus();
  }

  updateStatus();
};

announce();

function updateStatus() {
  const { rank, total } = getMyRank();
  document.getElementById("status").textContent =
    `${total} tab(s) detected. You are tab #${rank}.`;
}

window.addEventListener("beforeunload", () => {
  channel.postMessage({ type: "leave", id: myId });
});

function getMyRank() {
  const sorted = [...knownTabs.entries()].sort(
    (a, b) => a[1].joinTime - b[1].joinTime,
  );
  const myIndex = sorted.findIndex(([id]) => id === myId);
  return { rank: myIndex + 1, total: sorted.length };
}

