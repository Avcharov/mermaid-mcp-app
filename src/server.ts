import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "..", "dist")
  : import.meta.dirname;

// ============================================================
// RECALL: Mermaid diagram syntax reference
// ============================================================
const MERMAID_CHEAT_SHEET = `# Mermaid Diagram Syntax Reference

Thanks for calling read_me! Use create_view to render your Mermaid diagrams with streaming animations.

## CRITICAL: Streaming Rules (MUST FOLLOW)

The diagram renders progressively as you generate code. To ensure smooth streaming:

### Rule 1: One complete statement per line
Each line must be a self-contained, valid piece of syntax.
- GOOD: \`A[Start] --> B[Process]\`
- BAD: Multi-line node definitions spread across lines

### Rule 2: NEVER use \`<br/>\` or HTML tags in node labels
HTML tags break parsing when the line is cut mid-stream.
- GOOD: \`A[Document Rejected]\`
- BAD: \`A[Document<br/>Rejected]\`
If you need multi-line labels, use separate nodes instead.

### Rule 3: Keep node labels short and simple
- GOOD: \`A[Validate Input]\`
- BAD: \`A[Validate the user input data and check for errors in the submission form]\`
Use 2-4 words per label. Add detail via comments, not node text.

### Rule 4: Define connections immediately
Don't define all nodes first then connections. Define each node WITH its connection:
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Valid?}
    B -->|Yes| C[Process]
    B -->|No| D[Error]
    C --> E[End]
    D --> E
\`\`\`

### Rule 5: Avoid subgraphs for streaming
Subgraphs require \`end\` to close, which breaks mid-stream parsing.
- If you must use subgraphs, keep them very short (2-3 nodes max)
- Place the \`end\` keyword immediately after the last node

### Rule 6: Use simple node IDs
Use short IDs: \`A\`, \`B\`, \`C\` or \`step1\`, \`step2\`. Avoid long IDs.

### Rule 7: No special characters in labels
Avoid \`<\`, \`>\`, \`&\`, quotes in node labels. Use plain text only.
- GOOD: \`A[Check if valid]\`
- BAD: \`A[Check <status> & validate]\`

### Rule 8: NEVER use colons (:) or commas (,) in state diagram labels
State diagrams use colons for syntax. Using them in labels causes parse errors.
- BAD: \`S1: Terminal: Reward -1\`
- GOOD: \`S1: Terminal Reward -1\`
- BETTER: \`S1: TerminalReward\`
Replace colons and commas with spaces, dashes, or underscores.

## Diagram Types

### Flowchart
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process 1]
    B -->|No| D[Process 2]
    C --> E[End]
    D --> E
\`\`\`

**Directions:** TD (top-down), LR (left-right), BT (bottom-top), RL (right-left)
**Node shapes:** [Rectangle], (Rounded), ([Stadium]), [[Subroutine]], [(Database)], ((Circle)), >Asymmetric], {Diamond}, {{Hexagon}}, [/Parallelogram/], [\\Trapezoid\\]
**Arrows:** --> (solid), -.-> (dotted), ==> (thick), --text--> (labeled)

### Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B->>A: Hello Alice!
    Note over A,B: They greet each other
\`\`\`

**Arrows:** ->> (solid), -->> (dotted), -x (cross), -) (open)
**Features:** activate/deactivate, loops, alt/else/opt, par, Note over/right of/left of

### Class Diagram
\`\`\`mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +name
    Animal : +age
    Animal: +isMammal()
    class Duck{
        +swim()
        +quack()
    }
\`\`\`

**Relationships:** <|-- (inheritance), *-- (composition), o-- (aggregation), --> (association), -- (link)

### State Diagram
\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: start
    Processing --> Success: complete
    Processing --> Error: fail
    Success --> [*]
    Error --> Idle: retry
\`\`\`

**CRITICAL State Diagram Rules:**
- Transition labels CANNOT contain colons (:) - use dash or space instead
- State descriptions: Use simple text WITHOUT colons, commas, or special chars
- BAD: "State: Description, Value: 5"  → GOOD: "State Description Value 5"
- BAD: "Terminal: Reward -1" → GOOD: "Terminal Reward -1"
- For complex descriptions, use underscores: "Terminal_Reward_Minus_1"
- Keep all labels SHORT and simple (2-4 words max)

### Entity Relationship Diagram
\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
\`\`\`

**Relationships:** ||--|| (one to one), ||--o{ (one to many), }o--o{ (many to many)

### Gantt Chart
\`\`\`mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Research :done, 2024-01-01, 7d
    Design   :active, 2024-01-08, 5d
    section Development
    Backend  :2024-01-13, 10d
    Frontend :2024-01-18, 10d
\`\`\`

### Pie Chart
\`\`\`mermaid
pie
    title Browser Market Share
    "Chrome" : 65
    "Safari" : 20
    "Firefox" : 10
    "Edge" : 5
\`\`\`

### Git Graph
\`\`\`mermaid
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
\`\`\`

### User Journey
\`\`\`mermaid
journey
    title My Day
    section Morning
      Wake up: 5: Me
      Breakfast: 4: Me
    section Work
      Coding: 5: Me
      Meetings: 3: Me, Colleagues
\`\`\`

## Themes

The app auto-detects light/dark mode from the host. Available theme values for the create_view tool:
- **default** - Auto-detect (light or dark based on host)
- **dark** - Force dark mode
- **forest** / **neutral** / **base** - Custom Mermaid built-in palettes (shown as \"Custom\" in the dropdown)

Set theme via the \`theme\` parameter in create_view. Usually omit it to let auto-detection work.

## Styling Tips

### Colors in Flowcharts
\`\`\`mermaid
flowchart LR
    A[Normal]
    B[Styled]:::customClass
    classDef customClass fill:#f9f,stroke:#333,stroke-width:4px
\`\`\`

### Inline Styles
\`\`\`mermaid
flowchart TD
    A[Start]
    B[Process]
    style A fill:#bbf,stroke:#333,stroke-width:2px
    style B fill:#bfb,stroke:#3a3
\`\`\`

## Best Practices

1. **Keep syntax valid** - One syntax error breaks the entire diagram
2. **Use meaningful IDs** - Short node IDs (A, B, C) or descriptive (start, process1)
3. **Label clearly** - Use [Square brackets] for node text to improve readability
4. **Direction matters** - Choose TD/LR based on diagram complexity
5. **Avoid crossing lines** - Reorganize nodes to minimize line crossings
6. **Use subgraphs** - Group related nodes in flowcharts:
   \`\`\`mermaid
   flowchart TD
       subgraph Preprocessing
           A --> B
       end
       subgraph Processing
           C --> D
       end
       B --> C
   \`\`\`

## CRITICAL: Layout & Readability Rules

Mermaid uses automatic layout (Dagre/Elk). You MUST design for it to produce clean diagrams.

### Rule 1: Choose direction wisely
- **LR** (left-right) is BEST for wide diagrams with many parallel paths (grids, state machines, pipelines)
- **TD** (top-down) is best for hierarchical/tree diagrams
- NEVER use TD for grid-like structures (causes massive line crossings)

### Rule 2: Limit connections per node
- Max 3-4 outgoing edges per node. More causes spaghetti lines.
- If a node has 5+ connections, refactor: group into subgraphs OR use intermediate nodes

### Rule 3: Simplify complex graphs - use subgraphs for clusters
For grid-like problems (game boards, matrices, state spaces), group rows/columns:
\`\`\`mermaid
flowchart LR
    subgraph Row1
        direction LR
        A1[S00] --> A2[S01] --> A3[S02]
    end
    subgraph Row2
        direction LR
        B1[S10] --> B2[S11] --> B3[S12]
    end
    A1 --> B1
    A2 --> B2
    A3 --> B3
\`\`\`

### Rule 4: Use invisible links to control layout
\`\`\`mermaid
flowchart LR
    A ~~~ B
\`\`\`
Use \`~~~\` (invisible link) to force node placement without drawing a line.

### Rule 5: For state machines & MDPs — simplify!
- Do NOT draw ALL transitions. Show the MOST IMPORTANT ones.
- Group states by region/type using subgraphs
- Use a legend or note instead of labeling every edge
- For NxN grids, show structure (grid layout) and annotate key transitions
- Use dotted lines for less important transitions: \`A -.-> B\`

### Rule 6: Edge order matters for layout
Mermaid lays out nodes in the order they first appear. Define edges in a logical order:
- Define left-to-right or top-to-bottom connections FIRST
- Define cross-connections AFTER the main flow
- This minimizes edge crossings

### Rule 7: Use link labels sparingly
- Don't label every edge — it adds clutter
- Label only decision branches or key transitions
- Use \`-->|label|\` only when the label adds essential meaning

### Rule 8: For dense graphs, prefer sequence or state diagrams
- Flowcharts with >15 nodes and cross-connections become unreadable
- Use \`stateDiagram-v2\` for state machines instead of flowchart
- Use \`sequenceDiagram\` for process flows with back-and-forth
- Use \`graph\` only for simple DAGs

### Rule 9: Max complexity guidelines
- **Simple** (< 10 nodes): Any diagram type works
- **Medium** (10-20 nodes): Use subgraphs, limit edges, choose LR
- **Complex** (20+ nodes): MUST simplify — split into multiple diagrams, show overview + detail, or omit less important edges

### Rule 10: Color-code for clarity
Use classDef to visually distinguish node types:
\`\`\`mermaid
flowchart LR
    classDef start fill:#4CAF50,color:#fff
    classDef danger fill:#f44336,color:#fff
    classDef goal fill:#2196F3,color:#fff
    A[Start]:::start --> B[Hole]:::danger
    A --> C[Goal]:::goal
\`\`\`

## Common Patterns

### Decision Tree
\`\`\`mermaid
flowchart TD
    Start[User visits site] --> Auth{Logged in?}
    Auth -->|Yes| Dashboard[Show Dashboard]
    Auth -->|No| Login[Show Login]
    Login --> Auth
\`\`\`

### API Flow
\`\`\`mermaid
sequenceDiagram
    Client->>+Server: POST /api/data
    Server->>+Database: Query
    Database-->>-Server: Results
    Server-->>-Client: JSON Response
\`\`\`

### System Architecture
\`\`\`mermaid
flowchart LR
    User((User)) --> Frontend[Web App]
    Frontend --> API[REST API]
    API --> DB[(Database)]
    API --> Cache[(Redis Cache)]
    API --> Queue[Message Queue]
\`\`\`

## Tips for Streaming

- The diagram renders progressively as you send the mermaid syntax
- Syntax errors will show the last valid state
- Complex diagrams (>20 nodes) may take a moment to render
- Use the fullscreen mode for editing and fine-tuning

## Interactive Features

Once rendered, you can:
- **Pan/Zoom** - Navigate large diagrams
- **Fullscreen** - Edit syntax and see live preview
- **Theme Switch** - Change visual theme on the fly
- **Export** - Download as SVG or PNG

Now call **create_view** with your mermaid syntax!

REMEMBER: Follow all Streaming Rules above! No HTML tags, no <br/>, short labels, one statement per line.
`;

