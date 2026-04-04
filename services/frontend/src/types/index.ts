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
  filled_prompt: string;
  variable_values: Record<string, string>;
  notes: string | null;
  created_at: string;
  group_name: string | null;
  template_name: string | null;
}
