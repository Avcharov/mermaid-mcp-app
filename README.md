# Mermaid MCP App

A streamable MCP App server that renders interactive Mermaid diagrams with live preview, theme switching, and fullscreen editing.

## Features

- **Complete Rendering** - Waits for full diagram generation before displaying (no partial/streaming output)
- **SVGO Optimization** - Automatic SVG optimization reduces file size by ~85%
- **Dark Mode** - Auto-detects system theme with neutral gray palette
- **Interactive Pan/Zoom** - Navigate large diagrams with wheel zoom and drag controls
- **Fullscreen Editor** - Edit Mermaid syntax with live preview, zoom controls (+/−/1:1)
- **Theme Switching** - Light, Dark, or Custom (agent-provided) themes
- **All Diagram Types** - Flowcharts, sequence, class, state, ER, gantt, pie, git graphs, and more
- **Export with Spinner** - Copy SVGO-optimized SVG to clipboard (spinner indicates progress)
- **Client-side Rendering** - No server dependencies, runs entirely in the browser

## Quick Start

### Remote (Vercel)

Use the hosted endpoint: `https://mermaid-mcp-app.vercel.app/mcp`

Add as a remote MCP server in your client. For example, in [claude.ai](https://claude.ai): **Settings** → **Connectors** → **Add custom connector** → paste the URL above.

## Installation

```bash
npm install
```

## Development

Start the development server with hot-reload:

```bash
npm run dev
```

The server will start at `http://localhost:3001/mcp`

## Build

Build for production:

```bash
npm run build
```

This creates:
- `dist/mcp-app.html` - Single-file bundled UI
- `dist/server.js` - MCP server
- `dist/index.js` - CLI entry point

## Usage

### Local (HTTP)

```bash
npm run serve
# or
node dist/index.js
```

### Local (stdio)

```bash
node dist/index.js --stdio
```

### Vercel Deployment

Deploy to Vercel for remote access:

```bash
npx vercel
```

The MCP endpoint will be available at `https://mermaid-mcp-app.vercel.app/mcp`

## MCP Tools

### `read_me`

Returns comprehensive Mermaid syntax reference with examples for all diagram types.

**Usage**: Call this before `create_view` to learn Mermaid syntax.

### `create_view`

Renders a Mermaid diagram. The diagram is fully rendered before being displayed (no progressive/streaming rendering).

**Parameters**:
- `mermaid` (string, required) - Mermaid diagram syntax
- `theme` (string, optional) - One of: `default` (auto-detect), `forest`, `dark`, `neutral`, `base`
- `title` (string, optional) - Title to display above the diagram

**Notes**:
- Default theme auto-detects system dark mode and applies neutral gray palette
- Agent can specify built-in Mermaid themes (`forest`, `dark`, `neutral`, `base`) which appear as "Custom" in UI
- Fullscreen mode includes zoom controls (+, −, 1:1, wheel zoom) and pan/drag

**Example**:
```typescript
{
  "mermaid": "flowchart TD\n  A[Start] --> B[End]",
  "theme": "forest",
  "title": "Simple Flow"
}
```

### `export_svg` (app-only)

Export the rendered diagram as optimized SVG using SVGO. Called by the UI export button (spinner icon during processing).

**Optimization**:
- SVGO reduces SVG size by ~85% (e.g., 334KB → 51KB)
- Rounds coordinates to 2 decimal places
- Preserves viewBox and mermaid IDs for proper rendering

## Architecture

- **Server**: Node.js with Express + MCP SDK
  - Supports both Streamable HTTP and stdio transports
  - Stateless per-request design (no sessions)
- **UI**: React 19 with Mermaid.js
  - Loaded from CDN (jsdelivr for Mermaid, esm.sh for React) via importmap
  - Client-side rendering for zero server dependencies
  - Single-file HTML bundle (~402KB) via Vite + vite-plugin-singlefile
  - SVGO server-side optimization for exports
- **Build**: TypeScript + Vite + Bun
  - Type-safe server and client code
  - Optimized production bundles

## File Structure

```
mermaid-mcp-app/
├── src/
│   ├── server.ts          # MCP server with tool registration + SVGO
│   ├── main.ts            # Transport layer (HTTP + stdio)
│   ├── mcp-app.html       # HTML shell with importmap
│   ├── mcp-app.tsx        # React UI component
│   ├── theme-vars.ts      # Mermaid theme color palettes
│   └── global.css         # Styles (dark mode, animations)
├── api/
│   └── mcp.ts            # Vercel serverless handler
├── dist/                  # Build output
├── scripts/
│   └── setup-bun.mjs     # Auto-install bun
├── package.json
├── tsconfig.json          # Client TS config
├── tsconfig.server.json   # Server TS config
├── vite.config.ts         # Vite bundler config
├── vercel.json           # Vercel deployment config
└── manifest.json         # MCP app manifest
```

## Technologies

- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol
- [ext-apps](https://github.com/modelcontextprotocol/ext-apps) - MCP Apps extension
- [Mermaid.js](https://mermaid.js.org/) - Diagram generation
- [SVGO](https://github.com/svg/svgo) - SVG optimization (server-side)
- [React 19](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Bun](https://bun.sh/) - Build bundler

## License

MIT
