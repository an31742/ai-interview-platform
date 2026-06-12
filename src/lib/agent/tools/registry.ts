import OpenAI from "openai";

/**
 * Tool 类型定义
 *
 * 一个 Tool 包含：
 * - name: 工具名（LLM 用这个名字调用）
 * - description: 描述（LLM 根据描述决定是否调用）
 * - parameters: 参数 Schema（JSON Schema 格式）
 * - execute: 执行函数（实际逻辑）
 */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<string>;
}

/**
 * Agent 消息（OpenAI 格式 + tool_call 支持）
 */
export type AgentMessage =
  | OpenAI.Chat.Completions.ChatCompletionMessageParam
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
    };

/**
 * Tool Call 结果
 */
export interface ToolCallResult {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
  success: boolean;
  duration: number; // ms
}

/**
 * Agent 循环配置
 */
export interface AgentConfig {
  maxToolCalls: number; // 最大连续 Tool Call 次数
  systemPrompt: string; // 系统提示词
}
