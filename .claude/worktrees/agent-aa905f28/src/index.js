import React from "react";
import ReactDOM from "react-dom/client";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { StatusOverrideProvider } from "./contexts/StatusOverrideContext";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <StatusOverrideProvider>
        <App />
      </StatusOverrideProvider>
    </LocalizationProvider>
  </React.StrictMode>
);
