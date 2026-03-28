# Claude Feedback Browser Extension

A browser extension (Chrome + Firefox) that lets you send visual feedback on DOM elements and screenshots directly to Claude Code via an MCP channel.

## How it works

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER EXTENSION                     │
│                                                          │
│  Content Script         Side Panel      Background SW    │
│  ┌──────────────┐  msg  ┌──────────┐  msg  ┌─────────┐ │
│  │ DOM Inspector │◄════►│ Chat UI  │◄════►│ WS      │ │
│  │ Highlights    │      │ Actions  │      │ client  │ │
│  └──────────────┘      └──────────┘      └────┬────┘ │
│                                                │      │
└────────────────────────────────────────────────┼──────┘
                                                 │ ws://localhost:9420
┌────────────────────────────────────────────────▼──────┐
│                 MCP CHANNEL (TypeScript)               │
│  WS Server ─── Session Manager ─── MCP stdio ↔ Claude │
└───────────────────────────────────────────────────────┘
```

### Features

- **DOM Inspector** — Select any element on a page (hover highlight + click select), add a comment, and send it to Claude Code with a multi-signal fingerprint (CSS selector, outerHTML, textContent, attributes, React/Vue component name)
- **Area Screenshot** — Draw a selection rectangle on the page, capture just that area, and send it to Claude with a comment. Screenshots are saved as PNG files that Claude can visually inspect.
- **Free Messages** — Send text messages directly to Claude from the sidebar
- **Bidirectional** — Claude can reply in the sidebar and highlight elements remotely on the page
- **Multi-session** — Hub/client architecture allows multiple Claude Code sessions to share a single WebSocket port. The first channel becomes the hub; subsequent ones connect as clients. If the hub dies, a client takes over.
- **Chrome + Firefox** — Single codebase with separate manifests. Firefox CSP override for `ws://localhost`.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Build the extension

```bash
./scripts/build.sh
```

This generates `dist/chrome/` and `dist/firefox/`.

### 3. Load the extension

**Firefox:** Go to `about:debugging` → "Load Temporary Add-on" → select `dist/firefox/manifest.json`

**Chrome:** Go to `chrome://extensions` → Enable Developer Mode → "Load unpacked" → select `dist/chrome/`

### 4. Configure MCP in Claude Code

Add to your `~/.claude.json` (global) or project `.mcp.json`:

```json
{
  "mcpServers": {
    "claude-feedback": {
      "type": "stdio",
      "command": "bun",
      "args": ["/path/to/claude-feedback-browser-ext/channel/feedback-channel.ts"]
    }
  }
}
```

### 5. Launch Claude Code with channel support

```bash
claude --dangerously-load-development-channels server:claude-feedback
```

### 6. Open the sidebar

Click the extension icon in your browser. The sidebar shows connection status and available channels.

## Architecture

### Extension components

| Component | Role |
|-----------|------|
| `content/inspector.js` | DOM inspector (hover/click/select) + fingerprint extraction + area screenshot selection |
| `content/highlight.js` | Remote highlight overlays (show/dismiss/toggle) |
| `content/content.css` | Overlay styles |
| `sidepanel/` | Chat UI, actions, channel selector |
| `background/service-worker.js` | WebSocket client, message routing, screenshot capture |

### MCP Channel

| Feature | Description |
|---------|-------------|
| Hub/Client | First channel binds port → hub. Others connect as clients. Auto-failover. |
| Tools | `reply(session_id, message)`, `highlight(session_id, selector, label?)` |
| Notifications | `element_feedback`, `screenshot`, `free_message` → Claude via `notifications/claude/channel` |
| Screenshots | Saved as PNG in `/tmp/claude-feedback-screenshots/` for Claude to read visually |

### Element Fingerprint

When you select a DOM element, the extension extracts:

| Signal | Purpose |
|--------|---------|
| CSS selector | Structural location in DOM |
| outerHTML (truncated) | Grep in source code |
| textContent | Find in templates/i18n |
| attributes | class, id, data-*, role, aria-* |
| component | React/Vue component name (dev mode) |
| context | Parent + sibling summary |

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `FEEDBACK_WS_PORT` | `9420` | WebSocket server port |

## Requirements

- [Bun](https://bun.sh/) (for running the TypeScript MCP channel)
- Chrome 114+ or Firefox (latest)
- Claude Code with `--dangerously-load-development-channels` flag

## License

[CC BY-NC 4.0](LICENSE) — Free to use and modify, not for commercial purposes.
