/**
 * POST /api/interview/analyze-resume
 *
 * 简历上传 + AI 分析 API —— Controller
 *
 * Controller 只做三件事：
 *   ① 解析 HTTP 请求（拿文件 + 拿 userId）
 *   ② 调 Service（解析 + 分析 + 存数据库）
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

export async function POST(request: NextRequest) {
  try {
    // ================================================
    // ① 解析 HTTP 请求
    // ================================================

    // 从 Token 获取当前用户
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

    // 接收文件
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择 PDF 文件" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "仅支持 PDF 文件格式" },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "文件大小超过 10MB 限制" },
        { status: 400 }
      );
    }

    // ================================================
    // ② 调 Service（解析 + AI 分析 + 存数据库）
    // ================================================
    const resume = await resumeService.uploadAndAnalyze(payload.sub, file);

    // ================================================
    // ③ 返回响应
    // ================================================
    return NextResponse.json(resume);
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "简历分析失败";
    console.error("[analyze-resume] Error:", message);
    return NextResponse.json(
      { error: "服务器内部错误", hint: "请确认简历是文字版PDF（非扫描件）" },
      { status: 500 }
    );
  }
}
