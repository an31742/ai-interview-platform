/**
 * POST /api/interview/generate-questions
 *
 * 面试题生成 API
 *
 * Request:
 * {
 *   resume: object            // 简历完整数据（客户端传入）
 *   jdAnalysis?: object       // 可选的 JD 分析结果
 *   count?: number            // 生成数量（默认 5）
 * }
 *
 * Response:
 * {
 *   questions: Question[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { generateQuestions } from "@/lib/interview/agents/question-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { resume, jdAnalysis, count } = body as {
      resume?: Record<string, unknown>;
      jdAnalysis?: Record<string, unknown>;
      count?: number;
    };

    if (!resume) {
      return NextResponse.json(
        { error: "请提供简历数据（客户端传入）" },
        { status: 400 }
      );
    }

    // 生成面试题（数据由客户端传入，避免服务端访问 localStorage）
    const questions = await generateQuestions(
      resume as any,
      jdAnalysis as any,
      count || 5
    );

    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "出题失败";
    console.error("[generate-questions] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
