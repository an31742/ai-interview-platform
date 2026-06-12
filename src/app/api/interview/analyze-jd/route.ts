/**
 * POST /api/interview/analyze-jd
 *
 * JD 分析 API
 *
 * 流程：
 *   1. 接收 JD 文本 → 2. JD Analyzer Agent 提取结构化信息 → 3. 简历匹配分析（可选） → 4. 返回结果
 *
 * Request:
 * {
 *   jdContent: string        // JD 文本
 *   resume?: object          // 可选的简历完整数据（用于匹配分析，由客户端传来）
 * }
 *
 * Response:
 * {
 *   jd: JD,                  // 结构化 JD 信息
 *   analysis: JDAnalysis     // 匹配分析结果
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeJD } from "@/lib/interview/agents/jd-analyzer";
import type { JD } from "@/types/interview";

// 内存中的 JD 列表（V1 方案，V4 接数据库）
let jdStore: JD[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { jdContent, resume } = body as {
      jdContent?: string;
      resume?: Record<string, unknown>;
    };

    if (!jdContent || typeof jdContent !== "string") {
      return NextResponse.json({ error: "请提供 JD 内容" }, { status: 400 });
    }

    if (jdContent.trim().length < 20) {
      return NextResponse.json(
        { error: "JD 内容过短，请粘贴完整的岗位描述" },
        { status: 400 }
      );
    }

    // 分析 JD（resume 由客户端传入，避免服务端访问 localStorage）
    const { jd, analysis } = await analyzeJD(jdContent, resume as any);

    // 存入 JD 列表
    const jdRecord: JD = {
      id: crypto.randomUUID(),
      content: jdContent,
      company: jd.company,
      position: jd.position,
      createdAt: Date.now(),
      analysis,
    };
    jdStore.unshift(jdRecord);

    return NextResponse.json({
      id: jdRecord.id,
      jd: jdRecord,
      analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "JD 分析失败";
    console.error("[analyze-jd] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/interview/analyze-jd
 * 获取 JD 列表
 */
export async function GET() {
  return NextResponse.json({ jds: jdStore });
}

/**
 * DELETE /api/interview/analyze-jd?id=xxx
 * 删除指定 JD
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) {
    jdStore = jdStore.filter((j) => j.id !== id);
  }
  return NextResponse.json({ success: true });
}
