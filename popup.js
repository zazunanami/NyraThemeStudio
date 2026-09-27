const STORAGE_KEY = "nyraThemeStudio";
const CUSTOM_THEME_LIMIT = 3;

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

const PRESETS = {
  classicGray: {
    name: "Classic Gray",
    description: "Neutral old-style dark gray.",
    theme: {
      chatBackground: "#212121",
      messageBubble: "#181818",
      inputBox: "#2a2a2a",
      contentPanel: "#242424",
      writingBlock: "#2a3342",
      sidebar: "#202020"
    }
  },
  graphite: {
    name: "Graphite",
    description: "Clean high-contrast charcoal.",
    theme: {
      chatBackground: "#202124",
      messageBubble: "#151619",
      inputBox: "#282a2d",
      contentPanel: "#24262a",
      writingBlock: "#27313c",
      sidebar: "#1d1e21"
    }
  },
  midnight: {
    name: "Midnight Blue",
    description: "Deep blue-tinted workspace.",
    theme: {
      chatBackground: "#1c2128",
      messageBubble: "#111722",
      inputBox: "#242a33",
      contentPanel: "#212733",
      writingBlock: "#21375b",
      sidebar: "#171c23"
    }
  },
  warm: {
    name: "Warm Charcoal",
    description: "Soft warm dark surface.",
    theme: {
      chatBackground: "#251f1d",
      messageBubble: "#17110f",
      inputBox: "#2d2622",
      contentPanel: "#2a231f",
      writingBlock: "#4d3729",
      sidebar: "#211b18"
    }
  },
  slatePurple: {
    name: "Slate Purple",
    description: "Muted purple-gray.",
    theme: {
      chatBackground: "#22202a",
      messageBubble: "#17151e",
      inputBox: "#2b2835",
      contentPanel: "#24212d",
      writingBlock: "#3c3559",
      sidebar: "#1e1b26"
    }
  }
};
const DEFAULT_PRESET_KEY = Object.keys(PRESETS)[0];

const FIELDS = [
  ["chatBackground", "Chat background", "Page, header and the fade behind the input"],
  ["messageBubble", "Message bubble", "Your own messages"],
  ["inputBox", "Input box & menus", "Message box, menus and popovers"],
  ["contentPanel", "Content panels", "Code blocks and inline code"],
  ["writingBlock", "Writing block editor", "Document and email writing blocks"],
  ["sidebar", "Sidebar", "Sidebar, with hover and selection shades"]
];

const EMPTY_CUSTOM_THEMES = Array.from({ length: CUSTOM_THEME_LIMIT }, () => null);

let currentTheme = { ...DEFAULT_THEME };
let draftTheme = { ...DEFAULT_THEME };
let customThemes = [...EMPTY_CUSTOM_THEMES];
let enabled = true;
let editorVisible = false;
let editingSlotIndex = null;
let saveTimer = 0;
let isBusy = false;
let activeSource = null;
let editorSession = null;
let renderedSlotsKey = "";
let renderedSaveActionsKey = "";

function isHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
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

function getCustomSlotName(index) {
  return `Custom ${index + 1}`;
}

function normalizeCustomSlot(value, index) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const safeTheme = sanitize("theme" in value ? value.theme : value);
  const providedName = typeof value.name === "string" ? value.name.trim() : "";

  return {
    name: providedName || getCustomSlotName(index),
    theme: safeTheme
  };
}

function normalizeCustomThemes(value) {
  const slots = [...EMPTY_CUSTOM_THEMES];

  if (!Array.isArray(value)) {
    return slots;
  }

  for (let index = 0; index < CUSTOM_THEME_LIMIT; index += 1) {
    slots[index] = normalizeCustomSlot(value[index], index);
  }

  return slots;
}

function normalizeActiveSource(value, theme, nextCustomThemes, nextEnabled) {
  if (!nextEnabled) {
    return null;
  }

  if (value && value.type === "preset" && typeof value.key === "string" && PRESETS[value.key]) {
    return { type: "preset", key: value.key };
  }

  if (
    value
    && value.type === "custom"
    && Number.isInteger(value.index)
    && value.index >= 0
    && value.index < CUSTOM_THEME_LIMIT
    && nextCustomThemes[value.index]
  ) {
    return { type: "custom", index: value.index };
  }

  const safeTheme = sanitize(theme);

  for (const [presetKey, preset] of Object.entries(PRESETS)) {
    if (isSameTheme(safeTheme, preset.theme)) {
      return { type: "preset", key: presetKey };
    }
  }

  return null;
}

