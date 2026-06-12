/**
 * QuestionGenerator Agent
 *
 * 职责：基于简历 + JD 分析 + 面试阶段，生成针对性面试题
 *
 * 流程：
 *   1. 接收简历信息 + JD 分析 + 当前面试阶段
 *   2. 调用 DeepSeek 生成一组面试题
 *   3. 每道题包含：题目/答案要点/追问/难度
 *   4. 返回结构化的 Question 数组
 */

import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/constants";
import { QUESTION_GENERATION_PROMPT } from "@/lib/interview/prompts/question-generator";
import type { Question, QuestionCategory, QuestionDifficulty, Resume, JDAnalysis } from "@/types/interview";

const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

/**
 * 生成面试题
 *
 * @param resume - 简历信息
 * @param jdAnalysis - JD 分析结果（可选）
 * @param count - 生成数量（默认 5）
 * @returns 面试题数组
 */
export async function generateQuestions(
  resume: Resume,
  jdAnalysis?: JDAnalysis,
  count: number = 5
): Promise<Question[]> {
  // 构建候选人上下文
  const context = buildCandidateContext(resume, jdAnalysis);

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "你是一个资深的前端技术面试官。请基于候选人信息生成面试题。只返回 JSON，不要其他内容。",
      },
      {
        role: "user",
        content:
          QUESTION_GENERATION_PROMPT +
          context +
          `\n\n请生成 ${count} 道面试题，覆盖多个技术类别。`,
      },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 出题返回为空");

  try {
    const result = JSON.parse(content);
    const questions = Array.isArray(result.questions) ? result.questions : [];

    return questions.map((q: Record<string, unknown>, i: number) =>
      validateQuestion(q, i)
    );
  } catch (err) {
    throw new Error(
      `面试题 JSON 解析失败: ${err instanceof Error ? err.message : "未知错误"}`
    );
  }
}

/**
 * 构建候选人上下文
 */
function buildCandidateContext(
  resume: Resume,
  jdAnalysis?: JDAnalysis
): string {
  const parsed = resume.parsed;
  const analysis = resume.analysis;

  let context = `候选人信息：
姓名：${parsed?.name || "未知"}
目标岗位：${parsed?.title || "前端工程师"}
经验：${parsed?.yearsOfExperience || 0}年
技能：${parsed?.skills?.join("、") || "未知"}

项目经验：
${parsed?.projects
  ?.map(
    (p) =>
      `- ${p.name}（${p.techStack.join("/")}）: ${p.description}. 职责: ${p.responsibility}`
  )
  .join("\n") || "无"}

工作经历：
${parsed?.experience
  ?.map((e) => `- ${e.company} ${e.role}（${e.period}）`)
  .join("\n") || "无"}`;

  if (analysis) {
    context += `\n\nAI 分析：
- 优势：${analysis.strengths.join("、")}
- 待改进：${analysis.weaknesses.join("、")}
- 面试重点：${analysis.suggestedFocus.join("、")}`;
  }

  if (jdAnalysis) {
    context += `\n\n目标岗位 JD：
- 必备技能：${jdAnalysis.requiredSkills.join("、")}
- 加分技能：${jdAnalysis.preferredSkills.join("、")}
- 匹配度：${jdAnalysis.matchScore}%
- 面试重点：${jdAnalysis.interviewFocus.join("、")}`;
  }

  return context;
}

/**
 * 校验单道面试题的完整性
 */
function validateQuestion(q: Record<string, unknown>, index: number): Question {
  const validCategories = [
    "vue", "react", "javascript", "css", "browser",
    "engineering", "ai", "system-design", "project", "hr",
  ];
  const validDifficulties = ["junior", "mid", "senior"];

  const category = (q.category as string) || "javascript";
  const difficulty = (q.difficulty as string) || "mid";

  return {
    id: `q_${Date.now()}_${index}`,
    category: validCategories.includes(category)
      ? (category as QuestionCategory)
      : "javascript",
    difficulty: validDifficulties.includes(difficulty)
      ? (difficulty as QuestionDifficulty)
      : "mid",
    content: (q.content as string) || "",
    expectedAnswer: (q.expectedAnswer as string) || "",
    tips: Array.isArray(q.tips) ? (q.tips as string[]) : [],
    tags: Array.isArray(q.tags) ? (q.tags as string[]) : [],
  };
}
