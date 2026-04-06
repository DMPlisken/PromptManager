import { sessionStore } from "../stores/sessionStore";
import { api } from "../api/client";
import type { SessionCreateRequest, ClaudeSession } from "../types/session";

export function createSessionActions(wsSend: (msg: object) => void) {
  return {
    createSession: async (request: SessionCreateRequest) => {
      const session: ClaudeSession = await api.createSession(request);
      sessionStore.dispatch({ type: "SESSION_CREATED", session });
      return session;
    },

    sendInput: (sessionId: string, text: string) => {
      wsSend({ type: "session.input", sessionId, text });
    },

    approveToolUse: (sessionId: string, toolUseId: string, approved: boolean) => {
      wsSend({ type: "session.approve", sessionId, toolUseId, approved });
      sessionStore.dispatch({
        type: "APPROVAL_RESOLVED",
        sessionId,
        approvalId: toolUseId,
        resolution: approved ? "approved" : "denied",
      });
    },

    abortSession: (sessionId: string) => {
      wsSend({ type: "session.abort", sessionId });
      sessionStore.dispatch({
        type: "SESSION_STATUS_CHANGED",
        sessionId,
        status: "terminated",
      });
    },

    setActiveSession: (sessionId: string | null) => {
      sessionStore.dispatch({ type: "SET_ACTIVE_SESSION", sessionId });
    },

    removeSession: async (sessionId: string) => {
      await api.deleteSession(sessionId);
      sessionStore.dispatch({ type: "SESSION_REMOVED", sessionId });
    },

    loadSessions: async () => {
      const sessions: ClaudeSession[] = await api.getSessions();
      sessionStore.dispatch({ type: "SESSIONS_LOADED", sessions });
    },
  };
}