function resolveThemeFromSource(source) {
  if (!source) {
    return null;
  }

  if (source.type === "preset" && PRESETS[source.key]) {
    return sanitize(PRESETS[source.key].theme);
  }

  if (source.type === "custom" && customThemes[source.index]) {
    return sanitize(customThemes[source.index].theme);
  }

  return null;
}

function normalizeState(value) {
  if (!value || typeof value !== "object") {
    return {
      enabled: true,
      theme: { ...DEFAULT_THEME },
      customThemes: [...EMPTY_CUSTOM_THEMES],
      activeSource: null
    };
  }

  if ("theme" in value || "enabled" in value || "customThemes" in value) {
    const nextEnabled = value.enabled !== false;
    const nextTheme = sanitize(value.theme || value);
    const nextCustomThemes = normalizeCustomThemes(value.customThemes);

    return {
      enabled: nextEnabled,
      theme: nextTheme,
      customThemes: nextCustomThemes,
      activeSource: normalizeActiveSource(value.activeSource, nextTheme, nextCustomThemes, nextEnabled)
    };
  }

  return {
    enabled: true,
    theme: sanitize(value),
    customThemes: [...EMPTY_CUSTOM_THEMES],
    activeSource: null
  };
}

function setStatus(text) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = text;
  }
}

function setBusy(nextBusy, text = "Applying...") {
  isBusy = nextBusy;

  const layer = document.getElementById("loadingLayer");
  const label = document.getElementById("loadingText");

  if (label) {
    label.textContent = text;
  }

  if (layer) {
    layer.classList.toggle("is-hidden", !nextBusy);
    layer.setAttribute("aria-hidden", String(!nextBusy));
  }

  for (const control of document.querySelectorAll("button, input")) {
    control.disabled = nextBusy;
  }
}

function updateDisableVisual() {
  const button = document.getElementById("resetDefaults");

  if (!button) {
    return;
  }

  button.classList.toggle("is-disabled-state", !enabled);
  button.textContent = enabled ? "Disable Theme" : "Enable Theme";
  button.setAttribute("aria-pressed", String(!enabled));
  button.title = enabled
    ? "Disable the theme and restore ChatGPT's default look."
    : "Enable the saved theme again.";
}

function isSameTheme(a, b) {
  const first = sanitize(a);
  const second = sanitize(b);
  return Object.keys(DEFAULT_THEME).every((key) => first[key] === second[key]);
}

function getDefaultSaveStatus(isEnabled) {
  return isEnabled
    ? "Saved locally. Applies live."
    : "Theme disabled. Choose a preset or apply a custom theme to enable.";
}

function renderSwatches(values) {
  const swatches = document.createElement("div");
  swatches.className = "swatches";

  for (const value of Object.values(values)) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.backgroundColor = value;
    swatches.appendChild(swatch);
  }

  return swatches;
}

function isEditingSlot(index) {
  return editorVisible && editingSlotIndex === index;
}

function updateControls() {
  const safeDraft = sanitize(draftTheme);
  const customizerPanel = document.getElementById("customizerPanel");

  for (const [key] of FIELDS) {
    const colorInput = document.querySelector(`input[type="color"][data-key="${key}"]`);
    const textInput = document.querySelector(`input[type="text"][data-key="${key}"]`);

    if (colorInput && colorInput.value.toLowerCase() !== safeDraft[key]) {
      colorInput.value = safeDraft[key];
    }

    if (textInput && textInput.value.toLowerCase() !== safeDraft[key]) {
      textInput.value = safeDraft[key];
    }
  }

  for (const button of document.querySelectorAll(".preset")) {
    button.classList.toggle("active", !editorVisible && enabled && activeSource?.type === "preset" && activeSource.key === button.dataset.preset);
  }

  renderCustomThemeSlots();
  renderSaveSlotActions();

  document.body.classList.toggle("theme-disabled", !enabled);
  document.body.classList.toggle("customizer-open", editorVisible);
  customizerPanel.classList.toggle("is-hidden", !editorVisible);
  updateDisableVisual();
}

