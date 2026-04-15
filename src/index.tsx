import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import App from "./App";
import AuthGate from "./components/Auth/AuthGate";
import QueryProvider from "./queries/QueryProvider";
import "./styles.css";

// Suppress known Recharts warnings in dev (missing keys, zero-size container)
if (import.meta.env.DEV) {
  const origError = console.error;
  const origWarn = console.warn;
  const rechartsFilter = (args: any[]) =>
    typeof args[0] === "string" &&
    ((args[0].includes('unique "key"') && args[0].includes("ForwardRef")) ||
      (args[0].includes("width") && args[0].includes("height") && args[0].includes("should be greater than 0")));
  console.error = (...args: any[]) => {
    if (!rechartsFilter(args)) origError.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    if (!rechartsFilter(args)) origWarn.apply(console, args);
  };
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AuthGate>
            <App />
          </AuthGate>
        </LocalizationProvider>
      </QueryProvider>
    </BrowserRouter>
  </React.StrictMode>
);
