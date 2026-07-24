/**
 * ResumeRepository —— 简历的数据管家
 *
 * 只做一件事：和数据库聊天（创建简历）
 */

import { prisma } from "@/database/client";

export const resumeRepository = {
  /**
   * 创建简历记录
   * 在 AI 分析完成后，把所有数据一起存进数据库
   */
  async createResume(data: {
    userId: string;
    resumeName: string;
    size: number;
    rawText: string;
    resumeContext: any;  // parsed 结构化数据
    analysis: any;       // AI 分析结果
  }) {
    return prisma.resume.create({
      data: {
        userId: data.userId,
        resumeName: data.resumeName,
        size: data.size,
        rawText: data.rawText,
        resumeContext: data.resumeContext,
        analysis: data.analysis,
        status: "ready",
      },
    });
  },
};
