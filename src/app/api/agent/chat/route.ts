/**
 * POST /api/agent/chat
 *
 * Agent 聊天 API — 流式 SSE 响应
 *
 * 事件类型：
 * - tool_call:   LLM 决定调用工具 { id, name, args }
 * - tool_result: 工具执行完成 { id, name, result, success, duration }
 * - chunk:       LLM 生成的文本片段
 * - done:        完成
 * - error:       错误
 */

import { NextRequest } from "next/server";
import { agentChat } from "@/lib/agent/agent-loop";
import type { AgentMessage, ToolCallResult } from "@/lib/agent/tools/registry";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.messages) {
      return errorResponse("请提供 messages", 400);
    }

    const messages: AgentMessage[] = body.messages;

    // 校验消息格式
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse("messages 必须是数组且不能为空", 400);
    }

    // 构建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        await agentChat(messages, {
          onChunk: (text) => {
            safeEnqueue(controller, encoder, {
              type: "chunk",
              content: text,
            });
          },

          onToolCall: (call: ToolCallResult) => {
            safeEnqueue(controller, encoder, {
              type: "tool_call",
              id: call.id,
              name: call.name,
              args: call.args,
            });
          },

          onToolResult: (call: ToolCallResult) => {
            safeEnqueue(controller, encoder, {
              type: "tool_result",
              id: call.id,
              name: call.name,
              result: call.result,
              success: call.success,
              duration: call.duration,
            });
          },

          onError: (error: string) => {
            safeEnqueue(controller, encoder, { type: "error", error });
            closeSafe(controller);
          },

          onDone: () => {
            safeEnqueue(controller, encoder, { type: "done" });
            closeSafe(controller);
          },
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "服务器内部错误",
      500
    );
  }
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function safeEnqueue(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: Record<string, unknown>
) {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    // controller 可能已关闭
  }
}

function closeSafe(controller: ReadableStreamDefaultController) {
  try {
    controller.close();
  } catch {
    // 可能已经关闭
  }
}