function updateAppearanceNotice(status) {
  const notice = document.getElementById("appearanceNotice");

  if (notice) {
    notice.classList.toggle("is-hidden", !status || status.dark !== false);
  }
}

function broadcast(theme, isEnabled) {
  const safeTheme = sanitize(theme);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];

    if (!tab || !tab.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) {
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: "NYRA_THEME_APPLY",
      enabled: isEnabled,
      theme: safeTheme
    }, (status) => {
      updateAppearanceNotice(chrome.runtime.lastError ? null : status);
    });
  });
}

function save(theme, isEnabled, successText = getDefaultSaveStatus(isEnabled), shouldShowLoading = false, loadingText = "Applying...") {
  const safeTheme = sanitize(theme);
  clearTimeout(saveTimer);

  if (shouldShowLoading) {
    setBusy(true, loadingText);
  }

  saveTimer = setTimeout(() => {
    chrome.storage.local.set({
      [STORAGE_KEY]: {
        enabled: isEnabled,
        theme: safeTheme,
        customThemes,
        activeSource
      }
    }, () => {
      if (shouldShowLoading) {
        setBusy(false);
      }
      setStatus(chrome.runtime.lastError ? "Could not save." : successText);
    });
  }, 160);
}

function pushState(successText, shouldShowLoading = false, loadingText = "Applying...") {
  updateControls();
  broadcast(currentTheme, enabled);
  save(currentTheme, enabled, successText, shouldShowLoading, loadingText);
}

function ensureFallbackActiveTheme() {
  if (!enabled) {
    activeSource = null;
    return;
  }

  if (!activeSource) {
    activeSource = { type: "preset", key: DEFAULT_PRESET_KEY };
    currentTheme = sanitize(PRESETS[DEFAULT_PRESET_KEY].theme);
    draftTheme = sanitize(currentTheme);
  }
}

function restoreEditorState(successText, shouldShowLoading = false, loadingText = "Applying...") {
  const previousState = editorSession;
  editorSession = null;
  editorVisible = false;
  editingSlotIndex = null;

  if (!previousState) {
    ensureFallbackActiveTheme();
    pushState(successText, shouldShowLoading, loadingText);
    return;
  }

  enabled = previousState.enabled;
  activeSource = previousState.activeSource ? { ...previousState.activeSource } : null;

  if (enabled) {
    currentTheme = resolveThemeFromSource(activeSource)
      || sanitize(previousState.theme)
      || sanitize(PRESETS[DEFAULT_PRESET_KEY].theme);
    draftTheme = sanitize(currentTheme);
    ensureFallbackActiveTheme();
  } else {
    currentTheme = sanitize(previousState.theme || currentTheme);
    draftTheme = sanitize(currentTheme);
  }

  pushState(successText, shouldShowLoading, loadingText);
}

function applyTheme(theme, successText = "Saved locally. Applies live.", shouldShowLoading = false, loadingText = "Applying...") {
  editorSession = null;
  enabled = true;
  currentTheme = sanitize(theme);
  draftTheme = sanitize(theme);
  pushState(successText, shouldShowLoading, loadingText);
}

function applyPreset(theme, presetKey = DEFAULT_PRESET_KEY) {
  editorVisible = false;
  editingSlotIndex = null;
  activeSource = { type: "preset", key: presetKey };
  applyTheme(theme, "Preset applied and saved.", true, "Applying preset...");
}

function applyCustomTheme(slot, index) {
  if (!slot) {
    return;
  }

  editorVisible = false;
  editingSlotIndex = null;
  activeSource = { type: "custom", index };
  applyTheme(slot.theme, `${slot.name} applied and saved.`, true, "Applying custom theme...");
}

function updateDraftTheme(partialTheme) {
  draftTheme = sanitize({ ...draftTheme, ...partialTheme });
  updateControls();
  broadcast(draftTheme, true);
  setStatus("Previewing custom theme.");
}

