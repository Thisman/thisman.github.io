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
let currentLayout = "carousel";

const allowedCategories = [
  "learning",
  "work",
  "tech",
  "creative",
  "life",
  "culture",
  "fun",
  "other",
];

const allowedCardStyles = [
  "light_clean",
  "light_warm",
  "light_calm",
  "light_playful",
  "light_fresh",
];

const allowedIcons = [
  "spark",
  "question",
  "idea",
  "chat",
  "compass",
  "smile",
  "lightbulb",
  "map",
  "flag",
];

const allowedTones = [
  "curious",
  "playful",
  "creative",
  "pragmatic",
  "reflective",
  "critical",
  "optimistic",
  "supportive",
  "anxious",
];

const metricKeys = ["energy", "formality", "novelty", "humor", "tension"];

const iconLabels = {
  spark: "SPARK",
  question: "QUESTION",
  idea: "IDEA",
  chat: "CHAT",
  compass: "COMPASS",
  smile: "SMILE",
  lightbulb: "BULB",
  map: "MAP",
  flag: "FLAG",
};

const allowedLayouts = ["carousel", "grid", "masonry"];
const allowedGroupings = ["by_category", "by_tone", "chronological"];
const allowedCtaActions = ["open_chat", "search_related", "continue_topic"];

const cardStyleDefaults = {
  light_clean: {
    background_hex: "#f7f8ff",
    secondary_hex: "#e3e6f6",
    accent_hex: "#7aa2ff",
    primary_hex: "#10131d",
  },
  light_warm: {
    background_hex: "#fff4ea",
    secondary_hex: "#f6dccb",
    accent_hex: "#ff9b6a",
    primary_hex: "#2a1c14",
  },
  light_calm: {
    background_hex: "#eef5f7",
    secondary_hex: "#d7e7ee",
    accent_hex: "#6aa9c8",
    primary_hex: "#0f2530",
  },
  light_playful: {
    background_hex: "#f8f2ff",
    secondary_hex: "#e7dbff",
    accent_hex: "#b580ff",
    primary_hex: "#1c1132",
  },
  light_fresh: {
    background_hex: "#eefbf4",
    secondary_hex: "#d4f2df",
    accent_hex: "#5ecf8a",
    primary_hex: "#0f2a1c",
  },
};

openModalBtn.addEventListener("click", () => toggleModal(true));
closeModalBtn.addEventListener("click", () => toggleModal(false));
backdrop.addEventListener("click", () => toggleModal(false));
renderBtn.addEventListener("click", handleRender);

window.addEventListener("resize", () => {
  if (!swiperWrapper.dataset.count) return;
  const count = Number(swiperWrapper.dataset.count);
  updateViewMode(count, currentLayout);
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
  renderHighlights(payload.highlights || [], payload.ui_hints || {});
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
  if (!payload.language || typeof payload.language !== "string") {
    errors.push("Root.language must be a string.");
  }
  if (!Array.isArray(payload.highlights)) {
    errors.push("Root.highlights must be an array.");
    return { ok: errors.length === 0, errors };
  }
  if (payload.ui_hints && typeof payload.ui_hints !== "object") {
    errors.push("Root.ui_hints must be an object if provided.");
  } else if (payload.ui_hints) {
    const { default_layout, grouping, cta } = payload.ui_hints;
    if (default_layout && !allowedLayouts.includes(default_layout)) {
      errors.push("ui_hints.default_layout is invalid.");
    }
    if (grouping && !allowedGroupings.includes(grouping)) {
      errors.push("ui_hints.grouping is invalid.");
    }
    if (cta && typeof cta === "object") {
      if (!cta.label || typeof cta.label !== "string") {
        errors.push("ui_hints.cta.label must be a string.");
      }
      if (!allowedCtaActions.includes(cta.action)) {
        errors.push("ui_hints.cta.action is invalid.");
      }
    } else if (cta) {
      errors.push("ui_hints.cta must be an object.");
    }
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
    } else if (item.title.length > 64) {
      errors.push(`${path}.title must be <= 64 chars.`);
    }
    if (item.subtitle && typeof item.subtitle !== "string") {
      errors.push(`${path}.subtitle must be a string if provided.`);
    } else if (item.subtitle && item.subtitle.length > 96) {
      errors.push(`${path}.subtitle must be <= 96 chars.`);
    }
    if (item.tags && !Array.isArray(item.tags)) {
      errors.push(`${path}.tags must be an array if provided.`);
    } else if (item.tags) {
      item.tags.forEach((tag, tagIndex) => {
        if (typeof tag !== "string") {
          errors.push(`${path}.tags[${tagIndex}] must be a string.`);
        }
      });
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
    if (item.evidence && typeof item.evidence !== "object") {
      errors.push(`${path}.evidence must be an object if provided.`);
    } else if (item.evidence) {
      const { chat_ids, message_ids, quotes } = item.evidence;
      if (chat_ids && !Array.isArray(chat_ids)) {
        errors.push(`${path}.evidence.chat_ids must be an array if provided.`);
      } else if (chat_ids) {
        chat_ids.forEach((chatId, chatIndex) => {
          if (typeof chatId !== "string") {
            errors.push(`${path}.evidence.chat_ids[${chatIndex}] must be a string.`);
          }
        });
      }
      if (message_ids && !Array.isArray(message_ids)) {
        errors.push(`${path}.evidence.message_ids must be an array if provided.`);
      } else if (message_ids) {
        message_ids.forEach((messageId, messageIndex) => {
          if (typeof messageId !== "string") {
            errors.push(
              `${path}.evidence.message_ids[${messageIndex}] must be a string.`
            );
          }
        });
      }
      if (quotes && !Array.isArray(quotes)) {
        errors.push(`${path}.evidence.quotes must be an array if provided.`);
      } else if (quotes) {
        quotes.forEach((quote, quoteIndex) => {
          if (typeof quote !== "string") {
            errors.push(`${path}.evidence.quotes[${quoteIndex}] must be a string.`);
          } else if (quote.length > 160) {
            errors.push(
              `${path}.evidence.quotes[${quoteIndex}] must be <= 160 chars.`
            );
          }
        });
      }
    }
    if (item.media && !Array.isArray(item.media)) {
      errors.push(`${path}.media must be an array if provided.`);
    } else if (item.media) {
      item.media.forEach((mediaItem, mediaIndex) => {
        const mediaPath = `${path}.media[${mediaIndex}]`;
        if (!mediaItem || typeof mediaItem !== "object") {
          errors.push(`${mediaPath} must be an object.`);
          return;
        }
        if (!["image", "file", "none"].includes(mediaItem.type)) {
          errors.push(`${mediaPath}.type is invalid.`);
        }
        if (mediaItem.ref && typeof mediaItem.ref !== "string") {
          errors.push(`${mediaPath}.ref must be a string if provided.`);
        }
        if (mediaItem.caption && typeof mediaItem.caption !== "string") {
          errors.push(`${mediaPath}.caption must be a string if provided.`);
        }
      });
    }
  });

  return { ok: errors.length === 0, errors };
}

function isHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function renderHighlights(highlights, uiHints) {
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

  const orderedHighlights = orderHighlights(
    highlights,
    uiHints?.grouping || "chronological"
  );

  orderedHighlights.forEach((item) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    const inner = document.createElement("div");
    inner.className = "slide-card";
    inner.appendChild(buildCard(item));
    slide.appendChild(inner);
    swiperWrapper.appendChild(slide);
  });

  currentLayout = uiHints?.default_layout || "carousel";
  updateViewMode(highlights.length, currentLayout);
}

function updateAttentionState() {
  openModalBtn.classList.toggle("btn-attention", !hasData);
}

function buildCard(item) {
  const card = document.createElement("article");
  card.className = `card ${item.card_style}`;
  const palette = resolvePalette(item.card_style, item.palette);

  card.style.setProperty("--card-bg", palette.background_hex);
  card.style.setProperty("--card-secondary", palette.secondary_hex);
  card.style.setProperty("--card-accent", palette.accent_hex);
  card.style.setProperty("--card-text", palette.primary_hex);

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

  const evidenceQuotes = Array.isArray(item.evidence?.quotes)
    ? item.evidence.quotes.filter(Boolean)
    : [];
  if (evidenceQuotes.length) {
    const evidenceBlock = document.createElement("div");
    evidenceBlock.className = "evidence";
    evidenceQuotes.slice(0, 3).forEach((quote) => {
      const quoteEl = document.createElement("div");
      quoteEl.className = "quote";
      quoteEl.textContent = `“${quote}”`;
      evidenceBlock.appendChild(quoteEl);
    });
    card.appendChild(evidenceBlock);
  }

  const mediaItems = Array.isArray(item.media)
    ? item.media.filter((mediaItem) => mediaItem && mediaItem.type !== "none")
    : [];
  if (mediaItems.length) {
    const mediaBlock = document.createElement("div");
    mediaBlock.className = "media";
    mediaItems.slice(0, 2).forEach((mediaItem) => {
      const mediaEntry = document.createElement("div");
      mediaEntry.className = "media-item";
      const label = document.createElement("span");
      label.textContent = mediaItem.type.toUpperCase();
      const meta = document.createElement("span");
      meta.textContent = mediaItem.caption || mediaItem.ref || "";
      mediaEntry.appendChild(label);
      mediaEntry.appendChild(meta);
      mediaBlock.appendChild(mediaEntry);
    });
    card.appendChild(mediaBlock);
  }

  return card;
}

function updateViewMode(count = 0, layout = "carousel") {
  swiperView.classList.remove("layout-carousel", "layout-grid", "layout-masonry");
  swiperView.classList.add(`layout-${layout}`);

  if (layout === "carousel") {
    initSwiper();
    if (swiperInstance) {
      swiperInstance.update();
    }
    updateSwipeHint(count, true);
  } else {
    destroySwiper();
    updateSwipeHint(0, true);
  }
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
  const show =
    swiperView.classList.contains("layout-carousel") && isMobile && count > 1;
  swipeHint.classList.toggle("hidden", !show);
}

updateAttentionState();

function resolvePalette(cardStyle, palette = {}) {
  const fallback = cardStyleDefaults[cardStyle] || cardStyleDefaults.light_clean;
  return {
    background_hex: palette.background_hex || fallback.background_hex,
    primary_hex: palette.primary_hex || fallback.primary_hex,
    secondary_hex: palette.secondary_hex || fallback.secondary_hex,
    accent_hex: palette.accent_hex || fallback.accent_hex,
  };
}

function orderHighlights(highlights, grouping) {
  if (!Array.isArray(highlights)) return [];
  const items = [...highlights];
  if (grouping === "by_category") {
    return items.sort((a, b) => String(a.category).localeCompare(b.category));
  }
  if (grouping === "by_tone") {
    return items.sort((a, b) =>
      String(a.tone?.tone_primary).localeCompare(b.tone?.tone_primary)
    );
  }
  return items;
}
