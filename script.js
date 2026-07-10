document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("status").textContent = "not done yet bruh";
});

document.getElementById("open-tabs-btn").addEventListener("click", () => {
  window.open(window.location.href, "_blank");
});
