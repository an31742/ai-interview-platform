/**
 * InterviewService —— 面试的业务管家
 *
 * 负责：业务规则判断 + 协调 Repository
 * 不处理 HTTP 请求（那是 Controller 的事）
 * 不直接查数据库（那是 Repository 的事）
 */

import { interviewRepository } from "@/database/repositories/interview.repository";
import { BusinessError } from "@/database/services/user.service";

export const interviewService = {
  /**
   * 创建一场面试会话
   */
  async startInterview(
    userId: string,
    data: {
      resumeId?: number;
      jdContent?: string;
      mode: string;
      difficulty: string;
    }
  ) {
    // mode 和 difficulty 是必填
    if (!data.mode || !data.difficulty) {
      throw new BusinessError("面试模式和难度为必填项");
    }

    return interviewRepository.createSession({
      userId,
      resumeId: data.resumeId,
      jdContent: data.jdContent,
      mode: data.mode,
      difficulty: data.difficulty,
    });
  },

  /**
   * 获取当前用户的面试列表
   */
  async getInterviews(userId: string) {
    return interviewRepository.findSessionsByUserId(userId);
  },

  /**
   * 获取单场面试详情（含消息）
   * 业务规则：只能看自己的面试
   */
  async getInterviewById(sessionId: string, userId: string) {
    const session = await interviewRepository.findSessionById(sessionId);

    if (!session || session.userId !== userId) {
      throw new BusinessError("面试不存在或无权访问");
    }

    return session;
  },

  /**
   * 完成面试（改状态 + 打分 + 记时长）
   * 业务规则：只能操作自己的面试
   */
  async completeInterview(
    sessionId: string,
    userId: string,
    data: {
      duration?: number;
      score?: number;
    }
  ) {
    // 先做权限检查
    await this.getInterviewById(sessionId, userId);

    return interviewRepository.updateSession(sessionId, {
      status: "completed",
      duration: data.duration,
      score: data.score,
      completedAt: new Date(),
    });
  },

  /**
   * 删除面试
   * 业务规则：只能删自己的
   */
  async deleteInterview(sessionId: string, userId: string) {
    await this.getInterviewById(sessionId, userId);
    return interviewRepository.deleteSession(sessionId);
  },

  /**
   * 追加一条消息（聊天过程调用）
   * 业务规则：只能给"自己的、还在进行中的"面试加消息
   */
  async appendMessage(
    sessionId: string,
    userId: string,
    data: {
      role: string;
      content: string;
      type: string;
      phase?: string;
      score?: number;
      evaluation?: string;
    }
  ) {
    const session = await this.getInterviewById(sessionId, userId);

    // 只有准备中/进行中的面试才能追加消息
    if (session.status === "completed") {
      throw new BusinessError("面试已结束，无法追加消息");
    }

    return interviewRepository.createMessage({
      sessionId,
      role: data.role,
      content: data.content,
      type: data.type,
      phase: data.phase,
      score: data.score,
      evaluation: data.evaluation,
    });
  },
};
