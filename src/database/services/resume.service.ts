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

  /**
   * 获取当前用户的简历列表
   */
  async getResumes(userId: string) {
    return resumeRepository.findByUserId(userId);
  },

  /**
   * 获取单份简历详情
   * 业务规则：只能看自己的简历
   */
  async getResumeById(resumeId: number, userId: string) {
    const resume = await resumeRepository.findById(resumeId);

    // 找不到，或者不是当前用户的简历 → 都返回同一个错误
    if (!resume || resume.userId !== userId) {
      throw new BusinessError("简历不存在或无权访问");
    }

    return resume;
  },

  /**
   * 删除简历
   * 业务规则：只能删除自己的简历
   */
  async deleteResume(resumeId: number, userId: string) {
    // 先做权限检查，查不到直接抛错
    await this.getResumeById(resumeId, userId);

    return resumeRepository.delete(resumeId);
  },
};
