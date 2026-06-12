/**
 * JDAnalyzer Agent
 *
 * 职责：分析岗位描述（JD），提取结构化信息，与简历做匹配分析
 *
 * 流程：
 *   1. 接收 JD 文本
 *   2. 调用 DeepSeek 提取结构化信息（技能/职责/要求）
 *   3. 如果有简历信息，做匹配度分析
 *   4. 返回结构化的 JDAnalysis
 */

import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/constants";
import {
  JD_EXTRACTION_PROMPT,
  JD_MATCH_ANALYSIS_PROMPT,
  RESUME_CONTEXT_FOR_MATCH,
} from "@/lib/interview/prompts/jd-analysis";
import type { JD, JDAnalysis, Resume } from "@/types/interview";

const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

/**
 * 分析 JD
 *
 * @param jdContent - JD 文本
 * @param resume - 可选的简历信息（用于匹配分析）
 * @returns JD 分析结果
 */
export async function analyzeJD(
  jdContent: string,
  resume?: Resume
): Promise<{ jd: Omit<JD, "id" | "createdAt">; analysis: JDAnalysis }> {
  // 第一阶段：提取结构化信息
  const extracted = await extractJDInfo(jdContent);

  // 第二阶段：匹配分析（如果有简历）
  let matchScore = 0;
  let matchAnalysis = "";
  let interviewFocus: string[] = [];
  let suggestedQuestions: string[] = [];

  if (resume?.parsed && resume?.analysis) {
    const matchResult = await analyzeMatch(
      extracted,
      resume
    );
    matchScore = matchResult.matchScore;
    matchAnalysis = matchResult.matchAnalysis;
    interviewFocus = matchResult.interviewFocus;
    suggestedQuestions = matchResult.suggestedQuestions;
  }

  const analysis: JDAnalysis = {
    requiredSkills: extracted.requiredSkills,
    preferredSkills: extracted.preferredSkills,
    responsibilities: extracted.responsibilities,
    interviewFocus,
    matchScore,
    matchAnalysis,
  };

  return {
    jd: {
      content: jdContent,
      company: extracted.company,
      position: extracted.position,
      analysis,
    },
    analysis,
  };
}

/**
 * 第一阶段：从 JD 文本提取结构化信息
 */
async function extractJDInfo(jdContent: string) {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content: "你是一个专业的 JD 解析器。请从招聘 JD 中提取结构化 JSON 信息，只返回 JSON，不要其他内容。",
      },
      {
        role: "user",
        content: JD_EXTRACTION_PROMPT + jdContent,
      },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("DeepSeek JD 解析返回为空");

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(
      `JD 解析 JSON 解析失败: ${err instanceof Error ? err.message : "未知错误"}`
    );
  }
}

/**
 * 第二阶段：简历-JD 匹配分析
 */
async function analyzeMatch(
  jdData: Record<string, unknown>,
  resume: Resume
) {
  const resumeContext = RESUME_CONTEXT_FOR_MATCH
    .replace("{name}", resume.parsed?.name || "未知")
    .replace("{title}", resume.parsed?.title || "前端工程师")
    .replace("{yearsOfExperience}", String(resume.parsed?.yearsOfExperience || 0))
    .replace("{skills}", resume.parsed?.skills?.join("、") || "")
    .replace(
      "{projectSummary}",
      resume.parsed?.projects
        ?.map((p) => `${p.name}（${p.techStack.join("/")}）`)
        .join("；") || ""
    )
    .replace(
      "{strengths}",
      resume.analysis?.strengths?.join("、") || ""
    )
    .replace(
      "{weaknesses}",
      resume.analysis?.weaknesses?.join("、") || ""
    );

  const prompt =
    JD_MATCH_ANALYSIS_PROMPT +
    resumeContext +
    "\n\n目标岗位 JD 信息：\n" +
    JSON.stringify(jdData, null, 2);

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "你是一个资深技术面试官 + 招聘专家，请分析简历与 JD 的匹配度。只返回 JSON，不要其他内容。",
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
  if (!content) throw new Error("DeepSeek 匹配分析返回为空");

  try {
    const result = JSON.parse(content);
    return {
      matchScore: typeof result.matchScore === "number" ? result.matchScore : 0,
      matchAnalysis: result.matchAnalysis || "",
      interviewFocus: Array.isArray(result.interviewFocus)
        ? result.interviewFocus
        : [],
      suggestedQuestions: Array.isArray(result.suggestedQuestions)
        ? result.suggestedQuestions
        : [],
    };
  } catch (err) {
    throw new Error(
      `匹配分析 JSON 解析失败: ${err instanceof Error ? err.message : "未知错误"}`
    );
  }
}
