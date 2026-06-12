/**
 * POST /api/interview/generate-report
 *
 * 面试报告生成 API
 *
 * Request:
 * {
 *   messages: InterviewMessage[]   // 完整面试对话
 *   resumeContext?: string         // 简历上下文
 * }
 *
 * Response:
 * {
 *   score: InterviewScore          // 多维度评分
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { generateScore } from "@/lib/interview/agents/scorer";
import type { InterviewMessage } from "@/types/interview";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { messages, resumeContext } = body as {
      messages?: InterviewMessage[];
      resumeContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 必须是数组且不为空" },
        { status: 400 }
      );
    }

    const score = await generateScore(messages, resumeContext);

    return NextResponse.json({ score });
  } catch (err) {
    const message = err instanceof Error ? err.message : "评分生成失败";
    console.error("[generate-report] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
