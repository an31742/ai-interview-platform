/**
 * ResumeAnalyzer Agent
 *
 * 职责：分析简历 PDF 的原始文本，提取结构化信息并给出面试建议
 *
 * 流程：
 *   1. 接收 PDF 解析后的纯文本
 *   2. 调用 DeepSeek 提取结构化信息（姓名/技能/项目等）
 *   3. 再调用 DeepSeek 分析优劣势
 *   4. 返回结构化的 ResumeParsed + ResumeAnalysis
 *
 * 为什么分两步而不是一次调用？
 *   两步的准确性更高——先聚焦"提取"，再基于提取结果做"分析"。
 *   一次调用容易遗漏细节或产生幻觉。
 */

import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/constants";
import {
  RESUME_EXTRACTION_PROMPT,
  RESUME_ANALYSIS_PROMPT,
} from "@/lib/interview/prompts/resume-analysis";
import type { ResumeParsed, ResumeAnalysis } from "@/types/interview";

const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

/**
 * 分析简历
 *
 * @param rawText - PDF 解析后的纯文本
 * @returns 结构化信息 + 优劣势分析
 */
export async function analyzeResume(
  rawText: string
): Promise<{
  parsed: ResumeParsed;
  analysis: ResumeAnalysis;
}> {
  // 第一阶段：提取结构化信息
  const parsed = await extractResumeInfo(rawText);

  // 第二阶段：分析优劣势
  const analysis = await analyzeResumeStrengths(parsed);

  return { parsed, analysis };
}

/**
 * 第一阶段：从非结构化文本提取结构化简历信息
 */
async function extractResumeInfo(rawText: string): Promise<ResumeParsed> {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "你是一个专业的简历解析器。请从简历文本中提取结构化JSON信息，只返回JSON，不要其他内容。",
      },
      {
        role: "user",
        content: RESUME_EXTRACTION_PROMPT + rawText,
      },
    ],
    temperature: 0.1, // 低温度，保证提取准确性
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 返回为空");
  }

  try {
    const parsed = JSON.parse(content) as ResumeParsed;
    return validateResumeParsed(parsed);
  } catch (err) {
    throw new Error(`简历解析 JSON 解析失败: ${err instanceof Error ? err.message : "未知错误"}`);
  }
}

/**
 * 第二阶段：基于结构化信息分析优劣势
 */
async function analyzeResumeStrengths(
  parsed: ResumeParsed
): Promise<ResumeAnalysis> {
  const candidateInfo = JSON.stringify(parsed, null, 2);

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "你是一个资深技术面试官，请基于候选人信息分析优劣势。只返回JSON，不要其他内容。",
      },
      {
        role: "user",
        content: RESUME_ANALYSIS_PROMPT + candidateInfo,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 分析返回为空");
  }

  try {
    const analysis = JSON.parse(content) as ResumeAnalysis;
    return validateResumeAnalysis(analysis);
  } catch (err) {
    throw new Error(`简历分析 JSON 解析失败: ${err instanceof Error ? err.message : "未知错误"}`);
  }
}

/**
 * 校验结构化信息完整性
 */
function validateResumeParsed(data: Partial<ResumeParsed>): ResumeParsed {
  return {
    name: data.name || "未知",
    title: data.title || "前端工程师",
    yearsOfExperience: data.yearsOfExperience ?? 0,
    skills: Array.isArray(data.skills) ? data.skills : [],
    experience: Array.isArray(data.experience) ? data.experience : [],
    education: Array.isArray(data.education) ? data.education : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
  };
}

/**
 * 校验分析结果完整性
 */
function validateResumeAnalysis(data: Partial<ResumeAnalysis>): ResumeAnalysis {
  return {
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
    suggestedFocus: Array.isArray(data.suggestedFocus) ? data.suggestedFocus : [],
    confidence: typeof data.confidence === "number" ? data.confidence : 50,
    missingKeywords: Array.isArray(data.missingKeywords) ? data.missingKeywords : [],
    suggestion: data.suggestion || "",
  };
}
