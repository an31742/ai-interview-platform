/**
 * 面试官 LangGraph 状态图
 *
 * 每次 /api/interview/chat 调用执行一次图：
 *
 *   START → evaluateAnswer → decideNext → generateResponse → END
 *                                        │
 *                                        └─ (end_interview) → END
 *
 * 节点说明：
 *   evaluateAnswer  — 评估用户最新回答，打分
 *   decideNext       — 条件路由：继续/深入/换题/切阶段/结束
 *   generateResponse — 生成 AI 的下一轮提问或反馈
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "@/lib/constants";
import type { InterviewMessage, InterviewPhase } from "@/types/interview";
import {
  SELF_INTRO_PROMPT,
  PROJECT_DIVE_PROMPT,
  FUNDAMENTALS_PROMPT,
  SYSTEM_DESIGN_PROMPT,
  QA_PROMPT,
  ANSWER_EVALUATION_PROMPT,
  PHASE_TRANSITION_PROMPT,
} from "@/lib/interview/prompts/interviewer";

// ============================================
// LLM 客户端（使用 OpenAI SDK 直接调用 DeepSeek）
// ============================================

const client = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

// ============================================
// 1. 状态定义
// ============================================

/** 单次评估结果 */
interface Evaluation {
  accuracy: number;
  depth: number;
  structure: number;
  overall: number;
  comment: string;
  goodPoint: string;
  badPoint: string;
}

/** 路由决策 */
interface Decision {
  decision: "continue" | "deeper" | "switch_topic" | "next_phase" | "end_interview";
  reason: string;
}

const messagesReducer: (left: InterviewMessage[], right: InterviewMessage[]) => InterviewMessage[] = (left, right) => {
  // 如果 right 是空数组，返回 left
  if (!right || right.length === 0) return left;
  // 简单的追加合并
  return [...(left || []), ...right];
};

/** 图状态 */
const InterviewState = Annotation.Root({
  // 对话历史
  messages: Annotation<InterviewMessage[]>({
    reducer: messagesReducer,
    default: () => [],
  }),
  // 当前面试阶段
  phase: Annotation<InterviewPhase>({
    reducer: (a, b) => b ?? a,
    default: () => "self-intro" as InterviewPhase,
  }),
  // 当前阶段的回答数
  phaseAnswerCount: Annotation<number>({
    reducer: (a, b) => b ?? a,
    default: () => 0,
  }),
  // 当前阶段的评分列表
  phaseScores: Annotation<number[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  // 总回答数
  totalAnswerCount: Annotation<number>({
    reducer: (a, b) => b ?? a,
    default: () => 0,
  }),
  // 最新评估结果
  currentEvaluation: Annotation<Evaluation | null>({
    reducer: (a, b) => b ?? a,
    default: () => null,
  }),
  // 最新路由决策
  currentDecision: Annotation<Decision | null>({
    reducer: (a, b) => b ?? a,
    default: () => null,
  }),
  // AI 生成的回复内容
  aiResponse: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  // 简历上下文
  resumeContext: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  // JD 上下文
  jdContext: Annotation<string>({
    reducer: (a, b) => b ?? a,
    default: () => "",
  }),
  // 错误信息
  error: Annotation<string | null>({
    reducer: (a, b) => b ?? a,
    default: () => null,
  }),
});

type State = typeof InterviewState.State;

// ============================================
// 3. LLM 调用辅助函数
// ============================================

/** 调用 DeepSeek 并返回文本 */
async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<string> {
  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
  });
  return response.choices[0]?.message?.content || "";
}

