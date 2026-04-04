const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Groups
  getGroups: () => request<import("../types").PromptGroup[]>("/groups"),
  createGroup: (data: { name: string; description?: string }) =>
    request<import("../types").PromptGroup>("/groups", { method: "POST", body: JSON.stringify(data) }),
  updateGroup: (id: number, data: { name?: string; description?: string }) =>
    request<import("../types").PromptGroup>(`/groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGroup: (id: number) =>
    request<void>(`/groups/${id}`, { method: "DELETE" }),

  // Variables
  getVariables: (groupId: number) =>
    request<import("../types").Variable[]>(`/variables?group_id=${groupId}`),
  createVariable: (data: { group_id: number; name: string; description?: string; default_value?: string; var_type?: string }) =>
    request<import("../types").Variable>("/variables", { method: "POST", body: JSON.stringify(data) }),
  updateVariable: (id: number, data: { name?: string; description?: string; default_value?: string; var_type?: string }) =>
    request<import("../types").Variable>(`/variables/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVariable: (id: number) =>
    request<void>(`/variables/${id}`, { method: "DELETE" }),

  // Templates
  getTemplates: (groupId: number) =>
    request<import("../types").PromptTemplate[]>(`/templates?group_id=${groupId}`),
  createTemplate: (data: { group_id: number; name: string; content: string; order?: number }) =>
    request<import("../types").PromptTemplate>("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id: number, data: { name?: string; content?: string; order?: number }) =>
    request<import("../types").PromptTemplate>(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (id: number) =>
    request<void>(`/templates/${id}`, { method: "DELETE" }),
  renderTemplate: (id: number, variables: Record<string, string>) =>
    request<{ rendered: string; template_id: number; template_name: string }>(
      `/templates/${id}/render`,
      { method: "POST", body: JSON.stringify({ variables }) }
    ),

  // Executions
  getExecutions: (params?: { group_id?: number; template_id?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    if (params?.template_id) qs.set("template_id", String(params.template_id));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<import("../types").TaskExecution[]>(`/executions?${qs}`);
  },
  createExecution: (data: {
    group_id: number; template_id: number; filled_prompt: string;
    variable_values: Record<string, string>; notes?: string;
  }) =>
    request<import("../types").TaskExecution>("/executions", { method: "POST", body: JSON.stringify(data) }),
  deleteExecution: (id: number) =>
    request<void>(`/executions/${id}`, { method: "DELETE" }),
};
