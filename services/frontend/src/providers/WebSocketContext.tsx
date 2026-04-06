import { createContext, useContext, useMemo } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { createSessionActions } from "../hooks/useSessionActions";

interface WsContextValue {
  send: (msg: object) => void;
  actions: ReturnType<typeof createSessionActions>;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { send } = useWebSocket();
  const actions = useMemo(() => createSessionActions(send), [send]);
  return (
    <WsContext.Provider value={{ send, actions }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWsContext() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWsContext must be used within WebSocketProvider");
  return ctx;
}
