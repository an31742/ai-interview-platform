/**
 * Playground 类型定义
 *
 * 四种 Prompt 模式的状态管理
 */

/** Prompt 类型 */
export type PromptType = "plain" | "role" | "few-shot" | "cot";

/** Prompt 类型元数据 */
export interface PromptTypeMeta {
  value: PromptType;
  label: string;
  description: string;
  icon: string;
}

/** 四种 Prompt 类型的元数据列表 */
export const PROMPT_TYPE_META: PromptTypeMeta[] = [
  {
    value: "plain",
    label: "普通 Prompt",
    description: "直接提问，最基础的 Prompt 形式",
    icon: "💬",
  },
  {
    value: "role",
    label: "角色 Prompt",
    description: "为 AI 分配角色，约束回答风格和专业知识范围",
    icon: "🎭",
  },
  {
    value: "few-shot",
    label: "Few Shot Prompt",
    description: "提供示例让 AI 模仿输入输出模式",
    icon: "📋",
  },
  {
    value: "cot",
    label: "Chain of Thought",
    description: "引导 AI 逐步推理，适合复杂逻辑任务",
    icon: "🧠",
  },
];

/** 模型参数配置 */
export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

/** 默认模型参数 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: "deepseek-chat",
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
};

/** Prompt 模板变量（按类型分组） */
export interface PromptVariables {
  // Plain
  userInput?: string;

  // Role
  role?: string;
  task?: string;

  // Few Shot
  examples?: string;
  fewShotInput?: string;

  // Chain of Thought
  question?: string;
  steps?: string;

  // 公共
  additionalContext?: string;
}

/** 默认变量值 */
export const DEFAULT_VARIABLES: PromptVariables = {
  userInput: "",
  role: "",
  task: "",
  examples: "",
  fewShotInput: "",
  question: "",
  steps: "",
  additionalContext: "",
};

/** 保存的 Prompt 模板 */
export interface SavedTemplate {
  id: string;
  name: string;
  promptType: PromptType;
  variables: PromptVariables;
  modelConfig: ModelConfig;
  createdAt: number;
  updatedAt: number;
}

/** Token 使用统计 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 运行历史记录 */
export interface RunRecord {
  id: string;
  promptType: PromptType;
  promptContent: string; // 最终发送的完整 prompt
  modelConfig: ModelConfig;
  response: string;
  tokenUsage: TokenUsage;
  timestamp: number;
  duration: number; // 耗时 (ms)
}
