/**
 * GET /api/resumes
 *
 * 获取当前用户的所有简历 —— Controller
 *
 * Controller 只做三件事：
 *   ① 解析 HTTP 请求（从 Token 拿 userId）
 *   ② 调 Service（查询当前用户的简历）
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

export async function GET(request: NextRequest) {
  try {
    // ① 从 Token 获取当前用户
    const token =
      extractTokenFromCookie(request) ||
      extractTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: "Token 无效或已过期" }, { status: 401 });
    }

    // ② 调 Service（只返回当前用户的简历，天然隔离数据）
    const resumes = await resumeService.getResumes(payload.sub);

    // ③ 返回响应
    return NextResponse.json({ resumes });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "获取简历列表失败";
    console.error("[resumes] Error:", message);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
