/**
 * ReviewAnalyzer Agent
 *
 * 职责：分析面试复盘文本，提取结构化信息并生成错题本条目
 *
 * 流程：
 *   1. 接收复盘文本（面试记录/录音转写）
 *   2. 调用 DeepSeek 提取结构化信息
 *   3. 自动生成错题本条目
 */

import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/constants";
import { REVIEW_EXTRACTION_PROMPT } from "@/lib/interview/prompts/review-analyzer";
import type { InterviewReview, ErrorBookEntry } from "@/types/interview";

const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

export interface ReviewAnalysisResult {
  review: Omit<InterviewReview, "id" | "createdAt">;
  errorEntries: Omit<ErrorBookEntry, "id" | "createdAt" | "reviewCount" | "lastReviewedAt">[];
}

/**
 * 分析复盘文本
 */
export async function analyzeReview(rawText: string): Promise<ReviewAnalysisResult> {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: "你是一个专业的面试复盘分析师。请从面试记录中提取结构化JSON信息，只返回JSON，不要其他内容。",
      },
      {
        role: "user",
        content: REVIEW_EXTRACTION_PROMPT + rawText,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 复盘分析返回为空");

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new Error(`复盘 JSON 解析失败: ${err instanceof Error ? err.message : ""}`);
  }

  // 构建 Review
  const questions = extractQuestions(data.questions);
  const weaknessTags = asStrings(data.weaknessTags);

  const review: Omit<InterviewReview, "id" | "createdAt"> = {
    company: (data.company as string) || "未知公司",
    position: (data.position as string) || "未知岗位",
    date: (data.date as string) || new Date().toISOString().split("T")[0],
    result: ["pass", "fail", "pending"].includes(data.result as string)
      ? (data.result as "pass" | "fail" | "pending")
      : "pending",
    source: rawText.slice(0, 500),
    questions,
    weaknessTags,
    summary: (data.summary as string) || "",
    actionItems: asStrings(data.actionItems),
  };

  // 构建错题本条目
  const errorEntries: ReviewAnalysisResult["errorEntries"] = [];
  for (const q of questions) {
    if (q.score < 7 && q.original) {
      errorEntries.push({
        questionContent: q.original,
        correctAnswer: q.correctAnswer || "待补充",
        yourAnswer: q.yourAnswer || "",
        mistakeType: q.mistakeType || "depth",
        company: review.company,
        tags: weaknessTags.slice(0, 3),
        mastery: 0,
      });
    }
  }

  return { review, errorEntries };
}

function extractQuestions(qs: unknown): InterviewReview["questions"] {
  if (!Array.isArray(qs)) return [];
  return qs.map((q: unknown) => {
    const item = q as Record<string, unknown>;
    return {
      original: (item.original as string) || "",
      yourAnswer: (item.yourAnswer as string) || "",
      score: typeof item.score === "number" ? item.score : 5,
      correctAnswer: (item.correctAnswer as string) || "",
      mistakeType: (item.mistakeType as InterviewReview["questions"][number]["mistakeType"]) || "depth",
      prepStructure: item.prepStructure
        ? {
            point: ((item.prepStructure as Record<string, string>).point) || "",
            reason: ((item.prepStructure as Record<string, string>).reason) || "",
            example: ((item.prepStructure as Record<string, string>).example) || "",
            restate: ((item.prepStructure as Record<string, string>).restate) || "",
          }
        : undefined,
    };
  });
}

function asStrings(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : [];
}