function openCustomizer(baseTheme = currentTheme, slotIndex = null) {
  if (!editorSession) {
    editorSession = {
      enabled,
      theme: sanitize(currentTheme),
      activeSource: activeSource ? { ...activeSource } : null
    };
  }

  draftTheme = sanitize(baseTheme);
  editorVisible = true;
  editingSlotIndex = Number.isInteger(slotIndex) ? slotIndex : null;
  updateControls();
  broadcast(draftTheme, true);

  if (editingSlotIndex === null) {
    setStatus("Theme editor open. Adjust colors, then save to one of the three custom slots.");
  } else {
    setStatus(`${getCustomSlotName(editingSlotIndex)} loaded into the editor. Adjust colors, then save.`);
  }
}

function closeCustomizer() {
  restoreEditorState(getDefaultSaveStatus(enabled));
}

function saveToCustomSlot(index) {
  const safeTheme = sanitize(draftTheme);
  customThemes[index] = {
    name: getCustomSlotName(index),
    theme: safeTheme
  };

  if (editorSession?.activeSource?.type === "custom" && editorSession.activeSource.index === index) {
    editorSession.theme = safeTheme;
  }

  restoreEditorState(`${getCustomSlotName(index)} saved.`, true, "Saving custom theme...");
}

function deleteCustomSlot(index) {
  const wasAppliedCustom = enabled && activeSource?.type === "custom" && activeSource.index === index;
  customThemes[index] = null;

  if (editingSlotIndex === index) {
    editorVisible = false;
    editingSlotIndex = null;
    editorSession = null;
  }

  if (wasAppliedCustom) {
    const fallbackPreset = PRESETS[DEFAULT_PRESET_KEY];
    activeSource = { type: "preset", key: DEFAULT_PRESET_KEY };
    currentTheme = sanitize(fallbackPreset.theme);
    draftTheme = sanitize(fallbackPreset.theme);
    enabled = true;
    editorSession = null;
    pushState(`${getCustomSlotName(index)} deleted. ${fallbackPreset.name} applied.`, true, "Deleting custom theme...");
    return;
  }

  updateControls();
  save(currentTheme, enabled, `${getCustomSlotName(index)} deleted.`, true, "Deleting custom theme...");
}

function disableTheme() {
  editorSession = null;
  enabled = false;
  editorVisible = false;
  editingSlotIndex = null;
  updateControls();
  broadcast(currentTheme, false);
  save(currentTheme, false, getDefaultSaveStatus(false), true, "Disabling theme...");
}

function enableTheme() {
  editorVisible = false;
  editingSlotIndex = null;
  applyTheme(currentTheme, "Theme enabled and applied.", true, "Enabling theme...");
}

function toggleThemeEnabled() {
  if (enabled) {
    disableTheme();
    return;
  }

  enableTheme();
}

function createPreset(key, preset) {
  const button = document.createElement("button");
  button.className = "preset";
  button.type = "button";
  button.dataset.preset = key;

  const text = document.createElement("div");
  const name = document.createElement("div");
  const desc = document.createElement("div");

  name.className = "preset-name";
  desc.className = "preset-desc";
  name.textContent = preset.name;
  desc.textContent = preset.description;

  text.append(name, desc);
  button.append(text, renderSwatches(preset.theme));
  button.addEventListener("click", () => applyPreset(preset.theme, key));

  return button;
}

function createField(key, labelText, hintText) {
  const row = document.createElement("div");
  row.className = "color-row";

  const label = document.createElement("label");
  const name = document.createElement("span");
  const hint = document.createElement("span");
  name.textContent = labelText;
  hint.className = "field-hint";
  hint.textContent = hintText;
  label.append(name, hint);
  label.htmlFor = `${key}-color`;

  const color = document.createElement("input");
  color.id = `${key}-color`;
  color.type = "color";
  color.dataset.key = key;

  const text = document.createElement("input");
  text.type = "text";
  text.maxLength = 7;
  text.spellcheck = false;
  text.dataset.key = key;

  color.addEventListener("input", () => updateDraftTheme({ [key]: color.value }));

  text.addEventListener("input", () => {
    const value = text.value.trim().toLowerCase();

    if (!isHex(value)) {
      setStatus("Use #RRGGBB.");
      return;
    }

    updateDraftTheme({ [key]: value });
  });

  text.addEventListener("blur", () => updateControls());

  row.append(label, color, text);
  return row;
}

