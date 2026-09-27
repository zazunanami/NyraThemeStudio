# Nyra Theme Studio

A focused, lightweight visual customization extension for ChatGPT. Customize the visual appearance of ChatGPT with premium built-in dark presets or fine-tune specific interface elements with surface-level color controls.
If you want, you can get from [Google Extension Store](https://chromewebstore.google.com/detail/nyra-theme-studio/nfnlmkjllildnlkpbcodfgooapoalpca)
## Features

- **Five Premium Presets**: Switch instantly between Classic Gray, Graphite, Midnight Blue, Warm Charcoal, and Slate Purple.
- **Custom Theme Slots**: Edit, preview, and save up to 3 custom color configurations.
- **Detailed Surface Controls**: Customize specific visual components:
  - Chat background (page, header and the fade behind the input)
  - Message bubble
  - Input box & menus
  - Content panels (code blocks and inline code)
  - Writing block editor
  - Sidebar, with hover and selected shades derived automatically
- **Colors Only**: Nyra recolors ChatGPT's own design tokens. It never changes layout, spacing, sizes, positioning, stacking or scrolling, so ChatGPT's interface keeps working as designed after OpenAI updates.
- **Replaces the Pure Black Look**: Works on top of ChatGPT's OLED-black dark mode and restores a calm, layered palette.
- **Performance Optimized**:
  - Pure CSS custom property injection; no DOM scanning or polling.
  - A single attribute observer on `<html>`/`<body>` follows ChatGPT's dark/light switch.
- **Privacy First**: Fully local. No tracking, no data collection, and no remote calls.

Nyra presets are dark themes, so they apply while ChatGPT's appearance is set to Dark. In Light mode ChatGPT keeps its native look and the popup shows a short note.

## How It Works

ChatGPT paints its interface with design tokens such as `--main-surface-primary`, `--bg-primary`, `--component-sidebar-bg` and `--color-surface`, and it redefines those tokens on every element under its dark root.

1. `content.js` turns the six chosen colors into a small palette of `--nyra-*` custom properties on `<html>` and marks the page with `data-nyra-theme-studio="on"` while ChatGPT is dark.
2. `theme.css` points ChatGPT's tokens at that palette on `<html>` and tells every element to inherit them, so ChatGPT's per-element black values no longer win. Components such as the composer, code blocks and writing blocks re-point the tokens on their own root.
3. A handful of surfaces that ChatGPT paints without a token (the composer, user message bubble, code block shell, inline code, writing blocks) get a `background-color`/`border-color` override and nothing else.

If an OpenAI update ever leaves a surface black, the fix is usually one more token name in the bridge at the top of `theme.css`.

## Installation for Local Testing

1. Clone or download this repository.
2. Open Chrome (or Brave/Edge) and go to `chrome://extensions` (or `brave://extensions`).
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this directory.
5. Open [ChatGPT](https://chatgpt.com) and open the extension popup from your toolbar to apply a theme.

## Build Contents

- `manifest.json` - Extension manifest configuration and permissions
- `content.js` - Builds the palette from the saved colors and keeps the page in sync with ChatGPT's dark/light mode
- `theme.css` - Color-only token bridge that maps ChatGPT's design tokens to the palette
- `popup.html` - Popup control interface
- `popup.css` - Popup styling and responsive layouts
- `popup.js` - Popup logic, presets, theme editor, and storage coordination
- `icons/` - Extension icons (16px, 32px, 48px, 128px)

## Using the Theme Editor

1. Open the extension popup.
2. Click **Create** or **Edit** on a custom slot to open the editor.
3. Adjust the colors using the color pickers or hex text fields. Previews will apply live in your open ChatGPT tabs.
4. Click **Save to Custom [1-3]** to persist the configuration.
5. Click **Disable Theme** in the footer to restore ChatGPT's default style at any time.

## Permissions

Nyra Theme Studio uses the minimum browser permissions needed for local theme preferences and active-tab styling:

- `storage` stores theme preferences locally in your browser.
- `activeTab` is used only when you open the popup, so the selected theme can be applied to the active supported ChatGPT tab.
- Host access is scoped to `chatgpt.com` and `chat.openai.com` only.

## Privacy Policy

Nyra Theme Studio does not collect, sell, transmit, or share personal data. All settings and customized themes are stored locally in your browser using `chrome.storage.local`. The extension runs only on supported ChatGPT domains (`chatgpt.com` and `chat.openai.com`) to apply visual styling. It does not read, store, or transmit your conversations, account info, prompts, or browsing activity.

Disclaimer: Nyra Theme Studio is an independent browser extension and is not affiliated with, endorsed by, or officially connected to OpenAI, Google, or Chrome.

## License

The source code is licensed under the Apache License 2.0. See `LICENSE`.

The project name, logos, icons, screenshots, visual identity, and branding assets are not included in the Apache License 2.0 grant and may not be reused without permission.

---

<details>
<summary>Release History & Changelog</summary>

### v3.0.1
- Fixed a square box showing behind the rounded message input on the new ChatGPT composer. Composer wrappers are no longer painted; the input keeps ChatGPT's own rounded shape and takes its color from the theme tokens.

### v3.0.0
- Rebuilt the theme as a color-only layer for ChatGPT's current interface: it recolors ChatGPT's design tokens instead of restyling individual page elements.
- Fixed the black band behind the message input and the pure black areas left by ChatGPT's OLED dark mode.
- Fixed the sidebar top area showing the chat color instead of the sidebar color.
- Fixed a second message box appearing over the image editor ("Edit image"); the theme no longer changes stacking order.
- Fixed the lighter box inside code blocks; inline code chips now only apply to real inline code.
- Removed every layout override (message width and padding, table sizing, scroll position, `content-visibility`, z-index). Assistant replies use ChatGPT's native layout; the Message bubble color now applies to your own messages.
- Themes apply while ChatGPT is in Dark mode; the popup notes when ChatGPT is in Light mode.
- Popup: each color control describes what it changes, and the first click on Save/Update after typing a hex value is no longer lost.

### v2.0.59
- Slightly reduced the Midnight Blue writing-block editor brightness.

### v2.0.58
- Darkened the default built-in `Writing block editor` palette defaults.

### v2.0.57
- Added a dedicated `Writing block editor` color control.
- Existing saved themes migrate safely: older presets and custom slots inherit `Content panels` for the new writing-block field.

### v2.0.56
- Theme editor previews no longer count as the applied selection while editing.
- Saving or updating a custom slot now restores the theme source that was selected before editing.

### v2.0.55
- The footer action is now a true toggle: after disabling the theme, clicking it again re-enables the saved theme.

### v2.0.54
- Fixed a popup startup crash caused by reading the default preset key before the preset list was initialized.

### v2.0.53
- Custom theme outlines now light up only after an explicit `Apply` action.
- Deleting the currently applied custom theme falls back to the first built-in preset.

### v2.0.52
- Removed the separate top edit button from the Custom Themes header.
- Custom theme card `Edit` and `Create` buttons now open and close the editor directly.

### v2.0.51
- Added a popup loading layer for slower apply, save, delete, and disable clicks.
- Replaced the separate customizer-open wording with a single top `Edit` button.

### v2.0.50
- Added three saved custom theme slots in the popup.
- Moved the color controls into a closed-by-default theme editor.

### v2.0.49
- Removed the old unused bottom gap-fill helpers and the dead gap-fill CSS layer.
- Replaced scroll restoration with a lightweight startup-only jump-to-bottom flow.

### v2.0.48
- Extended footer cleanup to the full bottom sticky shell and its pseudo-elements.

### v2.0.47
- Added exact footer-wrapper coverage for ChatGPT disclaimer containers.

### v2.0.46
- Disabled the experimental bottom gap fill layer because it could render as a black footer band.

### v2.0.45
- Anchors nested table content to the start of its horizontal scroll area.

### v2.0.44
- Constrains the direct table wrapper inside the existing message bubble.

### v2.0.43
- Removed measured table positioning experiment, table DOM tagging, inline width variables, and the table subtree observer.

### v2.0.42
- Replaced wrapper-dependent table centering with measured main-content alignment.

### v2.0.41
- Replaced ChatGPT's asymmetric table-turn padding with equal responsive gutters.

### v2.0.40
- Fixed table content starting underneath the left clipping edge.

### v2.0.39
- Expands only table-containing message turns to the available conversation width.

### v2.0.38
- Keeps wide-table horizontal scrollbars inside the rounded message panel.

### v2.0.37
- Fixed wide tables expanding the entire page and creating detached horizontal scrollbars.
- Restores the active conversation scroll container after refresh.

### v2.0.25
- Added a clear disabled-state visual to the `Disable Theme` footer button.

### v2.0.24
- Fixed the popup after removing the harmonize option; preset cards and color controls render again.

### v2.0.23
- Removed the `Harmonize writing panels` option from the popup.
- Added `content-visibility: auto` for conversation turns to reduce rendering cost.

### v2.0.22
- Rebuilt `theme.css` cleanly to remove accumulated experimental duplicate rules.
- Stopped globally remapping ChatGPT secondary/elevated surface tokens.

### v2.0.21
- Code blocks now inherit the surface behind them instead of forcing the Content panels color.
- Manual color changes are debounced and broadcast after storage save.

### v2.0.20
- Added a targeted code block viewer inner-canvas fix for nested structures.

### v2.0.19
- Removed the square outer plate around rounded writing blocks.

### v2.0.18
- Removed DOM-wide color matching and computed-style scanning.

### v2.0.17
- Added a default-enabled `Match panel color codes` option in the popup.

### v2.0.16
- Disabled the experimental panel DOM tagger.

### v2.0.15
- Rebuilt the panel handling from the stable v2.0.11 base.

### v2.0.11
- Reset now restores the normal ChatGPT appearance by disabling the theme layer.

### v2.0.10
- Remapped ChatGPT secondary/elevated surface tokens to the `Content panels` color.

### v2.0.9
- Updated display name to `Nyra Theme Studio`.
- Added a configurable `Content panels` color.

### v2.0.8
- Fixed icon transparency by removing the baked checkerboard background.

### v2.0.7
- Replaced the extension icon set with the selected neon palette + N icon.

### v2.0.6
- Replaced the icon with a fully transparent-background version.

### v2.0.4
- Rebuilt the icon set with a transparent outer background.

### v2.0.3
- Updated all extension icons to use a transparent outer background.

### v2.0.2
- Replaced the extension icon set with the selected neon palette icon.

</details>

