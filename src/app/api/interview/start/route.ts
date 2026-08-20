/**
 * POST /api/interview/start — 创建一场新面试
 * GET  /api/interview/start — 已废弃：用 GET /api/interviews 代替，
 *                              这里只保留 POST 创建面试
 *
 * Controller 三步骨架：
 *   ① 解析请求（Token → userId；Body → 面试参数）
 *   ② 调 Service（startInterview）
 *   ③ 返回响应
 */

import { NextRequest, NextResponse } from "next/server";
import { interviewService } from "@/database/services/interview.service";
import { BusinessError } from "@/database/services/user.service";
import {
  extractTokenFromCookie,
  extractTokenFromHeader,
  verifyToken,
} from "@/lib/auth/utils";

async function getUserId(request: NextRequest): Promise<string | null> {
  const token =
    extractTokenFromCookie(request) ||
    extractTokenFromHeader(request);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.sub) return null;

  return payload.sub;
}

export async function POST(request: NextRequest) {
  try {
    // ① 解析请求：用户 + body
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { resumeId, jdContent, mode, difficulty } = body || {};

    // ② 调 Service
    const session = await interviewService.startInterview(userId, {
      resumeId: resumeId ? Number(resumeId) : undefined,
      jdContent,
      mode,
      difficulty,
    });

    // ③ 返回响应
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "创建面试失败";
    console.error("[interview start] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
