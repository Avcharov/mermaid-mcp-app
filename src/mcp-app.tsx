import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import mermaid from "mermaid";
import { lightVars, darkVars } from "./theme-vars";
import "./global.css";

// ============================================================
// Types
// ============================================================

interface DiagramState {
  mermaid: string;
  theme: string;
  title?: string;
  checkpointId?: string;
}

interface PanZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

// ============================================================
// Helpers
// ============================================================

const ExpandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 1.5H12.5V5.5" />
    <path d="M5.5 12.5H1.5V8.5" />
    <path d="M12.5 1.5L8 6" />
    <path d="M1.5 12.5L6 8" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
    <path d="M8 2v9" />
    <path d="M5 8l3 3 3-3" />
  </svg>
);

// ============================================================
// Main Component
// ============================================================

const detectDarkMode = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

function MermaidApp() {
  const [hostDark, setHostDark] = useState(detectDarkMode);
  const [diagramState, setDiagramState] = useState<DiagramState>({
    mermaid: "",
    theme: detectDarkMode() ? "dark" : "light",
  });
  // Tracks the agent-provided built-in mermaid theme name (e.g. "forest", "neutral")
  const [agentCustomTheme, setAgentCustomTheme] = useState<string | null>(null);
  const agentCustomThemeRef = useRef<string | null>(null);
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [displayMode, setDisplayMode] = useState<"inline" | "fullscreen">("inline");
  const [panZoom, setPanZoom] = useState<PanZoomState>({ scale: 1, translateX: 0, translateY: 0 });
  const [editedMermaid, setEditedMermaid] = useState("");
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const renderingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const userSelectedThemeRef = useRef(false);

  const { app, error: appError } = useApp({
    appInfo: { name: "Mermaid Diagram App", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinputpartial = async (_input) => {
        setIsStreaming(true);
      };

      app.ontoolinput = async (input) => {
        setIsStreaming(false);
        userSelectedThemeRef.current = false; // Reset for new diagram
        const args = input.arguments as Record<string, unknown>;
        const mermaidSyntax = (args.mermaid as string) || "";
        const explicitTheme = args.theme as string | undefined;
        const isDark = detectDarkMode();
        const title = args.title as string | undefined;

        // Agent sent a specific palette (forest, neutral, base) → "custom"
        // Agent sent "dark" → use our dark vars
        // Otherwise → auto-detect light/dark
        let theme: string;
        if (explicitTheme === "dark") {
          theme = "dark";
          setAgentCustomTheme(null);
          agentCustomThemeRef.current = null;
        } else if (explicitTheme && explicitTheme !== "default" && ["forest", "neutral", "base"].includes(explicitTheme)) {
          theme = "custom";
          setAgentCustomTheme(explicitTheme);
          agentCustomThemeRef.current = explicitTheme;
        } else {
          theme = isDark ? "dark" : "light";
          setAgentCustomTheme(null);
          agentCustomThemeRef.current = null;
        }

        setDiagramState({ mermaid: mermaidSyntax, theme, title });
        setEditedMermaid(mermaidSyntax);
        await renderMermaid(mermaidSyntax, theme, false);
      };

      app.ontoolresult = async (result) => {
        const { checkpointId } = (result.structuredContent || {}) as Partial<DiagramState>;
        if (checkpointId) {
          // Don't let server theme override our dark mode detection
          // Only update checkpointId, keep the theme we already set
          setDiagramState((prev) => ({ ...prev, checkpointId }));
        }
      };

      app.onteardown = async () => {
        console.info("App is being torn down");
        return {};
      };

      app.onerror = (error) => {
        console.error("App error:", error);
        setError(error.message);
      };

      app.onhostcontextchanged = (params) => {
        console.info("Host context changed:", params);
        // Re-detect dark mode when host theme changes
        const isDark = detectDarkMode();
        setHostDark(isDark);
      };
    },
  });

  const renderMermaid = async (syntax: string, theme: string, isPartial = false) => {
    if (!syntax.trim()) return;
    if (renderingRef.current) return; // prevent concurrent renders
    renderingRef.current = true;

    try {
      // "custom" → use the agent's built-in mermaid theme directly
      // "light" / "dark" → use 'base' theme with our custom themeVariables
      const isCustom = theme === 'custom';
      const isDark = theme === 'dark';

      mermaid.initialize(
        isCustom
          ? { startOnLoad: false, theme: (agentCustomThemeRef.current || 'default') as any, securityLevel: 'loose' }
          : { startOnLoad: false, theme: 'base', themeVariables: isDark ? darkVars : lightVars, securityLevel: 'loose' }
      );

      // During streaming, pre-validate with parse() to avoid DOM
      // pollution from failed render() calls.
      if (isPartial) {
        try {
          await mermaid.parse(syntax);
        } catch {
          // Syntax not yet valid - keep the last successful SVG
          return;
        }
      }

      const id = `mermaid-${Date.now()}`;
      
      try {
        const { svg } = await mermaid.render(id, syntax);
        setRenderedSvg(svg);
        setError(null);
      } catch (renderErr: any) {
        // Clean up orphaned element that mermaid.render() may have created
        const orphan = document.getElementById('d' + id);
        if (orphan) orphan.remove();

        if (!isPartial) {
          console.error("Mermaid render error:", renderErr);
          setError(renderErr.message || "Failed to render diagram");
        }
      }
    } finally {
      renderingRef.current = false;
    }
  };

  // Listen for system dark mode changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setHostDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Re-render with correct theme when dark mode changes
  useEffect(() => {
    // Only auto-switch if user hasn't manually selected a theme
    if (!userSelectedThemeRef.current && diagramState.mermaid) {
      const newTheme = hostDark ? "dark" : "light";
      setDiagramState((prev) => ({ ...prev, theme: newTheme }));
      renderMermaid(diagramState.mermaid, newTheme, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostDark]);

  // Detect if the rendered SVG overflows the viewport
  useEffect(() => {
    if (!renderedSvg || !viewportRef.current || !svgContainerRef.current) {
      setIsOverflowing(false);
      return;
    }
    const viewport = viewportRef.current;
    const content = svgContainerRef.current;
    const check = () => {
      setIsOverflowing(
        content.scrollWidth > viewport.clientWidth + 4 ||
        content.scrollHeight > viewport.clientHeight + 4
      );
    };
    // Check after a brief delay to let the SVG render in the DOM
    const timer = setTimeout(check, 100);
    return () => clearTimeout(timer);
  }, [renderedSvg]);

  // Pan/zoom handlers (work in both inline and fullscreen)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanningRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (displayMode === "inline") {
      setPanZoom((prev) => ({
        ...prev,
        translateX: prev.translateX + dx,
        translateY: prev.translateY + dy,
      }));
    } else {
      setPreviewPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, [displayMode]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    if (displayMode === "inline") {
      setPanZoom((prev) => ({
        ...prev,
        scale: Math.max(0.1, Math.min(5, prev.scale * delta)),
      }));
    } else {
      setPreviewZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)));
    }
  }, [displayMode]);

  // Theme change handler
  const handleThemeChange = useCallback(async (newTheme: string) => {
    userSelectedThemeRef.current = true; // Mark as user-selected
    setDiagramState((prev) => ({ ...prev, theme: newTheme }));
    await renderMermaid(editedMermaid || diagramState.mermaid, newTheme, false);
  }, [editedMermaid, diagramState.mermaid]);

  // Export handler
  const handleExport = useCallback(async () => {
    if (!app || !renderedSvg) return;
    
    try {
      const result = await app.callServerTool({
        name: "export_svg",
        arguments: { svg: renderedSvg, format: "svg" },
      });

      if (!result.isError) {
        // Copy SVG to clipboard
        await navigator.clipboard.writeText(renderedSvg);
        console.info("SVG copied to clipboard");
      }
    } catch (err) {
      console.error("Export error:", err);
    }
  }, [app, renderedSvg]);

  // Fullscreen toggle
  const handleFullscreenToggle = useCallback(async () => {
    if (!app) return;
    
    const newMode = displayMode === "inline" ? "fullscreen" : "inline";
    setDisplayMode(newMode);
    if (newMode === "fullscreen") {
      setPreviewZoom(1);
      setPreviewPan({ x: 0, y: 0 });
    }
    
    try {
      await app.requestDisplayMode({ mode: newMode });
    } catch (err) {
      console.error("Display mode error:", err);
    }
  }, [app, displayMode]);

  // Handle mermaid edit in fullscreen mode
  const handleMermaidEdit = useCallback(async (newSyntax: string) => {
    setEditedMermaid(newSyntax);
    await renderMermaid(newSyntax, diagramState.theme, false);
    
    // Update model context
    if (app) {
      await app.updateModelContext({
        content: [
          {
            type: "text",
            text: `User edited the diagram:\n\`\`\`mermaid\n${newSyntax}\n\`\`\``,
          },
        ],
      });
    }
  }, [app, diagramState.theme]);

  if (appError) {
    return (
      <div className="error-container">
        <strong>ERROR:</strong> {appError.message}
      </div>
    );
  }

  if (!app) {
    return <div className="loading">Connecting...</div>;
  }

  if (displayMode === "fullscreen") {
    return (
      <div className="fullscreen-container" data-theme={diagramState.theme}>
        <div className="fullscreen-header">
          <h2>{diagramState.title || "Mermaid Diagram"}</h2>
          <div className="toolbar">
            <select
              value={diagramState.theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="theme-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              {agentCustomTheme && (
                <option value="custom">Custom ({agentCustomTheme})</option>
              )}
            </select>
            <button onClick={handleExport} className="icon-btn" title="Export SVG">
              <DownloadIcon />
            </button>
            <button onClick={handleFullscreenToggle} className="icon-btn" title="Exit Fullscreen">
              <ExpandIcon />
            </button>
          </div>
        </div>
        <div className="fullscreen-content">
          <div className="editor-panel">
            <textarea
              value={editedMermaid}
              onChange={(e) => handleMermaidEdit(e.target.value)}
              className="mermaid-editor"
              spellCheck={false}
              placeholder="Enter Mermaid syntax..."
            />
          </div>
          <div className="preview-panel">
            {error && <div className="error-banner">{error}</div>}
            <div className="preview-toolbar">
              <button onClick={() => setPreviewZoom((z) => Math.min(5, z * 1.2))} className="icon-btn" title="Zoom In">+</button>
              <button onClick={() => setPreviewZoom((z) => Math.max(0.1, z / 1.2))} className="icon-btn" title="Zoom Out">&minus;</button>
              <button onClick={() => { setPreviewZoom(1); setPreviewPan({ x: 0, y: 0 }); }} className="icon-btn" title="Reset Zoom" style={{ fontSize: 11 }}>1:1</button>
              <span className="text-muted" style={{ fontSize: 12 }}>{Math.round(previewZoom * 100)}%</span>
            </div>
            <div
              className="svg-viewport"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              style={{ cursor: isPanningRef.current ? 'grabbing' : 'grab', flex: 1 }}
            >
              <div
                className="svg-pannable"
                style={{
                  transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                  transformOrigin: 'center center',
                }}
                dangerouslySetInnerHTML={{ __html: renderedSvg }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-container" data-theme={diagramState.theme}>
      <div className="inline-header">
        {diagramState.title && <h3 className="diagram-title">{diagramState.title}</h3>}
        <div className="toolbar">
          {isStreaming && <span className="streaming-indicator">Generating...</span>}
          <button onClick={handleFullscreenToggle} className="icon-btn" title="Fullscreen">
            <ExpandIcon />
          </button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div
        ref={viewportRef}
        className="svg-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanningRef.current ? "grabbing" : "grab" }}
      >
        <div
          ref={svgContainerRef}
          className="svg-pannable"
          style={{
            transform: `translate(${panZoom.translateX}px, ${panZoom.translateY}px) scale(${panZoom.scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: renderedSvg }}
        />
        {isOverflowing && !isStreaming && (
          <button className="overflow-hint" onClick={handleFullscreenToggle}>
            <ExpandIcon /> Diagram too large — click to expand
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Bootstrap
// ============================================================

createRoot(document.getElementById("root")!).render(<MermaidApp />);
