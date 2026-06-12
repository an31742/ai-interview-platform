/**
 * Agent 循环核心
 *
 * 实现 ReAct 模式：
 * 1. 调用 LLM（带工具定义）
 * 2. 如果 LLM 返回 tool_calls → 执行工具 → 追加结果 → 重复
 * 3. 如果 LLM 返回文本 → 返回最终回答 → 结束
 *
 * 通过回调函数与前端通信（SSE）
 */

import OpenAI from "openai";
import { getOpenAITools, findTool } from "./tool-definitions";
import type { AgentMessage, ToolCallResult } from "./tools/registry";
import type { Tool } from "./tools/registry";

/** Agent 回调 — 用于 SSE 流式输出 */
export interface AgentCallbacks {
  onChunk: (text: string) => void;
  onToolCall: (call: ToolCallResult) => void;
  onToolResult: (call: ToolCallResult) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

/** Agent 配置 */
const AGENT_CONFIG = {
  maxToolCalls: 3,
  systemPrompt: `你是一个智能助手，可以使用工具来获取信息或执行计算。

可用工具：
- get_weather: 查询天气（需要城市名称）
- calculate: 数学计算（需要表达式）
- get_time: 获取时间（需要时区）

规则：
1. 如果用户的问题需要实时数据，优先使用工具
2. 每次只调用一个工具
3. 拿到工具结果后用自然语言回复用户
4. 如果工具返回错误，告诉用户并提供替代方案`,
};

/**
 * Agent 聊天（流式）
 *
 * @param messages - 消息历史
 * @param callbacks - SSE 回调
 */
export async function agentChat(
  messages: AgentMessage[],
  callbacks: AgentCallbacks
): Promise<void> {
  const deepseek = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

  let toolCallCount = 0;
  const extendedMessages: AgentMessage[] = [
    { role: "system", content: AGENT_CONFIG.systemPrompt },
    ...messages,
  ];

  while (true) {
    try {
      const response = await deepseek.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: extendedMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: getOpenAITools(),
        tool_choice: "auto",
        temperature: 0.3,
        stream: false, // 非流式获取 tool_calls，再流式输出文本
      });

      const choice = response.choices[0];
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // === LLM 要求调用工具 ===
        toolCallCount++;

        if (toolCallCount > AGENT_CONFIG.maxToolCalls) {
          callbacks.onChunk(
            "我已经尝试多次调用工具但仍未完成。请简化您的问题或重试。"
          );
          break;
        }

        // 将 LLM 的 tool_call 消息加入历史
        extendedMessages.push(choice.message);

        // 逐个处理 tool_call
        for (const tc of toolCalls) {
          if (tc.type !== "function") continue;

          const toolName = tc.function.name;
          let args: Record<string, unknown> = {};

          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            args = {};
          }

          const tool = findTool(toolName);
          const startTime = Date.now();

          // 发送 tool_call 事件（前端显示"调用中..."）
          const callResult: ToolCallResult = {
            id: tc.id,
            name: toolName,
            args,
            result: "",
            success: false,
            duration: 0,
          };
          callbacks.onToolCall(callResult);

          if (!tool) {
            // Tool 不存在
            const errorMsg = `工具 "${toolName}" 不存在`;
            callResult.result = errorMsg;
            callResult.success = false;
            callResult.duration = Date.now() - startTime;
            callbacks.onToolResult(callResult);

            extendedMessages.push({
              role: "tool" as const,
              tool_call_id: tc.id,
              content: errorMsg,
            });
            continue;
          }

          try {
            // 执行工具（带超时）
            const result = await executeWithTimeout(tool, args, 10000);
            callResult.result = result;
            callResult.success = true;
            callResult.duration = Date.now() - startTime;
            callbacks.onToolResult(callResult);

            extendedMessages.push({
              role: "tool" as const,
              tool_call_id: tc.id,
              content: result,
            });
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "工具执行失败";
            callResult.result = errorMsg;
            callResult.success = false;
            callResult.duration = Date.now() - startTime;
            callbacks.onToolResult(callResult);

            extendedMessages.push({
              role: "tool" as const,
              tool_call_id: tc.id,
              content: `错误: ${errorMsg}`,
            });
          }
        }

        // 继续循环，让 LLM 处理工具结果
        continue;
      }

      // === LLM 返回文本回答 ===
      const content = choice?.message?.content || "";
      if (content) {
        // 流式输出文本
        const stream = await deepseek.chat.completions.create({
          model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
          messages: [
            ...extendedMessages,
            { role: "assistant", content },
          ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          stream: true,
          temperature: 0.3,
        });

        for await (const chunk of stream) {
          const text = chunk.choices?.[0]?.delta?.content || "";
          if (text) callbacks.onChunk(text);
        }
      }

      callbacks.onDone();
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Agent 出错";
      callbacks.onError(message);
      callbacks.onDone();
      return;
    }
  }

  callbacks.onDone();
}

/**
 * 带超时的工具执行
 */
async function executeWithTimeout(
  tool: Tool,
  args: Record<string, unknown>,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`工具 "${tool.name}" 执行超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    tool
      .execute(args)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
