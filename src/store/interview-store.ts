import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Resume,
  JD,
  InterviewSession,
  InterviewReview,
  ErrorBookEntry,
  DashboardStats,
  InterviewMessage,
  InterviewScore,
  InterviewPhase,
  InterviewStatus,
} from "@/types/interview";
import { v4Id, getCurrentTimestamp } from "@/lib/utils";

// ============================================
// 面试平台状态管理 (Zustand + persist)
// ============================================

interface InterviewState {
  // ── 简历 ──
  resumes: Resume[];
  currentResumeId: string | null;

  // ── JD ──
  jds: JD[];

  // ── 面试会话 ──
  sessions: InterviewSession[];
  currentSessionId: string | null;

  // ── 流式状态 ──
  streamStatus: "idle" | "streaming" | "error";
  streamingContent: string;
  pendingEvaluation: { score: number; comment: string } | null;

  // ── 复盘 ──
  reviews: InterviewReview[];

  // ── 错题本 ──
  errorBook: ErrorBookEntry[];

  // ── 仪表盘 ──
  stats: DashboardStats;

  // ── Hydration ──
  _hydrated: boolean;

  // ========== Actions ==========

  // 简历操作
  addResume: (resume: Omit<Resume, "id" | "uploadTime">) => string;
  updateResume: (id: string, data: Partial<Resume>) => void;
  deleteResume: (id: string) => void;
  selectResume: (id: string | null) => void;
  getResumeById: (id: string) => Resume | undefined;

  // JD 操作
  addJD: (jd: Omit<JD, "id" | "createdAt">) => string;
  updateJD: (id: string, data: Partial<JD>) => void;
  deleteJD: (id: string) => void;

