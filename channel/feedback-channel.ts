#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import { writeFileSync, unlinkSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// --- Config ---
const WS_PORT = parseInt(process.env.FEEDBACK_WS_PORT || '9420', 10)
const CHANNEL_ID = randomUUID()
const CWD = process.cwd()
const RECONNECT_DELAY = 2000

// --- Session name discovery ---
import { basename } from 'path'
import { readdirSync } from 'fs'

function getSessionName(): string | null {
  try {
    const sessionPath = join(homedir(), '.claude', 'sessions', `${process.ppid}.json`)
    if (!existsSync(sessionPath)) return null

    // Strip null bytes from session file (Claude writes fixed-size files)
    let raw = readFileSync(sessionPath, 'utf-8').replace(/\0/g, '').trim()
    if (raw.endsWith(',')) raw = raw.slice(0, -1) + '}'
    const data = JSON.parse(raw)

    // 1. Explicit name field in session JSON
    if (data.name) return data.name

    // 2. customTitle in project JSONL (set by /rename)
    const sessionId = data.sessionId
    if (sessionId) {
      const projectDir = join(homedir(), '.claude', 'projects')
      if (existsSync(projectDir)) {
        for (const dir of readdirSync(projectDir)) {
          const jsonlPath = join(projectDir, dir, `${sessionId}.jsonl`)
          if (existsSync(jsonlPath)) {
            const firstLine = readFileSync(jsonlPath, 'utf-8').split('\n')[0]
            if (firstLine) {
              const entry = JSON.parse(firstLine)
              if (entry.type === 'custom-title' && entry.customTitle) {
                return entry.customTitle
              }
            }
          }
        }
      }
    }
  } catch {}
  return null
}

// Lazy: re-read each time (name may appear after /rename)
function getSessionNameCached(): string | null {
  return getSessionName() || basename(CWD)
}

