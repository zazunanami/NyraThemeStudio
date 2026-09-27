const THEME_ATTRIBUTE = "data-nyra-theme-studio";
const OLED_ATTRIBUTE = "data-oled";
const STORAGE_KEY = "nyraThemeStudio";

const DEFAULT_THEME = {
  chatBackground: "#22202a",
  messageBubble: "#17151e",
  inputBox: "#2b2835",
  contentPanel: "#1f1d26",
  writingBlock: "#243a63",
  sidebar: "#1e1b26"
};

const LEGACY_KEYS = {
  pageBackground: "chatBackground",
  mainBackground: "chatBackground",
  messageCards: "messageBubble",
  messageBackground: "messageBubble",
  composerBackground: "inputBox",
  composerBox: "inputBox",
  panelBackground: "contentPanel",
  codeBlockBackground: "contentPanel",
  contentPanelBackground: "contentPanel",
  sidebarBackground: "sidebar"
};

let enabled = true;
let palette = null;
let strippedOledValue = null;
let observedBody = null;

function isHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
}

function rgbToHex(rgb) {
  return `#${[rgb.r, rgb.g, rgb.b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(baseHex, targetHex, amount) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);

  return rgbToHex({
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount
  });
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${alpha})`;
}

function sanitize(theme) {
  const migrated = { ...(theme || {}) };

  for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
    if (isHex(migrated[oldKey]) && !isHex(migrated[newKey])) {
      migrated[newKey] = migrated[oldKey];
    }
  }

  if (!isHex(migrated.writingBlock) && isHex(migrated.contentPanel)) {
    migrated.writingBlock = migrated.contentPanel;
  }

  const result = { ...DEFAULT_THEME };

  for (const key of Object.keys(DEFAULT_THEME)) {
    if (isHex(migrated[key])) {
      result[key] = migrated[key].toLowerCase();
    }
  }

  return result;
}

function normalizeState(value) {
  if (!value || typeof value !== "object") {
    return { enabled: true, theme: { ...DEFAULT_THEME } };
  }

  if ("theme" in value || "enabled" in value) {
    return {
      enabled: value.enabled !== false,
      theme: sanitize(value.theme || value)
    };
  }

  return { enabled: true, theme: sanitize(value) };
}

/* Six user colors become the full palette. Raised and hover shades are
   white mixed into the base color, the same way ChatGPT layers its grays. */
function buildPalette(theme) {
  const { chatBackground, messageBubble, inputBox, contentPanel, writingBlock, sidebar } = sanitize(theme);

  return {
    "--nyra-chat-bg": chatBackground,
    "--nyra-chat-raised": mix(chatBackground, "#ffffff", 0.06),
    "--nyra-chat-raised-2": mix(chatBackground, "#ffffff", 0.12),
    "--nyra-chat-glass": withAlpha(chatBackground, 0.9),
    "--nyra-message-bg": messageBubble,
    "--nyra-input-bg": inputBox,
    "--nyra-input-raised": mix(inputBox, "#ffffff", 0.07),
    "--nyra-input-raised-2": mix(inputBox, "#ffffff", 0.13),
    "--nyra-panel-bg": contentPanel,
    "--nyra-panel-raised": mix(contentPanel, "#ffffff", 0.07),
    "--nyra-panel-header-bg": mix(contentPanel, "#000000", 0.2),
    "--nyra-panel-border": mix(contentPanel, "#ffffff", 0.1),
    "--nyra-code-bg": mix(contentPanel, "#ffffff", 0.12),
    "--nyra-writing-block-bg": writingBlock,
    "--nyra-writing-block-border": mix(writingBlock, "#ffffff", 0.08),
    "--nyra-sidebar-bg": sidebar,
    "--nyra-sidebar-hover-bg": mix(sidebar, "#ffffff", 0.08),
    "--nyra-sidebar-selected-bg": mix(sidebar, "#ffffff", 0.14)
  };
}

/* Every custom property written on <html>; theme.css maps ChatGPT's own
   design tokens onto these. */
const PALETTE_PROPERTIES = Object.keys(buildPalette(DEFAULT_THEME));

