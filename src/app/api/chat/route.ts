import { createChatCompletionStream } from "@/lib/deepseek";
import { MAX_MESSAGES, MAX_MESSAGE_LENGTH } from "@/lib/constants";
import type { Message } from "@/types/chat";

/**
 * POST /api/chat
 *
 * 接收聊天消息，调用 DeepSeek API 并返回 SSE 流式响应
 *
 * Request Body:
 * {
 *   messages: Message[]   // 消息历史（不含 system）
 *   conversationId?: string  // 会话 ID（仅用于日志）
 * }
 *
 * Response: SSE Stream (text/event-stream)
 *   data: {"type":"chunk","content":"..."}
 *   data: {"type":"done","usage":{"promptTokens":0,"completionTokens":0,"totalTokens":0}}
 *   data: {"type":"error","error":"..."}
 */
export async function POST(request: Request) {
  try {
    // ================================================
    // 1. 请求解析与校验
    // ================================================
    const body = await request.json().catch(() => null);
    if (!body) {
      return errorResponse("请求体格式错误，需要有效的 JSON", 400);
    }

    const { messages } = body as {
      messages?: Message[];
    };

    if (!Array.isArray(messages)) {
      return errorResponse("messages 字段必须是数组", 400);
    }

    if (messages.length === 0) {
      return errorResponse("messages 不能为空", 400);
    }

    if (messages.length > MAX_MESSAGES) {
      return errorResponse(`消息数量超过上限 (${MAX_MESSAGES})`, 400);
    }

    // 校验每条消息的格式
    const validRoles = ["user", "assistant", "system"];
    for (const msg of messages) {
      if (!validRoles.includes(msg.role)) {
        return errorResponse(`无效的消息角色: ${msg.role}`, 400);
      }
      if (typeof msg.content !== "string") {
        return errorResponse("消息内容必须是字符串", 400);
      }
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return errorResponse(`消息内容超过长度限制 (${MAX_MESSAGE_LENGTH})`, 400);
      }
    }

    // 最后一条必须是 user（或 system）
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "user") {
      return errorResponse("最后一条消息必须是用户消息", 400);
    }

    // ================================================
    // 2. 调用 DeepSeek 流式 API
    // ================================================
    const { stream, error } = await createChatCompletionStream(messages);

    if (error || !stream) {
      return errorResponse(error || "创建流失败", 500);
    }

    // ================================================
    // 3. 构建 SSE ReadableStream
    // ================================================
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lastChunk: any = null;

        try {
          for await (const chunk of stream) {
            lastChunk = chunk;

            // 提取增量内容
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
              const sseData = JSON.stringify({ type: "chunk", content });
              controller.enqueue(
                encoder.encode(`data: ${sseData}\n\n`)
              );
            }

            // 检查 finish_reason（流结束信号）
            const finishReason = chunk.choices?.[0]?.finish_reason;
            if (finishReason) {
              // 如果 finish_reason 不是 stop，说明被截断
              if (finishReason !== "stop") {
                const reasonMap: Record<string, string> = {
                  length: "回复超过最大 Token 限制，已被截断",
                  content_filter: "回复被内容过滤器拦截",
                  tool_calls: "模型请求调用工具",
                };
                const warnMsg =
                  reasonMap[finishReason] || `流结束 (${finishReason})`;
                const sseData = JSON.stringify({ type: "chunk", content: `\n\n> ⚠️ ${warnMsg}` });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            }
          }

          // ============================================
          // 4. 发送完成事件（含 Token 统计）
          // ============================================
          // DeepSeek 在流式响应的最后一条 chunk 中会包含 usage
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const usage = (lastChunk as any)?.usage;
          const doneData = JSON.stringify({
            type: "done",
            usage: usage
              ? {
                  promptTokens: usage.prompt_tokens ?? 0,
                  completionTokens: usage.completion_tokens ?? 0,
                  totalTokens: usage.total_tokens ?? 0,
                }
              : {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (err) {
          // 流处理过程中出错
          const message =
            err instanceof Error ? err.message : "流处理出错";
          const errorData = JSON.stringify({
            type: "error",
            error: message,
          });
          try {
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          } catch {
            // 如果 controller 已关闭，忽略
          }
          controller.close();
        }
      },
    });

    // ================================================
    // 5. 返回 SSE 响应
    // ================================================
    return new Response(readableStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 nginx 缓冲
      },
    });
  } catch (err) {
    // 请求处理顶层错误
    return errorResponse(
      err instanceof Error ? err.message : "服务器内部错误",
      500
    );
  }
}

/**
 * 统一的 JSON 错误响应
 * 所有错误均以 JSON 格式返回，客户端根据 HTTP 状态码判断
 */
function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
