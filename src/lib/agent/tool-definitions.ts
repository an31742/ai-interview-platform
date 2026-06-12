/**
 * Tool Definitions — 发送给 LLM 的 Tool Schema
 *
 * 将我们的 Tool 转为 OpenAI Function Calling 格式
 */

import type OpenAI from "openai";
import { weatherTool } from "./tools/weather";
import { calculatorTool } from "./tools/calculator";
import { timeTool } from "./tools/time";
import type { Tool } from "./tools/registry";

/** 所有注册的工具 */
export const ALL_TOOLS: Tool[] = [weatherTool, calculatorTool, timeTool];

/** 按名称查找工具 */
export function findTool(name: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/**
 * 转为 OpenAI Tool 格式
 *
 * OpenAI 的 tool 格式：
 * {
 *   type: "function",
 *   function: {
 *     name: "get_weather",
 *     description: "...",
 *     parameters: { ... }
 *   }
 * }
 */
export function getOpenAITools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return ALL_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
}
