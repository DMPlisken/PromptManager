export interface PromptGroup {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Variable {
  id: number;
  group_id: number;
  name: string;
  description: string | null;
  default_value: string | null;
  var_type: string;
  created_at: string;
}

export interface PromptTemplate {
  id: number;
  group_id: number;
  name: string;
  content: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskExecution {
  id: number;
  group_id: number;
  template_id: number;
  task_id: number | null;
  filled_prompt: string;
  variable_values: Record<string, string>;
  notes: string | null;
  created_at: string;
  group_name: string | null;
  template_name: string | null;
  task_name: string | null;
}

export interface TaskTemplateInfo {
  id: number;
  template_id: number;
  template_name: string;
  group_name: string;
  order: number;
  use_count: number;
  placeholders: string[];
}

export interface Task {
  id: number;
  name: string;
  description: string | null;
  status: string;
  variable_values: Record<string, string>;
  created_at: string;
  updated_at: string;
  templates: TaskTemplateInfo[];
}

export interface ExecutionImage {
  id: number;
  execution_id: number;
  image_type: "file_path" | "uploaded";
  file_path: string;
  original_name: string;
  file_size: number | null;
  mime_type: string | null;
  display_order: number;
  url: string | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskListItem {
  id: number;
  name: string;
  description: string | null;
  status: string;
  template_count: number;
  tag_ids: number[];
  created_at: string;
  updated_at: string;
}
