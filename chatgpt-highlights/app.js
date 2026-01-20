const modal = document.getElementById("json-modal");
const openModalBtn = document.getElementById("open-modal");
const closeModalBtn = document.getElementById("close-modal");
const backdrop = document.getElementById("modal-backdrop");
const renderBtn = document.getElementById("render-btn");
const input = document.getElementById("json-input");
const errorBanner = document.getElementById("error-banner");

const emptyState = document.getElementById("empty-state");
const swiperView = document.getElementById("swiper-view");
const swiperWrapper = document.getElementById("swiper-wrapper");
const swipeHint = document.querySelector(".swipe-hint");

let swiperInstance = null;
let hasData = false;

const allowedCategories = [
  "learning",
  "work",
  "health",
  "creative",
  "relationships",
  "tech",
  "life",
  "culture",
  "other",
];

const allowedCardStyles = ["clean", "noir", "warm", "calm", "neon"];

const allowedIcons = [
  "spark",
  "brain",
  "gear",
  "graph",
  "grid",
  "book",
  "map",
  "wand",
  "chat",
  "bolt",
  "shield",
  "flag",
];

const allowedTones = [
  "research",
  "engineering",
  "creative",
  "pragmatic",
  "reflective",
  "playful",
  "critical",
  "supportive",
  "anxious",
  "optimistic",
];

const metricKeys = [
  "energy",
  "formality",
  "novelty",
  "pragmatism",
  "humor",
  "tension",
];

const iconLabels = {
  spark: "SPARK",
  brain: "BRAIN",
  gear: "GEAR",
  graph: "GRAPH",
  grid: "GRID",
  book: "BOOK",
  map: "MAP",
  wand: "WAND",
  chat: "CHAT",
  bolt: "BOLT",
  shield: "SHIELD",
  flag: "FLAG",
};

openModalBtn.addEventListener("click", () => toggleModal(true));
closeModalBtn.addEventListener("click", () => toggleModal(false));
backdrop.addEventListener("click", () => toggleModal(false));
renderBtn.addEventListener("click", handleRender);

window.addEventListener("resize", () => {
  if (!swiperWrapper.dataset.count) return;
  const count = Number(swiperWrapper.dataset.count);
  updateViewMode(count);
});

function toggleModal(show) {
  modal.classList.toggle("hidden", !show);
  modal.setAttribute("aria-hidden", String(!show));
  if (!show) {
    input.value = "";
    showError([]);
  } else {
    input.focus();
  }
}

function handleRender() {
  const raw = input.value.trim();
  if (!raw) {
    showError(["JSON is empty."]);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    showError(["JSON parse error.", error.message]);
    return;
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    showError(validation.errors);
    return;
  }

  showError([]);
  renderHighlights(payload.highlights || []);
  toggleModal(false);
}

