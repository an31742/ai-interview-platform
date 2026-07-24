/**
 * ResumeService —— 简历的业务管家
 *
 * 负责：处理文件解析 + AI 分析 + 调 Repository 存数据库
 * 不处理 HTTP 请求（那是 Controller 的事）
 */

import { parsePdf } from "@/lib/interview/utils/pdf-parser";
import { analyzeResume } from "@/lib/interview/agents/resume-analyzer";
import { resumeRepository } from "@/database/repositories/resume.repository"
import { BusinessError } from "@/database/services/user.service";

export const resumeService = {
  /**
   * 上传并分析简历
   *
   * 步骤：
   * ① PDF 解析（提取文字）
   * ② AI 分析（提取结构化信息 + 评价）
   * ③ 存入数据库
   * ④ 返回结果
   */
  async uploadAndAnalyze(userId: string, file: File) {
    // ① PDF 解析
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfResult = await parsePdf(buffer, file.name);

    if (!pdfResult.text.trim()) {
      throw new BusinessError("PDF 文件内容为空，请检查文件是否可读");
    }

    // ② AI 分析
    const { parsed, analysis } = await analyzeResume(pdfResult.text);

    // ③ 存入数据库
    const resume = await resumeRepository.createResume({
      userId,
      resumeName: file.name,
      size: file.size,
      rawText: pdfResult.text.slice(0, 2000),
      resumeContext: parsed,
      analysis,
    });

    return resume;
  },
};