// --- Session file (for statusline discovery) ---
const runtimeDir = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`
const sessionFile = `${runtimeDir}/peekback-channel-${process.pid}.session`
writeFileSync(sessionFile, `${CHANNEL_ID}\n${process.ppid}`)
process.on('exit', () => { try { unlinkSync(sessionFile) } catch {} })

// --- Role: hub or client ---
let role: 'hub' | 'client' | 'init' = 'init'
let wss: WebSocketServer | null = null
let hubWs: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

// --- Hub state: tracks extension connections AND peer channel connections ---
// Extension sessions (from browser extension)
interface ExtSession {
  kind: 'extension'
  id: string
  ws: WebSocket
  metadata: Record<string, unknown>
  connectedAt: number
}

// Peer channel sessions (from other Claude Code channels)
interface PeerChannel {
  kind: 'channel'
  channelId: string
  ws: WebSocket
  cwd: string
  name: string | null
  connectedAt: number
}

const extSessions = new Map<string, ExtSession>()
const peerChannels = new Map<string, PeerChannel>()

// --- MCP Server ---
const mcp = new Server(
  { name: 'peekback', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions:
      'Feedback from the Claude Feedback browser extension arrives as <channel source="peekback" ...>. ' +
      'They contain user feedback on DOM elements or screenshots from web pages they are developing. ' +
      'The feedback includes a fingerprint of the selected element (selector, outerHTML, textContent, attributes, component name) and the page URL. ' +
      'Use this context to locate the element in source code and make the requested changes. ' +
      'After acting, reply using the reply tool with the session_id from the tag so the user sees your response in the extension sidebar. ' +
      'You can also use the highlight tool to highlight elements in the page after making changes.',
  },
)

// --- Tools ---
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'reply',
      description: 'Send a reply to the user in the browser extension sidebar',
      inputSchema: {
        type: 'object' as const,
        properties: {
          session_id: { type: 'string', description: 'The session_id from the channel tag' },
          message: { type: 'string', description: 'The reply message (supports markdown)' },
        },
        required: ['session_id', 'message'],
      },
    },
    {
      name: 'highlight',
      description: 'Highlight a DOM element in the browser page',
      inputSchema: {
        type: 'object' as const,
        properties: {
          session_id: { type: 'string', description: 'The session_id from the channel tag' },
          selector: { type: 'string', description: 'CSS selector of the element to highlight' },
          label: { type: 'string', description: 'Optional label to display on the highlight' },
        },
        required: ['session_id', 'selector'],
      },
    },
  ],
}))

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = req.params.arguments as Record<string, string>

  if (req.params.name === 'reply') {
    const { session_id, message } = args
    if (!session_id || !message) throw new Error('reply requires session_id and message')
    sendToExtension({ type: 'reply', session_id, message })
    return { content: [{ type: 'text', text: 'Reply sent' }] }
  }

  if (req.params.name === 'highlight') {
    const { session_id, selector, label } = args
    if (!session_id || !selector) throw new Error('highlight requires session_id and selector')
    sendToExtension({ type: 'highlight', session_id, selector, label: label || null })
    return { content: [{ type: 'text', text: `Highlight sent for ${selector}` }] }
  }

  throw new Error(`Unknown tool: ${req.params.name}`)
})

// --- Send message to extension (works whether hub or client) ---
function sendToExtension(msg: Record<string, unknown>) {
  if (role === 'hub') {
    // Broadcast to all connected extensions
    const json = JSON.stringify(msg)
    for (const ext of extSessions.values()) {
      if (ext.ws.readyState === WebSocket.OPEN) ext.ws.send(json)
    }
  } else if (role === 'client' && hubWs?.readyState === WebSocket.OPEN) {
    // Ask hub to forward to extension
    hubWs.send(JSON.stringify({ type: 'forward_to_extension', payload: msg }))
  }
}

// --- Hub: forward a feedback message to the right channel's MCP ---
function hubForwardToChannel(targetChannelId: string, msg: Record<string, unknown>) {
  if (targetChannelId === CHANNEL_ID) {
    // It's for us (the hub)
    handleFeedbackFromExtension(msg)
    return
  }
  const peer = peerChannels.get(targetChannelId)
  if (peer && peer.ws.readyState === WebSocket.OPEN) {
    peer.ws.send(JSON.stringify({ type: 'feedback_for_you', payload: msg }))
  }
}

// --- Handle feedback (element_feedback, screenshot, free_message) destined for THIS channel's MCP ---
function handleFeedbackFromExtension(msg: Record<string, unknown>) {
  const feedbackType = msg.type as string
  process.stderr.write(`[Channel] Handling ${feedbackType} for MCP\n`)

  if (feedbackType === 'element_feedback') {
    mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: msg.comment as string,
        meta: {
          source: 'peekback',
          type: 'element_feedback',
          url: msg.url as string || '',
          selector: msg.selector as string || '',
          outerHTML: msg.outerHTML as string || '',
          textContent: msg.textContent as string || '',
          attributes: JSON.stringify(msg.attributes || {}),
          component: msg.component as string || '',
          context: JSON.stringify(msg.context || {}),
          session_id: msg.session_id as string || '',
        },
      },
    })
  } else if (feedbackType === 'screenshot') {
    const comment = (msg.comment as string) || 'Screenshot captured'
    const imageData = (msg.image as string || '').replace(/^data:image\/png;base64,/, '')

    // Save screenshot to temp file so Claude can read it with the Read tool
    let imagePath = ''
    if (imageData) {
      const screenshotDir = '/tmp/peekback/screenshots'
      if (!existsSync(screenshotDir)) {
        mkdirSync(screenshotDir, { recursive: true })
      }
      const filename = `screenshot-${Date.now()}.png`
      imagePath = join(screenshotDir, filename)
      writeFileSync(imagePath, Buffer.from(imageData, 'base64'))
      process.stderr.write(`[Channel] Screenshot saved to ${imagePath}\n`)
    }

    mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: `${comment}\n\nScreenshot saved at: ${imagePath}\nUse the Read tool to view the image.`,
        meta: {
          source: 'peekback',
          type: 'screenshot',
          url: msg.url as string || '',
          image_path: imagePath,
          session_id: msg.session_id as string || '',
        },
      },
    })
  } else if (feedbackType === 'free_message') {
    mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: msg.comment as string,
        meta: {
          source: 'peekback',
          type: 'free_message',
          url: msg.url || '',
          session_id: msg.session_id,
        },
      },
    })
  }
}

// --- Build channels list (for extension session selector) ---
function getChannelsList() {
  const list = [
    { channelId: CHANNEL_ID, cwd: CWD, name: getSessionNameCached(), connectedAt: Date.now() },
  ]
  for (const peer of peerChannels.values()) {
    list.push({ channelId: peer.channelId, cwd: peer.cwd, name: peer.name, connectedAt: peer.connectedAt })
  }
  return list
}

function broadcastChannelsListToExtensions() {
  const msg = { type: 'channels_list', channels: getChannelsList() }
  const json = JSON.stringify(msg)
  for (const ext of extSessions.values()) {
    if (ext.ws.readyState === WebSocket.OPEN) ext.ws.send(json)
  }
}

// ============================================================
// --- HUB MODE ---
// ============================================================
function startAsHub() {
  role = 'hub'
  process.stderr.write(`[Hub] Starting WebSocket server on ws://localhost:${WS_PORT}\n`)

  wss = new WebSocketServer({ port: WS_PORT })

  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(`[Hub] Port ${WS_PORT} in use, switching to client mode\n`)
      role = 'init'
      startAsClient()
    }
  })

  wss.on('connection', (ws) => {
    let clientType: 'unknown' | 'extension' | 'channel' = 'unknown'
    let clientId: string | null = null

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw.toString()) } catch { return }
      const type = msg.type as string

      // --- Extension subscribing ---
      if (type === 'subscribe' && !msg.is_channel) {
        clientType = 'extension'
        clientId = (msg.session_id as string) || randomUUID()
        extSessions.set(clientId, {
          kind: 'extension',
          id: clientId,
          ws,
          metadata: (msg.metadata as Record<string, unknown>) || {},
          connectedAt: Date.now(),
        })
        ws.send(JSON.stringify({
          type: 'subscribed',
          session_id: clientId,
          channels: getChannelsList(),
        }))
        process.stderr.write(`[Hub] Extension subscribed: ${clientId}\n`)
        return
      }

      // --- Peer channel registering ---
      if (type === 'channel_register') {
        clientType = 'channel'
        clientId = msg.channel_id as string
        peerChannels.set(clientId, {
          kind: 'channel',
          channelId: clientId,
          ws,
          cwd: msg.cwd as string,
          name: (msg.name as string) || null,
          connectedAt: Date.now(),
        })
        ws.send(JSON.stringify({ type: 'channel_registered', channel_id: clientId }))
        process.stderr.write(`[Hub] Peer channel registered: ${clientId} (${msg.cwd})\n`)
        broadcastChannelsListToExtensions()
        return
      }

      // --- Extension sending feedback targeted at a specific channel ---
      if (type === 'element_feedback' || type === 'screenshot' || type === 'free_message') {
        const targetChannel = msg.target_channel as string
        if (targetChannel) {
          hubForwardToChannel(targetChannel, msg)
        } else {
          // No target = send to hub's own MCP (this channel)
          handleFeedbackFromExtension(msg)
        }
        return
      }

      // --- Extension requesting channels list ---
      if (type === 'get_channels') {
        ws.send(JSON.stringify({ type: 'channels_list', channels: getChannelsList() }))
        return
      }

      // --- Peer channel asking to forward a message to extensions ---
      if (type === 'forward_to_extension') {
        const payload = msg.payload as Record<string, unknown>
        const json = JSON.stringify(payload)
        for (const ext of extSessions.values()) {
          if (ext.ws.readyState === WebSocket.OPEN) ext.ws.send(json)
        }
        return
      }
    })

    ws.on('close', () => {
      if (clientType === 'extension' && clientId) {
        extSessions.delete(clientId)
        process.stderr.write(`[Hub] Extension disconnected: ${clientId}\n`)
      }
      if (clientType === 'channel' && clientId) {
        peerChannels.delete(clientId)
        process.stderr.write(`[Hub] Peer channel disconnected: ${clientId}\n`)
        broadcastChannelsListToExtensions()
      }
    })
  })
}

