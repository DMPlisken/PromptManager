const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
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
  getExecutions: (params?: { group_id?: number; template_id?: number; task_id?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    if (params?.template_id) qs.set("template_id", String(params.template_id));
    if (params?.task_id) qs.set("task_id", String(params.task_id));
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

  // Tasks
  getTasks: (status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return request<import("../types").TaskListItem[]>(`/tasks${qs}`);
  },
  createTask: (data: { name: string; description?: string; template_ids?: number[] }) =>
    request<import("../types").Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  getTask: (id: number) =>
    request<import("../types").Task>(`/tasks/${id}`),
  updateTask: (id: number, data: { name?: string; description?: string; status?: string; variable_values?: Record<string, string> }) =>
    request<import("../types").Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: number) =>
    request<void>(`/tasks/${id}`, { method: "DELETE" }),
  addTaskTemplate: (taskId: number, templateId: number, order?: number) =>
    request<import("../types").Task>(`/tasks/${taskId}/templates`, { method: "POST", body: JSON.stringify({ template_id: templateId, order: order ?? 0 }) }),
  removeTaskTemplate: (taskId: number, templateId: number) =>
    request<import("../types").Task>(`/tasks/${taskId}/templates/${templateId}`, { method: "DELETE" }),
  reorderTaskTemplates: (taskId: number, templateIds: number[]) =>
    request<import("../types").Task>(`/tasks/${taskId}/templates/reorder`, { method: "PUT", body: JSON.stringify(templateIds) }),
  updateTemplateUseCount: (taskId: number, templateId: number, count: number) =>
    request<import("../types").Task>(`/tasks/${taskId}/templates/${templateId}/count?count=${count}`, { method: "PUT" }),
  getTaskVariables: (taskId: number) =>
    request<string[]>(`/tasks/${taskId}/variables`),
  renderTaskTemplate: (taskId: number, templateId: number) =>
    request<{ rendered: string; template_id: number; template_name: string; execution_id: number }>(`/tasks/${taskId}/render/${templateId}`, { method: "POST" }),

  // Export/Import
  exportGroup: async (groupId: number, templateIds?: number[]) => {
    const qs = templateIds ? `?template_ids=${templateIds.join(",")}` : "";
    const res = await fetch(`${API_BASE}/groups/${groupId}/export${qs}`);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.group?.name || "export"}.promptflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  importGroup: (data: object, groupName?: string) => {
    const qs = groupName ? `?group_name=${encodeURIComponent(groupName)}` : "";
    return request<import("../types").PromptGroup>(`/groups/import${qs}`, { method: "POST", body: JSON.stringify(data) });
  },
  checkGroupName: (name: string) =>
    request<{ available: boolean; suggested_name?: string }>(`/groups/check-name?name=${encodeURIComponent(name)}`),

  // Tags
  getTags: () => request<import("../types").Tag[]>("/tags"),
  createTag: (data: { name: string; color: string }) =>
    request<import("../types").Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  updateTag: (id: number, data: { name?: string; color?: string }) =>
    request<import("../types").Tag>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTag: (id: number) =>
    request<void>(`/tags/${id}`, { method: "DELETE" }),
  setTaskTags: (taskId: number, tagIds: number[]) =>
    request<void>(`/tasks/${taskId}/tags`, { method: "PUT", body: JSON.stringify(tagIds) }),

  // Task-Template Images (persistent)
  uploadTaskImage: async (taskId: number, templateId: number, file: File, filePath: string, order: number) => {
    const form = new FormData();
    form.append("file", file);
    form.append("task_id", String(taskId));
    form.append("template_id", String(templateId));
    form.append("file_path", filePath);
    form.append("display_order", String(order));
    const res = await fetch(`${API_BASE}/task-images/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
  getTaskTemplateImages: (taskId: number, templateId: number) =>
    request<Array<{ id: number; task_id: number; template_id: number; file_path: string; original_name: string; file_size: number | null; display_order: number; thumbnail_url: string | null }>>(`/task-images/task/${taskId}/template/${templateId}`),
  deleteTaskImage: (imageId: number) =>
    request<void>(`/task-images/${imageId}`, { method: "DELETE" }),
  copyImagesToExecution: (taskId: number, templateId: number, executionId: number) =>
    request<{ copied: number }>("/task-images/copy-to-execution", { method: "POST", body: JSON.stringify({ task_id: taskId, template_id: templateId, execution_id: executionId }) }),

  // Execution Images (legacy)
  uploadImage: async (executionId: number, file: File, displayOrder: number): Promise<import("../types").ExecutionImage> => {
    const form = new FormData();
    form.append("file", file);
    form.append("execution_id", String(executionId));
    form.append("display_order", String(displayOrder));
    const res = await fetch(`${API_BASE}/images/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },
  addImagePath: (data: { execution_id: number; file_path: string; display_order: number }) =>
    request<import("../types").ExecutionImage>("/images/path", { method: "POST", body: JSON.stringify(data) }),
  getExecutionImages: (executionId: number) =>
    request<import("../types").ExecutionImage[]>(`/images/execution/${executionId}`),
  deleteImage: (imageId: number) =>
    request<void>(`/images/${imageId}`, { method: "DELETE" }),
};