/* Slot cards and save buttons are rebuilt only when what they show changes.
   Rebuilding them on every color input or blur swallowed the next click. */
function renderCustomThemeSlots() {
  const key = JSON.stringify([customThemes, editorVisible, editingSlotIndex, enabled, activeSource]);

  if (key === renderedSlotsKey) {
    return;
  }

  renderedSlotsKey = key;
  const container = document.getElementById("customThemeSlots");
  container.textContent = "";

  customThemes.forEach((slot, index) => {
    const card = document.createElement("article");
    card.className = "custom-theme";

    if (!slot) {
      card.classList.add("is-empty");
    } else if (!editorVisible && enabled && activeSource?.type === "custom" && activeSource.index === index) {
      card.classList.add("active");
    }

    const top = document.createElement("div");
    top.className = "custom-theme-top";

    const meta = document.createElement("div");
    const name = document.createElement("div");
    const desc = document.createElement("div");
    name.className = "custom-theme-name";
    desc.className = "custom-theme-desc";
    name.textContent = getCustomSlotName(index);
    desc.textContent = slot ? "Saved custom palette." : "Empty slot.";
    meta.append(name, desc);

    const actions = document.createElement("div");
    actions.className = "custom-theme-actions";

    if (slot) {
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "mini-btn";
      applyButton.textContent = "Apply";
      applyButton.addEventListener("click", () => applyCustomTheme(slot, index));

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "mini-btn";
      editButton.textContent = isEditingSlot(index) ? "Close" : "Edit";
      editButton.addEventListener("click", () => {
        if (isEditingSlot(index)) {
          closeCustomizer();
          return;
        }

        openCustomizer(slot.theme, index);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "mini-btn";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteCustomSlot(index));

      actions.append(applyButton, editButton, deleteButton);
      card.append(renderSwatches(slot.theme));
    } else {
      const createButton = document.createElement("button");
      createButton.type = "button";
      createButton.className = "mini-btn";
      createButton.textContent = isEditingSlot(index) ? "Close" : "Create";
      createButton.addEventListener("click", () => {
        if (isEditingSlot(index)) {
          closeCustomizer();
          return;
        }

        openCustomizer(currentTheme, index);
      });
      actions.appendChild(createButton);
    }

    top.append(meta, actions);
    card.prepend(top);
    container.appendChild(card);
  });
}

function renderSaveSlotActions() {
  const key = String(editingSlotIndex);

  if (key === renderedSaveActionsKey) {
    return;
  }

  renderedSaveActionsKey = key;
  const container = document.getElementById("saveSlotActions");
  container.textContent = "";

  for (let index = 0; index < CUSTOM_THEME_LIMIT; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-btn";
    button.textContent = editingSlotIndex === index
      ? `Update ${getCustomSlotName(index)}`
      : `Save to ${getCustomSlotName(index)}`;
    button.addEventListener("click", () => saveToCustomSlot(index));
    container.appendChild(button);
  }
}

function init() {
  const presetContainer = document.getElementById("presetControls");
  const colorContainer = document.getElementById("colorControls");
  const disableButton = document.getElementById("resetDefaults");

  for (const [key, preset] of Object.entries(PRESETS)) {
    presetContainer.appendChild(createPreset(key, preset));
  }

  for (const [key, label, hint] of FIELDS) {
    colorContainer.appendChild(createField(key, label, hint));
  }

  disableButton.addEventListener("click", toggleThemeEnabled);

  chrome.storage.local.get({
    [STORAGE_KEY]: {
      enabled: true,
      theme: DEFAULT_THEME,
      customThemes: EMPTY_CUSTOM_THEMES
    }
  }, (result) => {
    const state = normalizeState(result[STORAGE_KEY]);
    const hadActiveSource = Boolean(state.activeSource);
    enabled = state.enabled;
    currentTheme = state.theme;
    draftTheme = state.theme;
    customThemes = state.customThemes;
    activeSource = state.activeSource;

    ensureFallbackActiveTheme();

    updateControls();
    broadcast(currentTheme, enabled);
    if (enabled && !hadActiveSource) {
      save(currentTheme, enabled, "Default theme selected.");
    }
    setStatus(getDefaultSaveStatus(enabled));
  });
}

init();