function showError(messages) {
  if (!messages || messages.length === 0) {
    errorBanner.classList.add("hidden");
    errorBanner.textContent = "";
    return;
  }
  errorBanner.classList.remove("hidden");
  errorBanner.textContent = messages.join("\n");
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Payload must be a JSON object."] };
  }

  if (!payload.version || typeof payload.version !== "string") {
    errors.push("Root.version must be a string.");
  }
  if (!payload.generated_at || typeof payload.generated_at !== "string") {
    errors.push("Root.generated_at must be a string.");
  }
  if (!Array.isArray(payload.highlights)) {
    errors.push("Root.highlights must be an array.");
    return { ok: errors.length === 0, errors };
  }

  payload.highlights.forEach((item, index) => {
    const path = `highlights[${index}]`;
    if (!item || typeof item !== "object") {
      errors.push(`${path} must be an object.`);
      return;
    }

    if (!item.id || typeof item.id !== "string") {
      errors.push(`${path}.id must be a string.`);
    }
    if (!item.title || typeof item.title !== "string") {
      errors.push(`${path}.title must be a string.`);
    } else if (item.title.length > 52) {
      errors.push(`${path}.title must be <= 52 chars.`);
    }
    if (item.subtitle && typeof item.subtitle !== "string") {
      errors.push(`${path}.subtitle must be a string if provided.`);
    } else if (item.subtitle && item.subtitle.length > 72) {
      errors.push(`${path}.subtitle must be <= 72 chars.`);
    }
    if (!item.summary || typeof item.summary !== "string") {
      errors.push(`${path}.summary must be a string.`);
    } else if (item.summary.length < 240 || item.summary.length > 420) {
      errors.push(`${path}.summary must be 240-420 chars.`);
    }
    if (!allowedCategories.includes(item.category)) {
      errors.push(`${path}.category is invalid.`);
    }
    if (!allowedCardStyles.includes(item.card_style)) {
      errors.push(`${path}.card_style is invalid.`);
    }
    if (!allowedIcons.includes(item.icon)) {
      errors.push(`${path}.icon is invalid.`);
    }
    if (!item.palette || typeof item.palette !== "object") {
      errors.push(`${path}.palette must be an object.`);
    } else {
      ["primary_hex", "secondary_hex", "accent_hex", "background_hex"].forEach(
        (key) => {
          if (!isHex(item.palette[key])) {
            errors.push(`${path}.palette.${key} must be #RRGGBB.`);
          }
        }
      );
    }
    if (!item.tone || typeof item.tone !== "object") {
      errors.push(`${path}.tone must be an object.`);
    } else {
      if (!allowedTones.includes(item.tone.tone_primary)) {
        errors.push(`${path}.tone.tone_primary is invalid.`);
      }
      if (item.tone.metrics && typeof item.tone.metrics === "object") {
        metricKeys.forEach((key) => {
          const value = item.tone.metrics[key];
          if (typeof value !== "number" || value < 0 || value > 1) {
            errors.push(`${path}.tone.metrics.${key} must be 0..1.`);
          }
        });
      } else {
        errors.push(`${path}.tone.metrics must be an object.`);
      }
    }
    if (typeof item.confidence === "number") {
      if (item.confidence < 0 || item.confidence > 1) {
        errors.push(`${path}.confidence must be 0..1.`);
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

function isHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function renderHighlights(highlights) {
  swiperWrapper.innerHTML = "";
  swiperWrapper.dataset.count = String(highlights.length);
  hasData = highlights.length > 0;
  updateAttentionState();

  if (!highlights.length) {
    emptyState.classList.remove("hidden");
    swiperView.classList.remove("active");
    destroySwiper();
    updateSwipeHint(0, window.innerWidth <= 900);
    return;
  }

  emptyState.classList.add("hidden");
  swiperView.classList.add("active");

  highlights.forEach((item) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    const inner = document.createElement("div");
    inner.className = "slide-card";
    inner.appendChild(buildCard(item));
    slide.appendChild(inner);
    swiperWrapper.appendChild(slide);
  });

  updateViewMode(highlights.length);
}

function updateAttentionState() {
  openModalBtn.classList.toggle("btn-attention", !hasData);
}

function buildCard(item) {
  const card = document.createElement("article");
  card.className = `card ${item.card_style}`;
  const palette = item.palette || {};

  card.style.setProperty("--card-bg", palette.background_hex || "#111826");
  card.style.setProperty("--card-secondary", palette.secondary_hex || "#1e2c46");
  card.style.setProperty("--card-accent", palette.accent_hex || "#7aa2ff");

  const header = document.createElement("div");
  header.className = "card-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = item.title || "Untitled";
  titleWrap.appendChild(title);

  if (item.subtitle) {
    const subtitle = document.createElement("div");
    subtitle.className = "card-subtitle";
    subtitle.textContent = item.subtitle;
    titleWrap.appendChild(subtitle);
  }

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = iconLabels[item.icon] || item.icon;

  header.appendChild(titleWrap);

  const tags = document.createElement("div");
  tags.className = "tags";
  const tagItems = Array.isArray(item.tags) ? item.tags : [];
  [item.category, item.tone?.tone_primary, ...tagItems]
    .filter(Boolean)
    .slice(0, 6)
    .forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = String(tag).toUpperCase();
      tags.appendChild(chip);
    });

  const toneBlock = document.createElement("div");
  toneBlock.className = "tone";
  const metrics = item.tone?.metrics || {};
  metricKeys.forEach((key) => {
    if (typeof metrics[key] !== "number") return;
    const row = document.createElement("div");
    row.className = "tone-row";
    row.textContent = key;
    const bar = document.createElement("div");
    bar.className = "tone-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round(metrics[key] * 100)}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    toneBlock.appendChild(row);
  });

  const headerDivider = document.createElement("div");
  headerDivider.className = "card-divider";

  const toneDivider = document.createElement("div");
  toneDivider.className = "card-divider";

  card.appendChild(header);
  if (badge.textContent) card.appendChild(badge);
  card.appendChild(headerDivider);
  if (toneBlock.childNodes.length) card.appendChild(toneBlock);
  if (tags.childNodes.length) {
    card.appendChild(toneDivider);
    card.appendChild(tags);
  }

  return card;
}

function updateViewMode(count = 0) {
  initSwiper();
  updateSwipeHint(count, true);
}

function initSwiper() {
  if (swiperInstance) return;
  swiperInstance = new Swiper(".swiper", {
    slidesPerView: 1.08,
    centeredSlides: true,
    loop: true,
    spaceBetween: 30,
    speed: 650,
    grabCursor: true,
    effect: "coverflow",
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 160,
      modifier: 1,
      slideShadows: false,
    },
  });
}

function destroySwiper() {
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
    swiperInstance = null;
  }
}

function updateSwipeHint(count, isMobile) {
  if (!swipeHint) return;
  const show = isMobile && count > 1;
  swipeHint.classList.toggle("hidden", !show);
}

updateAttentionState();
