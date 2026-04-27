
const data = window.WORLD_TERMINAL_PREDICTIONS || { cards: [] };
const AUTOPLAY_MS = 7500;
const SLIDE_MS = 520;
let index = 0;
let autoplayTimer = null;
let transitionTimer = null;
let isPaused = false;
let hasRendered = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const carousel = document.getElementById("carousel");
const rail = document.getElementById("rail");
const prev = document.querySelector(".prev");
const next = document.querySelector(".next");
const shell = document.querySelector(".carousel-shell");

function pct(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return `${(Number(v) * 100).toFixed(1)}%`;
}
function bps(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  const n = Math.round(Number(v));
  return `${n > 0 ? "+" : ""}${n}`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}
function actionClass(action) {
  if (/BUY|BET_YES/.test(action)) return "buy";
  if (/SELL|BET_NO|AVOID/.test(action)) return "sell";
  return "pass";
}
function prettyAction(action) {
  return String(action || "PASS").replaceAll("_", " ");
}
function cardHtml(card, extraClass = "") {
  const action = prettyAction(card.action);
  const classes = ["card", extraClass].filter(Boolean).join(" ");
  return `
    <article class="${classes}">
      <div class="topline">
        <div>
          <div class="venue">${escapeHtml(card.venue)}${card.category ? " / " + escapeHtml(card.category) : ""}</div>
        </div>
        <div class="action ${actionClass(card.action)}">${escapeHtml(action)}</div>
      </div>
      <div>
        <h2 class="headline">${
          card.market_url
            ? `<a href="${escapeHtml(card.market_url)}" target="_blank" rel="noreferrer">${escapeHtml(card.headline)}</a>`
            : escapeHtml(card.headline)
        }</h2>
        <p class="title">${escapeHtml(card.title)}</p>
        <p class="summary">${escapeHtml(card.summary)}</p>
        <ul class="why">
          ${(card.why || []).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      <div>
        <div class="metrics">
          <div class="metric"><span>Fair</span><b>${pct(card.fair_probability)}</b></div>
          <div class="metric"><span>Market</span><b>${pct(card.market_probability)}</b></div>
          <div class="metric"><span>Edge</span><b>${bps(card.edge_bps)}</b></div>
          <div class="metric"><span>Confidence</span><b>${escapeHtml(card.confidence || "-")}</b></div>
        </div>
        <p class="watch"><b>Watch:</b> ${escapeHtml(card.watch_item || "")}</p>
      </div>
    </article>
  `;
}
function renderRail(cards) {
  rail.innerHTML = cards.map((item, i) => `
    <button class="${i === index ? "active" : ""}" data-index="${i}" type="button">
      <b>${escapeHtml(item.choice || item.headline)}</b>
      ${escapeHtml(prettyAction(item.action))} / edge ${bps(item.edge_bps)}
    </button>
  `).join("");
}
function clearTransitionState(resetCard = false) {
  const hadTransition = Boolean(transitionTimer) || carousel.classList.contains("is-animating");
  if (transitionTimer) {
    window.clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  carousel.classList.remove("is-animating", "play");
  carousel.style.height = "";
  if (resetCard && hadTransition) {
    const cards = data.cards || [];
    if (cards.length) {
      index = (index + cards.length) % cards.length;
      carousel.innerHTML = cardHtml(cards[index]);
      renderRail(cards);
      hasRendered = true;
    }
  }
}
function render(options = {}) {
  const cards = data.cards || [];
  if (!cards.length) {
    clearTransitionState();
    carousel.innerHTML = `<article class="card"><h2 class="headline">No public predictions yet</h2><p class="summary">Run the local publisher after at least one debate verdict has been cached.</p></article>`;
    rail.innerHTML = "";
    hasRendered = true;
    return;
  }
  const targetIndex = options.targetIndex ?? index;
  const direction = options.direction || (targetIndex >= index ? 1 : -1);
  const animate = options.animate !== false && hasRendered && !reduceMotion;
  clearTransitionState(true);
  index = (targetIndex + cards.length) % cards.length;
  const card = cards[index];
  const commit = () => {
    carousel.innerHTML = cardHtml(card);
    renderRail(cards);
    hasRendered = true;
  };
  if (!animate) {
    commit();
    return;
  }
  const current = carousel.querySelector(".card");
  if (!current) {
    commit();
    return;
  }
  current.classList.add("is-leaving", direction > 0 ? "to-left" : "to-right");
  carousel.style.height = `${carousel.offsetHeight}px`;
  carousel.classList.add("is-animating");
  carousel.insertAdjacentHTML(
    "beforeend",
    cardHtml(card, direction > 0 ? "is-entering from-right" : "is-entering from-left")
  );
  renderRail(cards);
  window.requestAnimationFrame(() => {
    carousel.classList.add("play");
  });
  transitionTimer = window.setTimeout(() => {
    commit();
    clearTransitionState();
  }, SLIDE_MS);
}
function stopAutoplay() {
  if (autoplayTimer) {
    window.clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}
function startAutoplay() {
  const cards = data.cards || [];
  stopAutoplay();
  if (cards.length <= 1 || isPaused || document.hidden) return;
  autoplayTimer = window.setInterval(() => {
    move(1, { restart: false });
  }, AUTOPLAY_MS);
}
function restartAutoplay() {
  if (!isPaused) startAutoplay();
}
function pauseAutoplay() {
  isPaused = true;
  stopAutoplay();
}
function resumeAutoplay() {
  isPaused = false;
  startAutoplay();
}
function move(delta, options = {}) {
  render({ targetIndex: index + delta, direction: delta >= 0 ? 1 : -1 });
  if (options.restart !== false) restartAutoplay();
}
prev.addEventListener("click", () => move(-1));
next.addEventListener("click", () => move(1));
rail.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  const nextIndex = Number(button.dataset.index);
  const direction = nextIndex >= index ? 1 : -1;
  render({ targetIndex: nextIndex, direction });
  restartAutoplay();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
});
shell.addEventListener("mouseenter", pauseAutoplay);
shell.addEventListener("mouseleave", resumeAutoplay);
shell.addEventListener("focusin", pauseAutoplay);
shell.addEventListener("focusout", (event) => {
  if (!shell.contains(event.relatedTarget)) resumeAutoplay();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoplay();
  } else {
    restartAutoplay();
  }
});
render({ animate: false });
startAutoplay();
