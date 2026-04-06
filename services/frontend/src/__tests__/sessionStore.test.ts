import { describe, it, expect, beforeEach } from 'vitest';
import { sessionStore } from '../stores/sessionStore';
import type { ClaudeSession, SessionMessage, ToolApprovalRequest } from '../types/session';

const mockSession: ClaudeSession = {
  id: 'test-session-1',
  name: 'Test Session',
  status: 'running',
  workingDirectory: '/tmp',
  model: 'sonnet',
  initialPrompt: 'Hello',
  tokenCountInput: 0,
  tokenCountOutput: 0,
  totalCostUsd: 0,
  startedAt: new Date().toISOString(),
};

describe('SessionStore', () => {
  beforeEach(() => {
    // Reset store state — remove all existing sessions
    const state = sessionStore.getState();
    state.sessionOrder.forEach(id => {
      sessionStore.dispatch({ type: 'SESSION_REMOVED', sessionId: id });
    });
    // Reset WS and sidecar status
    sessionStore.dispatch({ type: 'SET_WS_STATUS', status: 'disconnected' });
    sessionStore.dispatch({ type: 'SET_SIDECAR_STATUS', status: 'unknown' });
  });

  it('should start with empty state', () => {
    const state = sessionStore.getState();
    expect(state.sessionOrder).toHaveLength(0);
    expect(Object.keys(state.sessions)).toHaveLength(0);
    expect(state.activeSessionId).toBeNull();
  });

  it('should create a session', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const state = sessionStore.getState();
    expect(state.sessions['test-session-1']).toBeDefined();
    expect(state.sessionOrder).toContain('test-session-1');
    expect(state.activeSessionId).toBe('test-session-1');
  });

  it('should initialize messages and approvals arrays on session create', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const state = sessionStore.getState();
    expect(state.messages['test-session-1']).toEqual([]);
    expect(state.approvals['test-session-1']).toEqual([]);
  });

  it('should update session status', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    sessionStore.dispatch({
      type: 'SESSION_STATUS_CHANGED',
      sessionId: 'test-session-1',
      status: 'completed',
    });
    expect(sessionStore.getState().sessions['test-session-1'].status).toBe('completed');
  });

  it('should update session status with error', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    sessionStore.dispatch({
      type: 'SESSION_STATUS_CHANGED',
      sessionId: 'test-session-1',
      status: 'failed',
      error: 'Something went wrong',
    });
    const session = sessionStore.getState().sessions['test-session-1'];
    expect(session.status).toBe('failed');
    expect(session.error).toBe('Something went wrong');
  });

  it('should append messages', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const msg: SessionMessage = {
      id: 'msg-1',
      sessionId: 'test-session-1',
      sequence: 1,
      role: 'assistant',
      type: 'text',
      content: 'Hello world',
      timestamp: new Date().toISOString(),
    };
    sessionStore.dispatch({ type: 'MESSAGES_APPENDED', sessionId: 'test-session-1', messages: [msg] });
    expect(sessionStore.getState().messages['test-session-1']).toHaveLength(1);
    expect(sessionStore.getState().messages['test-session-1'][0].content).toBe('Hello world');
  });

  it('should append multiple messages in order', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const msg1: SessionMessage = {
      id: 'msg-1',
      sessionId: 'test-session-1',
      sequence: 1,
      role: 'assistant',
      type: 'text',
      content: 'First',
      timestamp: new Date().toISOString(),
    };
    const msg2: SessionMessage = {
      id: 'msg-2',
      sessionId: 'test-session-1',
      sequence: 2,
      role: 'user',
      type: 'text',
      content: 'Second',
      timestamp: new Date().toISOString(),
    };
    sessionStore.dispatch({ type: 'MESSAGES_APPENDED', sessionId: 'test-session-1', messages: [msg1, msg2] });
    const messages = sessionStore.getState().messages['test-session-1'];
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
  });

  it('should handle approval requests', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const approval: ToolApprovalRequest = {
      id: 'tool-1',
      sessionId: 'test-session-1',
      toolName: 'Write',
      toolInput: { file_path: '/tmp/test.txt' },
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    sessionStore.dispatch({ type: 'APPROVAL_REQUESTED', approval });
    expect(sessionStore.getState().approvals['test-session-1']).toHaveLength(1);
    expect(sessionStore.getState().approvals['test-session-1'][0].toolName).toBe('Write');
    expect(sessionStore.getState().sessions['test-session-1'].status).toBe('waiting_approval');
  });

  it('should resolve approvals as approved', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const approval: ToolApprovalRequest = {
      id: 'tool-1',
      sessionId: 'test-session-1',
      toolName: 'Write',
      toolInput: {},
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    sessionStore.dispatch({ type: 'APPROVAL_REQUESTED', approval });
    sessionStore.dispatch({
      type: 'APPROVAL_RESOLVED',
      sessionId: 'test-session-1',
      approvalId: 'tool-1',
      resolution: 'approved',
    });
    expect(sessionStore.getState().approvals['test-session-1'][0].status).toBe('approved');
  });

  it('should resolve approvals as denied', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const approval: ToolApprovalRequest = {
      id: 'tool-1',
      sessionId: 'test-session-1',
      toolName: 'Bash',
      toolInput: { command: 'rm -rf /' },
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    sessionStore.dispatch({ type: 'APPROVAL_REQUESTED', approval });
    sessionStore.dispatch({
      type: 'APPROVAL_RESOLVED',
      sessionId: 'test-session-1',
      approvalId: 'tool-1',
      resolution: 'denied',
    });
    expect(sessionStore.getState().approvals['test-session-1'][0].status).toBe('denied');
  });

  it('should remove a session', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    sessionStore.dispatch({ type: 'SESSION_REMOVED', sessionId: 'test-session-1' });
    expect(sessionStore.getState().sessions['test-session-1']).toBeUndefined();
    expect(sessionStore.getState().sessionOrder).not.toContain('test-session-1');
    expect(sessionStore.getState().messages['test-session-1']).toBeUndefined();
    expect(sessionStore.getState().approvals['test-session-1']).toBeUndefined();
  });

  it('should clear activeSessionId when active session is removed', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    expect(sessionStore.getState().activeSessionId).toBe('test-session-1');
    sessionStore.dispatch({ type: 'SESSION_REMOVED', sessionId: 'test-session-1' });
    expect(sessionStore.getState().activeSessionId).toBeNull();
  });

  it('should not clear activeSessionId when a non-active session is removed', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const session2: ClaudeSession = { ...mockSession, id: 'test-session-2', name: 'Session 2' };
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: session2 });
    // session2 is now active
    expect(sessionStore.getState().activeSessionId).toBe('test-session-2');
    sessionStore.dispatch({ type: 'SESSION_REMOVED', sessionId: 'test-session-1' });
    expect(sessionStore.getState().activeSessionId).toBe('test-session-2');
  });

  it('should complete a session with result data', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    sessionStore.dispatch({
      type: 'SESSION_COMPLETED',
      sessionId: 'test-session-1',
      result: { costUsd: 0.05, tokenCountInput: 1000, tokenCountOutput: 500 },
    });
    const session = sessionStore.getState().sessions['test-session-1'];
    expect(session.status).toBe('completed');
    expect(session.totalCostUsd).toBe(0.05);
    expect(session.tokenCountInput).toBe(1000);
    expect(session.tokenCountOutput).toBe(500);
    expect(session.endedAt).toBeDefined();
  });

  it('should set active session', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    sessionStore.dispatch({ type: 'SET_ACTIVE_SESSION', sessionId: null });
    expect(sessionStore.getState().activeSessionId).toBeNull();
  });

  it('should set active session to a specific id', () => {
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    const session2: ClaudeSession = { ...mockSession, id: 'test-session-2', name: 'Session 2' };
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: session2 });
    sessionStore.dispatch({ type: 'SET_ACTIVE_SESSION', sessionId: 'test-session-1' });
    expect(sessionStore.getState().activeSessionId).toBe('test-session-1');
  });

  it('should track WebSocket status', () => {
    sessionStore.dispatch({ type: 'SET_WS_STATUS', status: 'connected' });
    expect(sessionStore.getState().wsStatus).toBe('connected');
    sessionStore.dispatch({ type: 'SET_WS_STATUS', status: 'reconnecting' });
    expect(sessionStore.getState().wsStatus).toBe('reconnecting');
  });

  it('should track sidecar status', () => {
    sessionStore.dispatch({ type: 'SET_SIDECAR_STATUS', status: 'connected' });
    expect(sessionStore.getState().sidecarStatus).toBe('connected');
    sessionStore.dispatch({ type: 'SET_SIDECAR_STATUS', status: 'disconnected' });
    expect(sessionStore.getState().sidecarStatus).toBe('disconnected');
  });

  it('should load sessions in bulk', () => {
    const sessions: ClaudeSession[] = [
      { ...mockSession, id: 'bulk-1', name: 'Bulk 1' },
      { ...mockSession, id: 'bulk-2', name: 'Bulk 2' },
      { ...mockSession, id: 'bulk-3', name: 'Bulk 3' },
    ];
    sessionStore.dispatch({ type: 'SESSIONS_LOADED', sessions });
    const state = sessionStore.getState();
    expect(state.sessionOrder).toEqual(['bulk-1', 'bulk-2', 'bulk-3']);
    expect(Object.keys(state.sessions)).toHaveLength(3);
    expect(state.sessions['bulk-2'].name).toBe('Bulk 2');
  });

  it('should notify subscribers on dispatch', () => {
    let callCount = 0;
    const unsubscribe = sessionStore.subscribe(() => { callCount++; });
    sessionStore.dispatch({ type: 'SESSION_CREATED', session: mockSession });
    expect(callCount).toBe(1);
    sessionStore.dispatch({ type: 'SET_WS_STATUS', status: 'connected' });
    expect(callCount).toBe(2);
    unsubscribe();
    sessionStore.dispatch({ type: 'SET_WS_STATUS', status: 'disconnected' });
    expect(callCount).toBe(2); // Should not increase after unsubscribe
  });
});
