/**
 * GET /api/resumes/:id  — 获取单份简历
 * DELETE /api/resumes/:id — 删除简历
 *
 * Controller 只做三件事：
 *   ① 解析 HTTP 请求（Token + 路径参数）
 *   ② 调 Service（权限检查 + 数据操作）
 *   ③ 返回 HTTP 响应
 */

import { NextRequest, NextResponse } from "next/server";
import { resumeService } from "@/database/services/resume.service";
import { BusinessError } from "@/database/services/user.service";
import {
  extractTokenFromCookie,
  extractTokenFromHeader,
  verifyToken,
} from "@/lib/auth/utils";

/**
 * 获取当前登录用户（从 Cookie 或 Header）
 * 解析失败返回 null，由调用方决定响应
 */
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
 * 解析路径里的简历 ID（数据库里是 Int 类型）
 */
function parseResumeId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
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
    const resumeId = parseResumeId(rawId);
    if (resumeId === null) {
      return NextResponse.json({ error: "简历 ID 格式不正确" }, { status: 400 });
    }

    // ② 调 Service（内部会检查这份简历是不是当前用户的）
    const resume = await resumeService.getResumeById(resumeId, userId);

    // ③ 返回响应
    return NextResponse.json({ resume });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "获取简历失败";
    console.error("[resume detail] Error:", message);
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
    const resumeId = parseResumeId(rawId);
    if (resumeId === null) {
      return NextResponse.json({ error: "简历 ID 格式不正确" }, { status: 400 });
    }

    // ② 调 Service（权限检查通过才会真的删除）
    const deleted = await resumeService.deleteResume(resumeId, userId);

    // ③ 返回响应
    return NextResponse.json({ success: true, id: deleted.id });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "删除简历失败";
    console.error("[resume delete] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
