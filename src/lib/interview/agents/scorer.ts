/**
 * Scorer Agent
 *
 * 职责：面试结束后，基于整场对话生成多维度评分报告
 *
 * 流程：
 *   1. 接收完整的面试对话历史
 *   2. 调用 DeepSeek 从五个维度评分
 *   3. 生成优缺点分析和改进建议
 *   4. 返回结构化的 InterviewScore
 */

import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/constants";
import { SCORING_PROMPT } from "@/lib/interview/prompts/scorer";
import type { InterviewScore, InterviewMessage } from "@/types/interview";

const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

/**
 * 生成面试评分报告
 *
 * @param messages - 完整面试对话
 * @param resumeContext - 简历上下文（可选）
 * @returns 结构化评分结果
 */
export async function generateScore(
  messages: InterviewMessage[],
  resumeContext?: string
): Promise<InterviewScore> {
  const conversationHistory = messages
    .map((m) => `【${m.role === "ai" ? "面试官" : "候选人"}】\n${m.content}`)
    .join("\n\n---\n\n");

  const prompt = SCORING_PROMPT
    .replace("{resumeContext}", resumeContext || "（未提供）")
    .replace("{conversationHistory}", conversationHistory);

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: "你是一个资深技术面试官，请评分。只返回 JSON，不要其他内容。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Scorer 返回为空");

  try {
    const result = JSON.parse(content);
    return validateScore(result);
  } catch (err) {
    throw new Error(
      `评分 JSON 解析失败: ${err instanceof Error ? err.message : ""}`
    );
  }
}

/**
 * 校验分数完整性
 */
function validateScore(data: Record<string, unknown>): InterviewScore {
  const dims = (data.dimensions || {}) as Record<string, unknown>;

  return {
    overall: clamp(data.overall as number, 0, 100),
    dimensions: {
      fundamentals: clamp(dims.fundamentals as number, 0, 100),
      projectDepth: clamp(dims.projectDepth as number, 0, 100),
      systemDesign: clamp(dims.systemDesign as number, 0, 100),
      expression: clamp(dims.expression as number, 0, 100),
      aiCapability: clamp(dims.aiCapability as number, 0, 100),
    },
    strengths: asStringArray(data.strengths),
    weaknesses: asStringArray(data.weaknesses),
    suggestions: asStringArray(data.suggestions),
    questionScores: [],
    expressionIssues: data.expressionIssues
      ? {
          fillerWords: asStringArray(
            (data.expressionIssues as Record<string, unknown>).fillerWords
          ),
          tensionLevel: ["calm", "moderate", "nervous"].includes(
            (data.expressionIssues as Record<string, unknown>).tensionLevel as string
          )
            ? ((data.expressionIssues as Record<string, unknown>).tensionLevel as
                | "calm"
                | "moderate"
                | "nervous")
            : "moderate",
          advice:
            ((data.expressionIssues as Record<string, unknown>).advice as string) || "",
        }
      : undefined,
  };
}

function clamp(val: unknown, min: number, max: number): number {
  const n = typeof val === "number" ? val : Number(val) || 0;
  return Math.max(min, Math.min(max, n));
}

function asStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : [];
}

/**
 * POST /api/interview/generate-report 的 handler
 */
export async function generateReport(
  messages: InterviewMessage[],
  resumeContext?: string
): Promise<InterviewScore> {
  return generateScore(messages, resumeContext);
}
