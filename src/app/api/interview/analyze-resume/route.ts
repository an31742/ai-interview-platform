/**
 * POST /api/interview/analyze-resume
 *
 * 简历上传 + AI 分析 API
 *
 * 流程：
 *   1. 接收 PDF 文件 → 2. pdf-parse 解析文本 → 3. Resume Analyzer Agent 分析 → 4. 返回结果
 *
 * Request: FormData
 *   file: PDF 文件
 *
 * Response:
 * {
 *   id: string,
 *   fileName: string,
 *   rawText: string,         // PDF 原始文本（前端展示用）
 *   parsed: ResumeParsed,    // 结构化信息
 *   analysis: ResumeAnalysis  // AI 分析结果
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/interview/utils/pdf-parser";
import { analyzeResume } from "@/lib/interview/agents/resume-analyzer";
import { indexResumeToRag } from "@/lib/interview/services/rag-context";

export async function POST(request: NextRequest) {
  try {
    // ================================================
    // 1. 接收文件 + 校验
    // ================================================
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

    // 10MB 限制
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "文件大小超过 10MB 限制" },
        { status: 400 }
      );
    }

    // ================================================
    // 2. PDF 解析
    // ================================================
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfResult = await parsePdf(buffer, file.name);

    if (!pdfResult.text.trim()) {
      return NextResponse.json(
        { error: "PDF 文件内容为空，请检查文件是否可读" },
        { status: 400 }
      );
    }

    // ================================================
    // 3. AI 分析（提取结构化信息 + 优劣势分析）
    // ================================================
    const { parsed, analysis } = await analyzeResume(pdfResult.text);

    // ================================================
    // 4. 返回结果 + 后台索引到 RAG
    // ================================================

    // 非阻塞：后台索引到向量库（失败不影响主流程）
    const ragData = { id: "", fileName: file.name, rawText: pdfResult.text, parsed, analysis };
    indexResumeToRag(ragData as any).catch(() => {});

    return NextResponse.json({
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      pageCount: pdfResult.pageCount,
      rawText: pdfResult.text.slice(0, 2000), // 只返回前2000字用于展示
      parsed,
      analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "简历分析失败";
    console.error("[analyze-resume] Error:", message);

    return NextResponse.json(
      {
        error: message,
        hint: "请确认简历是文字版PDF（非扫描件），且内容清晰",
      },
      { status: 500 }
    );
  }
}
