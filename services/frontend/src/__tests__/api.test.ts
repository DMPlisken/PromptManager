import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to capture and mock fetch before importing the api module.
// The api client module uses a top-level `fetch` call inside its functions,
// so we mock globalThis.fetch.
const mockFetch = vi.fn();

describe('API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should fetch groups successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, name: 'Test Group', description: null, created_at: '2026-01-01', updated_at: '2026-01-01' }],
    });

    // Dynamic import each time so the mock is in place
    const { api } = await import('../api/client');
    const groups = await api.getGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Test Group');
    expect(mockFetch).toHaveBeenCalledWith('/api/groups', expect.objectContaining({
      headers: {},
    }));
  });

  it('should throw on API error (404)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    });

    const { api } = await import('../api/client');
    await expect(api.getTemplates(999)).rejects.toThrow('API error 404');
  });

  it('should throw on API error (500)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });

    const { api } = await import('../api/client');
    await expect(api.getSessions()).rejects.toThrow('API error 500');
  });

  it('should create a group with POST', async () => {
    const newGroup = { id: 2, name: 'New Group', description: 'desc', created_at: '2026-01-01', updated_at: '2026-01-01' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => newGroup,
    });

    const { api } = await import('../api/client');
    const result = await api.createGroup({ name: 'New Group', description: 'desc' });
    expect(result.name).toBe('New Group');
    expect(mockFetch).toHaveBeenCalledWith('/api/groups', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'New Group', description: 'desc' }),
    }));
  });

  it('should delete a group with DELETE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => undefined,
    });

    const { api } = await import('../api/client');
    await api.deleteGroup(5);
    expect(mockFetch).toHaveBeenCalledWith('/api/groups/5', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('should create a session with POST', async () => {
    const mockSession = {
      id: 'sess-123',
      name: 'Test',
      status: 'starting',
      workingDirectory: '.',
      model: 'sonnet',
      initialPrompt: 'Hello',
      tokenCountInput: 0,
      tokenCountOutput: 0,
      totalCostUsd: 0,
      startedAt: '2026-01-01',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSession,
    });

    const { api } = await import('../api/client');
    const result = await api.createSession({ prompt: 'Hello', workingDirectory: '.' });
    expect(result.id).toBe('sess-123');
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('should fetch session messages with optional after parameter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { api } = await import('../api/client');
    await api.getSessionMessages('sess-123', 5);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/sess-123/messages?after=5',
      expect.any(Object),
    );
  });

  it('should check sidecar health', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', version: '1.0.0' }),
    });

    const { api } = await import('../api/client');
    const health = await api.checkSidecarHealth();
    expect(health.status).toBe('ok');
  });

  it('should render a template with POST', async () => {
    const rendered = { rendered: 'Hello World', template_id: 1, template_name: 'Greeting' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => rendered,
    });

    const { api } = await import('../api/client');
    const result = await api.renderTemplate(1, { NAME: 'World' });
    expect(result.rendered).toBe('Hello World');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/templates/1/render',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ variables: { NAME: 'World' } }),
      }),
    );
  });
});