  // 面试会话操作
  createSession: (config: {
    resumeId?: string;
    jdContent?: string;
    mode: "tech" | "hr" | "mixed";
    difficulty: "junior" | "mid" | "senior";
    duration: number;
  }) => string;
  updateSession: (id: string, data: Partial<InterviewSession>) => void;
  selectSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: Omit<InterviewMessage, "id" | "timestamp">) => void;
  setSessionPhase: (sessionId: string, phase: InterviewPhase) => void;
  completeSession: (sessionId: string, score: InterviewScore) => void;
  getSessionById: (id: string) => InterviewSession | undefined;

  // 流式操作
  setStreamStatus: (status: "idle" | "streaming" | "error") => void;
  appendStreamContent: (chunk: string) => void;
  clearStreamContent: () => void;
  setPendingEvaluation: (evaluation: { score: number; comment: string } | null) => void;

  // 复盘操作
  addReview: (review: Omit<InterviewReview, "id" | "createdAt">) => string;
  deleteReview: (id: string) => void;

  // 错题本操作
  addErrorEntry: (entry: Omit<ErrorBookEntry, "id" | "createdAt">) => string;
  updateErrorEntry: (id: string, data: Partial<ErrorBookEntry>) => void;
  deleteErrorEntry: (id: string) => void;

  // 仪表盘
  refreshStats: () => void;

  // Hydration
  _setHydrated: (v: boolean) => void;
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      resumes: [],
      currentResumeId: null,
      jds: [],
      sessions: [],
      currentSessionId: null,
      streamStatus: "idle",
      streamingContent: "",
      pendingEvaluation: null,
      reviews: [],
      errorBook: [],
      stats: {
        totalInterviews: 0,
        avgScore: 0,
        totalQuestions: 0,
        errorBookCount: 0,
        weakCategories: [],
        recentSessions: [],
        masteredRate: 0,
      },
      _hydrated: false,

      // ========== 简历操作 ==========

      addResume: (resumeData) => {
        const id = v4Id();
        const resume: Resume = {
          ...resumeData,
          id,
          uploadTime: getCurrentTimestamp(),
        };
        set((state) => ({
          resumes: [resume, ...state.resumes],
          currentResumeId: id,
        }));
        return id;
      },

      updateResume: (id, data) => {
        set((state) => ({
          resumes: state.resumes.map((r) =>
            r.id === id ? { ...r, ...data } : r
          ),
        }));
      },

      deleteResume: (id) => {
        set((state) => {
          const filtered = state.resumes.filter((r) => r.id !== id);
          return {
            resumes: filtered,
            currentResumeId:
              state.currentResumeId === id
                ? filtered[0]?.id ?? null
                : state.currentResumeId,
          };
        });
      },

      selectResume: (id) => set({ currentResumeId: id }),

      getResumeById: (id) => get().resumes.find((r) => r.id === id),

      // ========== JD 操作 ==========

      addJD: (jdData) => {
        const id = v4Id();
        const jd: JD = { ...jdData, id, createdAt: getCurrentTimestamp() };
        set((state) => ({ jds: [jd, ...state.jds] }));
        return id;
      },

      updateJD: (id, data) => {
        set((state) => ({
          jds: state.jds.map((j) => (j.id === id ? { ...j, ...data } : j)),
        }));
      },

      deleteJD: (id) => {
        set((state) => ({ jds: state.jds.filter((j) => j.id !== id) }));
      },

      // ========== 面试会话 ==========

      createSession: (config) => {
        const id = v4Id();
        const session: InterviewSession = {
          id,
          status: "preparing",
          ...config,
          messages: [],
          currentPhase: "self-intro",
          createdAt: getCurrentTimestamp(),
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: id,
        }));
        return id;
      },

      updateSession: (id, data) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...data } : s
          ),
        }));
      },

      selectSession: (id) => set({ currentSessionId: id }),

      addMessage: (sessionId, message) => {
        const newMessage: InterviewMessage = {
          id: v4Id(),
          ...message,
          timestamp: getCurrentTimestamp(),
        };
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, newMessage] }
              : s
          ),
        }));
      },

      setSessionPhase: (sessionId, phase) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, currentPhase: phase } : s
          ),
        }));
      },

      completeSession: (sessionId, score) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  status: "completed" as InterviewStatus,
                  score,
                  completedAt: getCurrentTimestamp(),
                }
              : s
          ),
        }));
      },

      getSessionById: (id) => get().sessions.find((s) => s.id === id),

      // ========== 流式操作 ==========

      setStreamStatus: (status) => set({ streamStatus: status }),

      appendStreamContent: (chunk) => {
        set((state) => ({
          streamingContent: state.streamingContent + chunk,
        }));
      },

      clearStreamContent: () => set({ streamingContent: "" }),

      setPendingEvaluation: (evaluation) => set({ pendingEvaluation: evaluation }),

      // ========== 复盘操作 ==========

      addReview: (reviewData) => {
        const id = v4Id();
        const review: InterviewReview = {
          ...reviewData,
          id,
          createdAt: getCurrentTimestamp(),
        };
        set((state) => ({ reviews: [review, ...state.reviews] }));
        return id;
      },

      deleteReview: (id) => {
        set((state) => ({ reviews: state.reviews.filter((r) => r.id !== id) }));
      },

      // ========== 错题本 ==========

      addErrorEntry: (entryData) => {
        const id = v4Id();
        const entry: ErrorBookEntry = {
          ...entryData,
          id,
          createdAt: getCurrentTimestamp(),
        };
        set((state) => ({ errorBook: [entry, ...state.errorBook] }));
        return id;
      },

      updateErrorEntry: (id, data) => {
        set((state) => ({
          errorBook: state.errorBook.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        }));
      },

      deleteErrorEntry: (id) => {
        set((state) => ({
          errorBook: state.errorBook.filter((e) => e.id !== id),
        }));
      },

      // ========== 仪表盘 ==========

      refreshStats: () => {
        const state = get();
        const completed = state.sessions.filter(
          (s) => s.status === "completed" && s.score
        );
        const totalInterviews = completed.length;
        const avgScore =
          totalInterviews > 0
            ? Math.round(
                completed.reduce((sum, s) => sum + (s.score?.overall ?? 0), 0) /
                  totalInterviews
              )
            : 0;

        // 统计最弱的维度
        const dimensionScores: Record<string, number[]> = {
          fundamentals: [],
          projectDepth: [],
          systemDesign: [],
          expression: [],
          aiCapability: [],
        };
        completed.forEach((s) => {
          if (s.score) {
            Object.entries(s.score.dimensions).forEach(([key, val]) => {
              dimensionScores[key]?.push(val);
            });
          }
        });
        const weakCategories = Object.entries(dimensionScores)
          .map(([key, scores]) => ({
            key,
            avg: scores.length > 0
              ? scores.reduce((a, b) => a + b, 0) / scores.length
              : 0,
          }))
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 3)
          .map((item) => item.key);

        const masteredCount = state.errorBook.filter(
          (e) => e.mastery >= 4
        ).length;
        const masteredRate =
          state.errorBook.length > 0
            ? Math.round((masteredCount / state.errorBook.length) * 100)
            : 100;

        set({
          stats: {
            totalInterviews,
            avgScore,
            totalQuestions: completed.reduce(
              (sum, s) => sum + (s.messages?.filter((m) => m.role === "user").length ?? 0),
              0
            ),
            errorBookCount: state.errorBook.length,
            weakCategories,
            recentSessions: state.sessions.slice(0, 5),
            masteredRate,
          },
        });
      },

      // ========== Hydration ==========

      _setHydrated: (v) => set({ _hydrated: v }),
    }),
    {
      name: "ai-interview-storage",
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state._setHydrated(true);
            state.refreshStats();
          }
        };
      },
      partialize: (state) => ({
        resumes: state.resumes,
        currentResumeId: state.currentResumeId,
        jds: state.jds,
        sessions: state.sessions,
        reviews: state.reviews,
        errorBook: state.errorBook,
      }),
    }
  )
);
