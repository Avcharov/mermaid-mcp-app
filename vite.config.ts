import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";
const devParam = isDevelopment ? "?dev" : "";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "mermaid",
      ],
      output: {
        paths: {
          "react": `https://esm.sh/react@19.2.0${devParam}`,
          "react-dom": `https://esm.sh/react-dom@19.2.0?deps=react@19.2.0${devParam ? "&dev" : ""}`,
          "react-dom/client": `https://esm.sh/react-dom@19.2.0/client?deps=react@19.2.0${devParam ? "&dev" : ""}`,
          "react/jsx-runtime": `https://esm.sh/react@19.2.0/jsx-runtime${devParam}`,
          "mermaid": "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs",
        },
        entryFileNames: "mcp-app.js",
        assetFileNames: "mcp-app.[ext]",
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
