/**
 * InterviewRepository —— 面试的数据管家
 *
 * 只做一件事：和数据库聊天（面试会话 + 消息的增删改查）
 * 不做业务判断，那是 Service 的事
 */

import { prisma } from "@/database/client";

export const interviewRepository = {
  /**
   * 创建一场面试会话（刚开考）
   */
  async createSession(data: {
    userId: string;
    resumeId?: number;
    jdContent?: string;
    mode: string;
    difficulty: string;
  }) {
    return prisma.interviewSession.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        jdContent: data.jdContent,
        mode: data.mode,
        difficulty: data.difficulty,
        status: "preparing",
      },
    });
  },

  /**
   * 查询某个用户的全部面试记录（按创建时间倒序）
   * 列表场景不返回消息大字段
   */
  async findSessionsByUserId(userId: string) {
    return prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mode: true,
        difficulty: true,
        status: true,
        duration: true,
        score: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        resumeId: true,
      },
    });
  },

  /**
   * 根据 ID 查询单场面试（返回完整信息 + 关联的消息）
   */
  async findSessionById(id: string) {
    return prisma.interviewSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  /**
   * 更新面试（比如修改状态为 completed、打分等）
   */
  async updateSession(
    id: string,
    data: {
      status?: string;
      duration?: number;
      score?: number;
      completedAt?: Date;
    }
  ) {
    return prisma.interviewSession.update({
      where: { id },
      data,
    });
  },

  /**
   * 删除一场面试（连带删消息，因为 Prisma 外键会级联删除吗？SQLite 需要我们手动删）
   * 所以先删消息，再删会话
   */
  async deleteSession(id: string) {
    await prisma.message.deleteMany({
      where: { sessionId: id },
    });
    return prisma.interviewSession.delete({
      where: { id },
    });
  },

  /**
   * 新增一条消息（聊天过程中每说一句话就调一次）
   */
  async createMessage(data: {
    sessionId: string;
    role: string;
    content: string;
    type: string;
    phase?: string;
    score?: number;
    evaluation?: string;
  }) {
    return prisma.message.create({ data });
  },

  /**
   * 查询一场面试的全部消息（按时间升序）
   */
  async findMessagesBySessionId(sessionId: string) {
    return prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
  },
};
