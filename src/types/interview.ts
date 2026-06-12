// ============================================
// AI 智能面试训练平台 · 核心类型定义
// ============================================

// ──── 简历 (Resume) ────

export interface Resume {
  id: string;
  fileName: string;
  fileSize: number;
  uploadTime: number;
  status: ResumeStatus;

  /** PDF 解析后的原始文本 */
  rawText?: string;
  /** 结构化解析结果 */
  parsed?: ResumeParsed;
  /** AI 分析结果 */
  analysis?: ResumeAnalysis;
}

export type ResumeStatus =
  | "uploading"
  | "parsing"
  | "analyzing"
  | "ready"
  | "error";

export interface ResumeParsed {
  name: string;
  title: string;
  yearsOfExperience: number;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
}

export interface WorkExperience {
  company: string;
  role: string;
  period: string;
  description: string;
  highlights: string[];
}

export interface Education {
  school: string;
  major: string;
  degree: string;
  period: string;
}

export interface Project {
  name: string;
  techStack: string[];
  description: string;
  responsibility: string;
}

export interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  suggestedFocus: string[];
  confidence: number;
  missingKeywords: string[];
  suggestion: string;
}

// ──── JD (Job Description) ────

export interface JD {
  id: string;
  content: string;
  company?: string;
  position?: string;
  createdAt: number;
  analysis?: JDAnalysis;
}

export interface JDAnalysis {
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  interviewFocus: string[];
  matchScore: number;
  matchAnalysis: string;
}

// ──── 面试题 (Question) ────

export interface Question {
  id: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  content: string;
  expectedAnswer: string;
  tips: string[];
  source?: string;
  tags: string[];
  /** 关联的简历分析重点 */
  relatedWeakness?: string;
}

export type QuestionCategory =
  | "vue"
  | "react"
  | "javascript"
  | "css"
  | "browser"
  | "engineering"
  | "ai"
  | "system-design"
  | "project"
  | "hr";

export type QuestionDifficulty = "junior" | "mid" | "senior";

// ──── 模拟面试 (InterviewSession) ────

export interface InterviewSession {
  id: string;
  status: InterviewStatus;
  resumeId?: string;
  jdId?: string;
  jdContent?: string;
  mode: InterviewMode;
  difficulty: QuestionDifficulty;
  duration: number;
  messages: InterviewMessage[];
  currentPhase: InterviewPhase;
  score?: InterviewScore;
  createdAt: number;
  completedAt?: number;
}

export type InterviewStatus =
  | "preparing"
  | "in-progress"
  | "completed"
  | "cancelled";

export type InterviewMode = "tech" | "hr" | "mixed";

export type InterviewPhase =
  | "self-intro"
  | "project-deep-dive"
  | "fundamentals"
  | "system-design"
  | "qa"
  | "completed";

export interface InterviewMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  type: "question" | "answer" | "feedback" | "system";
  phase?: InterviewPhase;
  score?: number;
  evaluation?: string;
  timestamp: number;
}

// ──── 面试评分 (InterviewScore) ────

export interface InterviewScore {
  overall: number;
  dimensions: ScoreDimensions;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  questionScores: QuestionScoreItem[];
  expressionIssues?: ExpressionFeedback;
}

export interface ScoreDimensions {
  fundamentals: number;
  projectDepth: number;
  systemDesign: number;
  expression: number;
  aiCapability: number;
}

export interface QuestionScoreItem {
  questionIndex: number;
  score: number;
  comment: string;
  goodPoint: string;
  badPoint: string;
  sampleAnswer: string;
}

export interface ExpressionFeedback {
  fillerWords: string[];
  tensionLevel: "calm" | "moderate" | "nervous";
  advice: string;
}

// ──── 面试复盘 (InterviewReview) ────

export interface InterviewReview {
  id: string;
  company: string;
  position: string;
  date: string;
  result: "pass" | "fail" | "pending";
  source?: string;
  questions: ReviewQuestion[];
  weaknessTags: string[];
  summary?: string;
  actionItems?: string[];
  createdAt: number;
}

export interface ReviewQuestion {
  original: string;
  yourAnswer: string;
  score: number;
  correctAnswer: string;
  mistakeType?: MistakeType;
  prepStructure?: PREPStructure;
}

export type MistakeType =
  | "concept-error"
  | "expression"
  | "depth"
  | "structure";

export interface PREPStructure {
  point: string;
  reason: string;
  example: string;
  restate: string;
}

// ──── 错题本 (ErrorBook) ────

export interface ErrorBookEntry {
  id: string;
  questionContent: string;
  correctAnswer: string;
  yourAnswer: string;
  mistakeType: MistakeType;
  company: string;
  tags: string[];
  mastery: 0 | 1 | 2 | 3 | 4 | 5;
  lastReviewedAt?: number;
  reviewCount: number;
  createdAt: number;
}

// ──── 仪表盘统计 (DashboardStats) ────

export interface DashboardStats {
  totalInterviews: number;
  avgScore: number;
  totalQuestions: number;
  errorBookCount: number;
  weakCategories: string[];
  recentSessions: InterviewSession[];
  masteredRate: number;
}

// ──── SSE 事件类型 ────

export interface InterviewSSEChunk {
  type: "chunk";
  content: string;
}

export interface InterviewSSEEvaluation {
  type: "evaluation";
  score: number;
  comment: string;
}

export interface InterviewSSEPhase {
  type: "phase-change";
  phase: InterviewPhase;
}

export interface InterviewSSEDone {
  type: "done";
  sessionId: string;
}

export interface InterviewSSEError {
  type: "error";
  error: string;
}

export type InterviewSSEEvent =
  | InterviewSSEChunk
  | InterviewSSEEvaluation
  | InterviewSSEPhase
  | InterviewSSEDone
  | InterviewSSEError;