/** 从文本中提取 JSON 对象 */
function extractJSON(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ============================================
// 4. 节点函数
// ============================================

/**
 * 节点 A: 评估用户最新回答
 */
async function evaluateAnswer(state: State): Promise<Partial<State>> {
  try {
    const messages = state.messages;
    const lastMsg = messages[messages.length - 1];

    if (!lastMsg || lastMsg.role !== "user") {
      return { currentEvaluation: null };
    }

    const text = await callDeepSeek(
      "你是一个严格的面试评分员。评估候选人的回答，输出 JSON 格式评分。",
      ANSWER_EVALUATION_PROMPT + lastMsg.content,
      0.1
    );

    const parsed = extractJSON(text);
    if (!parsed) return { currentEvaluation: null };

    const evaluation = parsed as unknown as Evaluation;
    const score = evaluation.overall || 5;

    return {
      currentEvaluation: evaluation,
      phaseScores: [...(state.phaseScores || []), score],
      phaseAnswerCount: (state.phaseAnswerCount || 0) + 1,
      totalAnswerCount: (state.totalAnswerCount || 0) + 1,
    };
  } catch (err) {
    return {
      currentEvaluation: null,
      error: `评估失败: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}

/**
 * 节点 B: 决定下一步
 */
async function decideNext(state: State): Promise<Partial<State>> {
  try {
    const scores = state.phaseScores || [];
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;

    const prompt = PHASE_TRANSITION_PROMPT
      .replace("{phase}", state.phase || "self-intro")
      .replace("{answerCount}", String(state.phaseAnswerCount || 0))
      .replace("{avgScore}", String(avgScore))
      .replace("{totalAnswers}", String(state.totalAnswerCount || 0));

    const text = await callDeepSeek(
      "你是面试流程控制器，输出 JSON 决策。",
      prompt,
      0.1
    );

    const parsed = extractJSON(text);
    if (!parsed) {
      return { currentDecision: { decision: "continue", reason: "默认继续" } };
    }

    return { currentDecision: parsed as unknown as Decision };
  } catch {
    return { currentDecision: { decision: "continue", reason: "解析失败，默认继续" } };
  }
}

/**
 * 获取当前阶段的 Prompt
 */
function getPhasePrompt(phase: InterviewPhase): string {
  const prompts: Record<string, string> = {
    "self-intro": SELF_INTRO_PROMPT,
    "project-deep-dive": PROJECT_DIVE_PROMPT,
    fundamentals: FUNDAMENTALS_PROMPT,
    "system-design": SYSTEM_DESIGN_PROMPT,
    qa: QA_PROMPT,
  };
  return prompts[phase] || BASE_FALLBACK_PROMPT;
}

const BASE_FALLBACK_PROMPT = `你是一位专业的前端技术面试官。请根据对话历史继续面试。`;

/**
 * 构建上下文信息（简历 + JD）
 */
function buildContext(state: State): string {
  const parts: string[] = [];
  if (state.resumeContext) {
    parts.push(`候选人简历信息：\n${state.resumeContext}`);
  }
  if (state.jdContext) {
    parts.push(`目标岗位 JD 信息：\n${state.jdContext}`);
  }
  return parts.length > 0 ? "\n\n---\n\n" + parts.join("\n\n") : "";
}

/**
 * 构建对话历史文本
 */
function buildConversationHistory(messages: InterviewMessage[]): string {
  return messages
    .map((m) => `${m.role === "ai" ? "面试官" : "候选人"}：${m.content}`)
    .join("\n\n");
}

/**
 * 获取下一个阶段
 */
function getNextPhase(current: InterviewPhase): InterviewPhase {
  const phases: InterviewPhase[] = [
    "self-intro",
    "project-deep-dive",
    "fundamentals",
    "system-design",
    "qa",
  ];
  const idx = phases.indexOf(current);
  if (idx >= 0 && idx < phases.length - 1) {
    return phases[idx + 1];
  }
  return "qa";
}

/**
 * 节点 C: 生成 AI 回复
 * 根据评估结果和决策生成下一轮内容
 */
async function generateResponse(state: State): Promise<Partial<State>> {
  try {
    const decision = state.currentDecision?.decision || "continue";
    const evaluation = state.currentEvaluation;

    // 如果是 end_interview，生成结束语
    if (decision === "end_interview") {
      return {
        aiResponse:
          "⏰ 面试时间到了！感谢你的参与，我来做个简单总结。\n\n你展示了不错的项目经验，尤其在 AI 应用方面有实际落地。建议在 CSS 基础、Vue/React 原理深度上继续加强。\n\n稍后我会生成详细的面试报告，请查看。",
      };
    }

    // 如果决策是切换阶段，更新 phase
    let phase = state.phase;
    if (decision === "next_phase") {
      phase = getNextPhase(state.phase);
    }

    const phasePrompt = getPhasePrompt(phase);
    const context = buildContext(state);
    const history = buildConversationHistory(state.messages);

    // 构建给模型的提示
    let instruction = "";
    if (decision === "deeper") {
      instruction = "\n\n候选人上一轮回答得不错，请继续深入追问，考察真正理解深度。";
    } else if (decision === "switch_topic") {
      instruction = "\n\n候选人上一轮回答一般，换个角度或话题继续提问。";
    } else if (decision === "next_phase") {
      instruction = `\n\n现在进入新阶段。用一句话过渡，然后开始新阶段的问题。`;
    }

    const systemMessage = `${phasePrompt}${context}${instruction}`;

    // 构建对话历史
    const historyMessages = state.messages.slice(-6).map((m) => ({
      role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }));

    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system" as const, content: systemMessage },
        ...historyMessages,
        {
          role: "user" as const,
          content: "请根据以上对话历史继续面试。如果是新阶段，先过渡再提问。",
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";

    // 解析评分（如果 AI 回复中包含了评分）
    let aiContent = content;
    const parts = content.split("---").map((s) => s.trim());
    if (parts.length >= 2 && evaluation) {
      aiContent = parts[0];
    }

    return {
      aiResponse: aiContent,
      phase,
    };
  } catch (err) {
    return {
      aiResponse: "抱歉，我遇到了技术问题，请重新说一遍好吗？",
      error: `生成回复失败: ${err instanceof Error ? err.message : ""}`,
    };
  }
}

// ============================================
// 4. 条件路由函数
// ============================================

/**
 * 路由：根据决策决定是否继续到 generateResponse
 */
function routerAfterDecide(state: State): string {
  const decision = state.currentDecision?.decision;
  if (decision === "end_interview") {
    return "generateResponse"; // 仍然需要生成结束语
  }
  return "generateResponse";
}

// ============================================
// 5. 构建并编译图
// ============================================

function buildInterviewGraph() {
  const graph = new StateGraph(InterviewState)
    // 节点
    .addNode("evaluateAnswer", evaluateAnswer)
    .addNode("decideNext", decideNext)
    .addNode("generateResponse", generateResponse)
    // 边
    .addEdge("__start__", "evaluateAnswer")
    .addEdge("evaluateAnswer", "decideNext")
    .addEdge("decideNext", "generateResponse")
    .addEdge("generateResponse", END);

  return graph.compile();
}

// 导出编译后的图实例（单例）
export const interviewGraph = buildInterviewGraph();

// ============================================
// 6. 便捷调用函数
// ============================================

export interface InterviewTurnInput {
  messages: InterviewMessage[];
  phase: InterviewPhase;
  phaseScores?: number[];
  phaseAnswerCount?: number;
  totalAnswerCount?: number;
  resumeContext?: string;
  jdContext?: string;
}

export interface InterviewTurnOutput {
  aiResponse: string;
  phase: InterviewPhase;
  score?: number;
  comment?: string;
  evaluation?: Evaluation;
  decision?: Decision;
  error?: string;
}

/**
 * 执行一轮面试对话
 *
 * @param input - 当前面试状态
 * @returns AI 回复 + 更新后的状态
 */
export async function processInterviewTurn(
  input: InterviewTurnInput
): Promise<InterviewTurnOutput> {
  try {
    const result = await interviewGraph.invoke({
      messages: input.messages,
      phase: input.phase,
      phaseScores: input.phaseScores || [],
      phaseAnswerCount: input.phaseAnswerCount || 0,
      totalAnswerCount: input.totalAnswerCount || 0,
      resumeContext: input.resumeContext || "",
      jdContext: input.jdContext || "",
    });

    return {
      aiResponse: result.aiResponse || "",
      phase: result.phase || input.phase,
      evaluation: result.currentEvaluation || undefined,
      decision: result.currentDecision || undefined,
      error: result.error || undefined,
    };
  } catch (err) {
    return {
      aiResponse: "",
      phase: input.phase,
      error: err instanceof Error ? err.message : "图执行失败",
    };
  }
}