// ============================================================
// --- CLIENT MODE ---
// ============================================================
function startAsClient() {
  role = 'client'
  process.stderr.write(`[Client] Connecting to hub at ws://localhost:${WS_PORT}\n`)

  hubWs = new WebSocket(`ws://localhost:${WS_PORT}`)

  hubWs.on('open', () => {
    process.stderr.write(`[Client] Connected to hub\n`)
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    // Register as a peer channel
    hubWs!.send(JSON.stringify({
      type: 'channel_register',
      channel_id: CHANNEL_ID,
      cwd: CWD,
      name: getSessionNameCached(),
    }))
  })

  hubWs.on('message', (raw) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw.toString()) } catch { return }
    const type = msg.type as string

    // Hub forwarding feedback to us
    if (type === 'feedback_for_you') {
      const payload = msg.payload as Record<string, unknown>
      handleFeedbackFromExtension(payload)
      return
    }

    if (type === 'channel_registered') {
      process.stderr.write(`[Client] Registered with hub as ${msg.channel_id}\n`)
      return
    }
  })

  hubWs.on('close', () => {
    process.stderr.write(`[Client] Disconnected from hub\n`)
    hubWs = null
    // Hub died — try to become the new hub
    scheduleRoleSwitch()
  })

  hubWs.on('error', () => {
    hubWs = null
    scheduleRoleSwitch()
  })
}

function scheduleRoleSwitch() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    process.stderr.write(`[Client] Hub gone, attempting to become hub...\n`)
    tryStart()
  }, RECONNECT_DELAY)
}

// ============================================================
// --- Startup: try hub first, fallback to client ---
// ============================================================
function tryStart() {
  // Try to bind the port. If it fails with EADDRINUSE, switch to client.
  const testServer = new WebSocketServer({ port: WS_PORT })

  testServer.on('listening', () => {
    // We got the port — close the test server and start for real
    testServer.close(() => {
      startAsHub()
    })
  })

  testServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(`[Init] Port ${WS_PORT} in use, starting as client\n`)
      startAsClient()
    } else {
      process.stderr.write(`[Init] Unexpected error: ${err.message}\n`)
      // Retry after delay
      setTimeout(tryStart, RECONNECT_DELAY)
    }
  })
}

// --- Start MCP + WS ---
await mcp.connect(new StdioServerTransport())
tryStart()
