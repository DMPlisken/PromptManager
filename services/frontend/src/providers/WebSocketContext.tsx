import { createContext, useContext, useRef, useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { createSessionActions } from "../hooks/useSessionActions";

interface WsContextValue {
  send: (msg: object) => void;
  actions: ReturnType<typeof createSessionActions>;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket();
  // Use a ref to keep send stable across renders
  const sendRef = useRef(ws.send);
  sendRef.current = ws.send;

  // Create a stable send function that delegates to the ref
  const [stableSend] = useState(() => (msg: object) => sendRef.current(msg));
  const [actions] = useState(() => createSessionActions(stableSend));

  return (
    <WsContext.Provider value={{ send: stableSend, actions }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWsContext() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWsContext must be used within WebSocketProvider");
  return ctx;
}