/**
 * Registers all Mermaid tools and resources on the given McpServer.
 */
export function registerTools(server: McpServer, distDir: string): void {
  const resourceUri = "ui://mermaid/mcp-app.html";

  // ============================================================
  // Tool 1: read_me (call before drawing)
  // ============================================================
  server.registerTool(
    "read_me",
    {
      description: "Returns the Mermaid syntax reference with diagram types, examples, and tips. Call this BEFORE using create_view for the first time.",
      annotations: { readOnlyHint: true },
    },
    async (): Promise<CallToolResult> => {
      return { content: [{ type: "text", text: MERMAID_CHEAT_SHEET }] };
    },
  );

  // ============================================================
  // Tool 2: create_view (Mermaid diagram rendering)
  // ============================================================
  registerAppTool(
    server,
    "create_view",
    {
      title: "Draw Mermaid Diagram",
      description: `Renders a Mermaid diagram. Call read_me first for syntax.
LAYOUT RULES: Use LR for grids/state machines. Limit 3-4 edges per node. Use subgraphs to cluster related nodes.
For complex graphs (>15 nodes): simplify by omitting less important edges, color-code node types, prefer stateDiagram-v2 for state machines.
NEVER draw ALL transitions in dense graphs — show key paths and annotate.`,
      inputSchema: z.object({
        mermaid: z.string().describe(
          `Mermaid diagram syntax. STREAMING RULES (mandatory):
1. One complete statement per line
2. NEVER use <br/> or any HTML tags in labels
3. Keep labels short: 2-4 words max
4. No special chars (<, >, &) in labels
5. NEVER use colons (:) or commas (,) in state diagram labels
6. Define connections immediately with nodes
7. Avoid subgraphs when possible
8. Use short node IDs (A, B, C or step1, step2)
Call read_me first for full syntax reference.`
        ),
        theme: z
          .enum(["default", "forest", "dark", "neutral", "base"])
          .optional()
          .default("default")
          .describe("Visual theme for the diagram."),
        title: z.string().optional().describe("Optional title to display above the diagram."),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri } },
    },
    async ({ mermaid, theme, title }): Promise<CallToolResult> => {
      if (!mermaid.trim()) {
        return {
          content: [{ type: "text", text: "Error: mermaid syntax cannot be empty." }],
          isError: true,
        };
      }

      const checkpointId = Math.random().toString(36).slice(2, 8);
      
      const titleText = title ? `\n\nTitle: "${title}"` : "";
      
      return {
        content: [
          {
            type: "text",
            text: `Mermaid diagram displayed!${titleText}\n\nCheckpoint ID: "${checkpointId}"\nTheme: ${theme}\n\nThe diagram is now shown inline with streaming animations. Click the expand button for fullscreen editing mode.`,
          },
        ],
        structuredContent: { checkpointId, theme, title },
      };
    },
  );

  // ============================================================
  // Tool 3: export_svg (app-only, called by UI)
  // ============================================================
  registerAppTool(
    server,
    "export_svg",
    {
      description: "Export diagram as SVG or PNG. Called by the UI, not by the model.",
      inputSchema: z.object({
        svg: z.string().describe("SVG content to export"),
        format: z.enum(["svg", "png"]).describe("Export format"),
      }),
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ svg, format }): Promise<CallToolResult> => {
      // For now, just return the SVG content
      // PNG conversion could be added later with a library like sharp
      if (format === "svg") {
        return {
          content: [{ type: "text", text: svg }],
          structuredContent: { svg, format },
        };
      }
      
      return {
        content: [{ type: "text", text: "PNG export not yet implemented. Use SVG format." }],
        isError: true,
      };
    },
  );

  // CSP: allow libs to load from CDN
  const cspMeta = {
    ui: {
      csp: {
        resourceDomains: ["https://cdn.jsdelivr.net", "https://esm.sh"],
        connectDomains: ["https://cdn.jsdelivr.net", "https://esm.sh"],
      },
    },
  };

  // Register the single shared resource for all UI tools
  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(distDir, "src", "mcp-app.html"), "utf-8");
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                ...cspMeta.ui,
                prefersBorder: true,
                permissions: { clipboardWrite: {} },
              },
            },
          },
        ],
      };
    },
  );
}

/**
 * Creates a new MCP server instance with Mermaid diagram tools.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "Mermaid Diagrams",
    version: "1.0.0",
  });
  registerTools(server, DIST_DIR);
  return server;
}
