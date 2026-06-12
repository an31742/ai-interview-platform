/**
 * POST /api/interview/analyze-review
 *
 * 面试复盘分析 API
 *
 * Request:
 * {
 *   content: string   // 复盘文本（面试记录/录音转写）
 * }
 *
 * Response:
 * {
 *   review: InterviewReview,
 *   errorEntries: ErrorBookEntry[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeReview } from "@/lib/interview/agents/review-analyzer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { content } = body as { content?: string };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "请提供复盘内容" }, { status: 400 });
    }

    if (content.trim().length < 30) {
      return NextResponse.json(
        { error: "复盘内容过短，请粘贴完整的面试记录" },
        { status: 400 }
      );
    }

    const result = await analyzeReview(content);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "复盘分析失败";
    console.error("[analyze-review] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
