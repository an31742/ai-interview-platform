/**
 * GET    /api/interview/:id — 面试详情（含消息）
 * PATCH  /api/interview/:id — 完成面试（改状态+打分）
 * DELETE /api/interview/:id — 删除面试
 *
 * Controller 三步骨架：
 *   ① 解析请求（Token + 路径参数）
 *   ② 调 Service（权限检查 + 数据操作）
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

/**
 * 面试 sessionId 是 cuid 字符串，不用转数字
 */
function parseSessionId(rawId: string | undefined | null): string | null {
  return rawId && rawId.length > 0 ? rawId : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ① 解析请求
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const sessionId = parseSessionId(rawId);
    if (!sessionId) {
      return NextResponse.json({ error: "面试 ID 格式不正确" }, { status: 400 });
    }

    // ② 调 Service（内部会检查是不是当前用户的）
    const session = await interviewService.getInterviewById(sessionId, userId);

    // ③ 返回响应
    return NextResponse.json({ session });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "获取面试详情失败";
    console.error("[interview detail] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ① 解析请求
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const sessionId = parseSessionId(rawId);
    if (!sessionId) {
      return NextResponse.json({ error: "面试 ID 格式不正确" }, { status: 400 });
    }

    const body = await request.json();
    const { duration, score } = body || {};

    // ② 调 Service（权限检查 + 改状态为 completed）
    const updated = await interviewService.completeInterview(sessionId, userId, {
      duration: duration ? Number(duration) : undefined,
      score: score ? Number(score) : undefined,
    });

    // ③ 返回响应
    return NextResponse.json({ success: true, session: updated });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "完成面试失败";
    console.error("[interview complete] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ① 解析请求
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const sessionId = parseSessionId(rawId);
    if (!sessionId) {
      return NextResponse.json({ error: "面试 ID 格式不正确" }, { status: 400 });
    }

    // ② 调 Service（权限检查通过才会真的删除）
    const deleted = await interviewService.deleteInterview(sessionId, userId);

    // ③ 返回响应
    return NextResponse.json({ success: true, id: deleted.id });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "删除面试失败";
    console.error("[interview delete] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
