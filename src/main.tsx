import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Silenciar avisos específicos que atrapalham a verificação visual em dev
const originalWarn = console.warn;
console.warn = (...args) => {
  const first = args?.[0];
  const skip =
    (typeof first === 'string' && first.includes('Missing `Description`') && first.includes('{DialogContent}')) ||
    (typeof first === 'string' && first.includes('React Router Future Flag Warning')) ||
    (typeof first === 'string' && first.includes('[REALTIME] Canal desconectado'));
  if (skip) return;
  return originalWarn.apply(console, args);
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
