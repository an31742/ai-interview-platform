/**
 * GET    /api/interviews            — 当前用户的面试列表
 *
 * Controller 三步骨架：
 *   ① 解析请求（Token → userId）
 *   ② 调 Service（getInterviews）
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

export async function GET(request: NextRequest) {
  try {
    // ① 解析请求
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // ② 调 Service
    const sessions = await interviewService.getInterviews(userId);

    // ③ 返回响应
    return NextResponse.json({ sessions });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "获取面试列表失败";
    console.error("[interviews list] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
