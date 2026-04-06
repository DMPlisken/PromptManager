import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { WebSocketProvider } from "./providers/WebSocketContext";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
