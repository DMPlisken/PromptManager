import { useSyncExternalStore, useRef, useCallback } from "react";
import type {
  SessionState,
  SessionAction,
  SessionMessage,
  ClaudeSession,
  ToolApprovalRequest,
} from "../types/session";

// Initial state
const initialState: SessionState = {
  sessions: {},
  sessionOrder: [],
  activeSessionId: null,
  messages: {},
  approvals: {},
  sidecarStatus: "unknown",
  wsStatus: "disconnected",
};

// Reducer
function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "SESSION_CREATED":
      return {
        ...state,
        sessions: { ...state.sessions, [action.session.id]: action.session },
        sessionOrder: [...state.sessionOrder, action.session.id],
        messages: { ...state.messages, [action.session.id]: [] },
        approvals: { ...state.approvals, [action.session.id]: [] },
        activeSessionId: action.session.id,
      };

    case "SESSION_STATUS_CHANGED":
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.sessionId]: {
            ...state.sessions[action.sessionId],
            status: action.status,
            ...(action.error ? { error: action.error } : {}),
          },
        },
      };

    case "SESSION_COMPLETED":
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.sessionId]: {
            ...state.sessions[action.sessionId],
            status: "completed",
            totalCostUsd: action.result.costUsd,
            tokenCountInput: action.result.tokenCountInput,
            tokenCountOutput: action.result.tokenCountOutput,
            endedAt: new Date().toISOString(),
          },
        },
      };

    case "SESSION_REMOVED": {
      const { [action.sessionId]: _removedSession, ...restSessions } = state.sessions;
      const { [action.sessionId]: _removedMessages, ...restMessages } = state.messages;
      const { [action.sessionId]: _removedApprovals, ...restApprovals } = state.approvals;
      return {
        ...state,
        sessions: restSessions,
        messages: restMessages,
        approvals: restApprovals,
        sessionOrder: state.sessionOrder.filter((id) => id !== action.sessionId),
        activeSessionId:
          state.activeSessionId === action.sessionId ? null : state.activeSessionId,
      };
    }

    case "SET_ACTIVE_SESSION":
      return { ...state, activeSessionId: action.sessionId };

    case "MESSAGES_APPENDED":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.sessionId]: [
            ...(state.messages[action.sessionId] || []),
            ...action.messages,
          ],
        },
      };

    case "APPROVAL_REQUESTED":
      return {
        ...state,
        approvals: {
          ...state.approvals,
          [action.approval.sessionId]: [
            ...(state.approvals[action.approval.sessionId] || []),
            action.approval,
          ],
        },
        sessions: {
          ...state.sessions,
          [action.approval.sessionId]: {
            ...state.sessions[action.approval.sessionId],
            status: "waiting_approval",
          },
        },
      };

    case "APPROVAL_RESOLVED":
      return {
        ...state,
        approvals: {
          ...state.approvals,
          [action.sessionId]: (state.approvals[action.sessionId] || []).map((a) =>
            a.id === action.approvalId ? { ...a, status: action.resolution } : a
          ),
        },
      };

    case "SET_WS_STATUS":
      return { ...state, wsStatus: action.status };

    case "SET_SIDECAR_STATUS":
      return { ...state, sidecarStatus: action.status };

    case "SESSIONS_LOADED": {
      const loaded: Record<string, ClaudeSession> = {};
      for (const s of action.sessions) {
        loaded[s.id] = s;
      }
      return {
        ...state,
        sessions: loaded,
        sessionOrder: action.sessions.map((s) => s.id),
      };
    }

    default:
      return state;
  }
}

// Store implementation
type Listener = () => void;

class SessionStore {
  private state: SessionState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = initialState;
  }

  getState = (): SessionState => {
    return this.state;
  };

  dispatch = (action: SessionAction): void => {
    this.state = sessionReducer(this.state, action);
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

// Singleton store
export const sessionStore = new SessionStore();

// Hook: use the full state (use sparingly — causes re-render on every dispatch)
export function useSessionState(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}

// Hook: use a selected slice of state (prevents unnecessary re-renders)
// Caches the selector result by state identity to avoid infinite re-renders
// when selectors return new object/array references.
export function useSessionSelector<T>(selector: (state: SessionState) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cachedRef = useRef<{ value: T; stateRef: SessionState } | null>(null);

  const getSnapshot = useCallback(() => {
    const currentState = sessionStore.getState();
    if (cachedRef.current && cachedRef.current.stateRef === currentState) {
      return cachedRef.current.value;
    }
    const value = selectorRef.current(currentState);
    cachedRef.current = { value, stateRef: currentState };
    return value;
  }, []);

  return useSyncExternalStore(sessionStore.subscribe, getSnapshot);
}

// Hook: get dispatch function
export function useSessionDispatch() {
  return sessionStore.dispatch;
}

// Convenience selectors
export function useActiveSession(): ClaudeSession | null {
  return useSessionSelector((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] ?? null : null
  );
}

export function useSessionMessages(sessionId: string | null): SessionMessage[] {
  return useSessionSelector((s) =>
    sessionId ? s.messages[sessionId] ?? [] : []
  );
}

export function usePendingApprovals(sessionId: string | null): ToolApprovalRequest[] {
  return useSessionSelector((s) =>
    sessionId
      ? (s.approvals[sessionId] ?? []).filter((a) => a.status === "pending")
      : []
  );
}

export function useAllPendingApprovals(): ToolApprovalRequest[] {
  return useSessionSelector((s) =>
    Object.values(s.approvals)
      .flat()
      .filter((a) => a.status === "pending")
  );
}
