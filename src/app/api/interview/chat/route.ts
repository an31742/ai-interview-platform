/**
 * POST /api/interview/chat
 *
 * 模拟面试对话 API（SSE 流式）
 *
 * 使用 LangGraph 状态机处理每轮面试对话：
 *   1. evaluateAnswer — 评估用户回答，打分
 *   2. decideNext — 条件路由（继续/深入/换题/切阶段/结束）
 *   3. generateResponse — 生成 AI 的回复
 *
 * Request:
 * {
 *   messages: InterviewMessage[]
 *   phase: string
 *   resumeContext?: string
 *   jdContext?: string
 *   phaseScores?: number[]
 *   phaseAnswerCount?: number
 *   totalAnswerCount?: number
 * }
 *
 * Response: SSE Stream
 *   data: {"type":"chunk","content":"..."}
 *   data: {"type":"evaluation","score":7,"comment":"思路清晰"}
 *   data: {"type":"phase-change","phase":"project-deep-dive"}
 *   data: {"type":"done"}
 *   data: {"type":"error","error":"..."}
 */

import { processInterviewTurn } from "@/lib/interview/graphs/interview-graph";
import { retrieveResumeContext } from "@/lib/interview/services/rag-context";
import type { InterviewMessage } from "@/types/interview";

export async function POST(request: Request) {
  try {
    // 1. 解析请求
    const body = await request.json().catch(() => null);
    if (!body) {
      return errorResponse("请求体格式错误", 400);
    }

    const {
      messages,
      phase,
      resumeContext,
      jdContext,
      resumeId,
      phaseScores,
      phaseAnswerCount,
      totalAnswerCount,
    } = body as {
      messages?: InterviewMessage[];
      phase?: string;
      resumeContext?: string;
      jdContext?: string;
      resumeId?: string;
      phaseScores?: number[];
      phaseAnswerCount?: number;
      totalAnswerCount?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse("messages 必须是数组且不为空", 400);
    }

    // 2. 增强简历上下文（RAG 检索）
    let enhancedResumeContext = resumeContext || "";
    if (resumeId && messages.length < 4) {
      // 只在面试早期检索 RAG（节省 Token）
      try {
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        const ragContext = await retrieveResumeContext(
          resumeId,
          lastUserMsg?.content
        );
        if (ragContext) {
          enhancedResumeContext = (resumeContext || "") + "\n\n【简历详细经历】\n" + ragContext;
        }
      } catch {
        // RAG 检索失败不影响主流程
      }
    }

    // 3. 运行 LangGraph 处理本轮对话
    const result = await processInterviewTurn({
      messages,
      phase: (phase as InterviewMessage["phase"]) || "self-intro",
      phaseScores: phaseScores || [],
      phaseAnswerCount: phaseAnswerCount || 0,
      totalAnswerCount: totalAnswerCount || 0,
      resumeContext: enhancedResumeContext,
      jdContext,
    });

    if (result.error && !result.aiResponse) {
      return errorResponse(result.error, 500);
    }

    // 3. 构建 SSE 流
    const encoder = new TextEncoder();
    const aiText = result.aiResponse || "";

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          // 逐字输出（打字机效果）
          const chars = aiText.split("");
          for (let i = 0; i < chars.length; i++) {
            const sseData = JSON.stringify({
              type: "chunk",
              content: chars[i],
            });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            // 模拟打字间隔：标点符号后稍长，普通字符稍短
            if (chars[i].match(/[。！？\n]/)) {
              await new Promise((r) => setTimeout(r, 50));
            } else if (chars[i].match(/[，、；：]/)) {
              await new Promise((r) => setTimeout(r, 30));
            } else {
              await new Promise((r) => setTimeout(r, 15));
            }
          }

          // 发送评分事件（如果有）
          if (result.evaluation) {
            const evalData = JSON.stringify({
              type: "evaluation",
              score: result.evaluation.overall,
              comment: result.evaluation.comment,
            });
            controller.enqueue(encoder.encode(`data: ${evalData}\n\n`));
          }

          // 发送阶段变更事件（如果有）
          if (result.phase !== phase) {
            const phaseData = JSON.stringify({
              type: "phase-change",
              phase: result.phase,
            });
            controller.enqueue(encoder.encode(`data: ${phaseData}\n\n`));
          }

          // 完成事件
          const doneData = JSON.stringify({ type: "done" });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (err) {
          const errorData = JSON.stringify({
            type: "error",
            error: err instanceof Error ? err.message : "流处理出错",
          });
          try {
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          } catch { /* ignore */ }
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "服务器内部错误",
      500
    );
  }
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