function readThemeMarker(element) {
  if (!element) {
    return null;
  }

  const markers = [
    element.getAttribute("data-theme"),
    element.getAttribute("data-color-scheme")
  ].map((value) => (value || "").toLowerCase());

  if (element.classList.contains("light") || markers.includes("light")) {
    return "light";
  }

  if (element.classList.contains("dark") || markers.includes("dark")) {
    return "dark";
  }

  return null;
}

/* Nyra presets are dark palettes, so they only apply while ChatGPT itself is
   in its dark appearance. Light mode keeps ChatGPT's native look. */
function isDarkAppearance() {
  const root = document.documentElement;
  const marker = readThemeMarker(root) || readThemeMarker(document.body);

  if (marker) {
    return marker === "dark";
  }

  const scheme = root.style.colorScheme;

  if (scheme) {
    return scheme.includes("dark");
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function writePalette(root) {
  for (const [name, value] of Object.entries(palette)) {
    if (root.style.getPropertyValue(name) !== value) {
      root.style.setProperty(name, value);
    }
  }
}

function clearPalette(root) {
  for (const name of PALETTE_PROPERTIES) {
    if (root.style.getPropertyValue(name)) {
      root.style.removeProperty(name);
    }
  }
}

/* Idempotent: safe to call from the attribute observer, which also sees the
   changes made here. */
function sync() {
  const root = document.documentElement;

  if (!root) {
    return;
  }

  if (enabled && palette && isDarkAppearance()) {
    writePalette(root);

    if (root.getAttribute(THEME_ATTRIBUTE) !== "on") {
      root.setAttribute(THEME_ATTRIBUTE, "on");
    }

    // The OLED variant paints pure black through selectors keyed on this
    // attribute. Keep it off while the theme is active.
    if (root.hasAttribute(OLED_ATTRIBUTE)) {
      strippedOledValue = root.getAttribute(OLED_ATTRIBUTE);
      root.removeAttribute(OLED_ATTRIBUTE);
    }

    return;
  }

  if (root.hasAttribute(THEME_ATTRIBUTE)) {
    root.removeAttribute(THEME_ATTRIBUTE);
  }

  clearPalette(root);

  if (strippedOledValue !== null) {
    if (isDarkAppearance() && !root.hasAttribute(OLED_ATTRIBUTE)) {
      root.setAttribute(OLED_ATTRIBUTE, strippedOledValue);
    }

    strippedOledValue = null;
  }
}

function applyState(state) {
  enabled = state.enabled;
  palette = buildPalette(state.theme);
  sync();
}

const THEME_MARKER_ATTRIBUTES = ["class", "data-theme", "data-color-scheme"];

/* Watches a handful of attributes on <html> and <body> only: the dark/light
   switch, the OLED marker and our own attribute and palette. */
const rootObserver = new MutationObserver(sync);

function observeRoot() {
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [...THEME_MARKER_ATTRIBUTES, "style", OLED_ATTRIBUTE, THEME_ATTRIBUTE]
  });
}

function observeBody() {
  if (!document.body || observedBody === document.body) {
    return;
  }

  observedBody = document.body;
  rootObserver.observe(document.body, {
    attributes: true,
    attributeFilter: THEME_MARKER_ATTRIBUTES
  });
  sync();
}

function getStatus() {
  return {
    ok: true,
    dark: isDarkAppearance(),
    active: document.documentElement.getAttribute(THEME_ATTRIBUTE) === "on"
  };
}

chrome.storage.local.get({ [STORAGE_KEY]: null }, (result) => {
  applyState(normalizeState(result[STORAGE_KEY]));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) {
    return;
  }

  applyState(normalizeState(changes[STORAGE_KEY].newValue));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === "NYRA_THEME_APPLY") {
    applyState({ enabled: message.enabled !== false, theme: sanitize(message.theme) });
    sendResponse(getStatus());
    return false;
  }

  if (message.type === "NYRA_THEME_STATUS") {
    sendResponse(getStatus());
    return false;
  }

  return false;
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sync);
observeRoot();
observeBody();
document.addEventListener("DOMContentLoaded", observeBody, { once: true });
