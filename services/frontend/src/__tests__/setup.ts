import '@testing-library/jest-dom';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(public url: string, public protocols?: string | string[]) {
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }

  send(_data: string) { /* noop in tests */ }
  close() { this.readyState = MockWebSocket.CLOSED; }
}

(globalThis as any).WebSocket = MockWebSocket;
