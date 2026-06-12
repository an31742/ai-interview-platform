import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4Id } from "@/lib/utils";
import type {
  PromptType,
  PromptVariables,
  ModelConfig,
  RunRecord,
  TokenUsage,
  SavedTemplate,
} from "@/types/playground";
import { DEFAULT_MODEL_CONFIG, DEFAULT_VARIABLES } from "@/types/playground";

// ============================================
// Playground 状态管理
// ============================================

interface PlaygroundState {
  // === Prompt 编辑 ===
  promptType: PromptType;
  variables: PromptVariables;

  // === 模型配置 ===
  modelConfig: ModelConfig;

  // === 输出 ===
  response: string;
  isStreaming: boolean;
  error: string | null;

  // === 历史 ===
  history: RunRecord[];

  // === 模板保存 ===
  savedTemplates: SavedTemplate[];

  // === A/B 测试 ===
  abTestMode: boolean;
  abConfigA: ModelConfig;
  abConfigB: ModelConfig;
  abResponseA: string;
  abResponseB: string;
  abStreamingA: boolean;
  abStreamingB: boolean;

  // === Actions: Prompt ===
  setPromptType: (type: PromptType) => void;
  updateVariable: (key: keyof PromptVariables, value: string) => void;
  resetVariables: () => void;
  loadVariables: (variables: PromptVariables, type: PromptType) => void;

  // === Actions: Config ===
  setModelConfig: (config: Partial<ModelConfig>) => void;
  setABConfigA: (config: Partial<ModelConfig>) => void;
  setABConfigB: (config: Partial<ModelConfig>) => void;

  // === Actions: Output ===
  setResponse: (response: string) => void;
  appendResponse: (chunk: string) => void;
  clearResponse: () => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;

  // === Actions: AB Test ===
  toggleABTest: () => void;
  setABResponseA: (response: string) => void;
  appendABResponseA: (chunk: string) => void;
  setABResponseB: (response: string) => void;
  appendABResponseB: (chunk: string) => void;
  clearABResponses: () => void;
  setABStreamingA: (v: boolean) => void;
  setABStreamingB: (v: boolean) => void;

  // === Actions: History ===
  saveToHistory: (
    promptContent: string,
    usage: TokenUsage,
    duration: number
  ) => void;
  clearHistory: () => void;

  // === Actions: Templates ===
  saveTemplate: (name: string) => void;
  loadTemplate: (template: SavedTemplate) => void;
  deleteTemplate: (id: string) => void;
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set, get) => ({
      // === 初始状态 ===
      promptType: "plain",
      variables: { ...DEFAULT_VARIABLES },
      modelConfig: { ...DEFAULT_MODEL_CONFIG },
      response: "",
      isStreaming: false,
      error: null,
      history: [],
      savedTemplates: [],

      // === AB Test 初始状态 ===
      abTestMode: false,
      abConfigA: { ...DEFAULT_MODEL_CONFIG, temperature: 0.1 },
      abConfigB: { ...DEFAULT_MODEL_CONFIG, temperature: 0.9 },
      abResponseA: "",
      abResponseB: "",
      abStreamingA: false,
      abStreamingB: false,

      // === Actions: Prompt ===
      setPromptType: (type: PromptType) => {
        set({ promptType: type });
      },

      updateVariable: (key: keyof PromptVariables, value: string) => {
        set((state) => ({
          variables: { ...state.variables, [key]: value },
        }));
      },

      resetVariables: () => {
        set({ variables: { ...DEFAULT_VARIABLES } });
      },

      loadVariables: (variables: PromptVariables, type: PromptType) => {
        set({
          variables: { ...variables },
          promptType: type,
        });
      },

      // === Actions: Config ===
      setModelConfig: (config: Partial<ModelConfig>) => {
        set((state) => ({
          modelConfig: { ...state.modelConfig, ...config },
        }));
      },

      setABConfigA: (config: Partial<ModelConfig>) => {
        set((state) => ({
          abConfigA: { ...state.abConfigA, ...config },
        }));
      },

      setABConfigB: (config: Partial<ModelConfig>) => {
        set((state) => ({
          abConfigB: { ...state.abConfigB, ...config },
        }));
      },

      // === Actions: Output ===
      setResponse: (response: string) => {
        set({ response });
      },

      appendResponse: (chunk: string) => {
        set((state) => ({
          response: state.response + chunk,
        }));
      },

      clearResponse: () => {
        set({ response: "" });
      },

      setStreaming: (streaming: boolean) => {
        set({ isStreaming: streaming });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      // === Actions: AB Test ===
      toggleABTest: () => {
        set((state) => {
          const newMode = !state.abTestMode;
          return {
            abTestMode: newMode,
            abResponseA: "",
            abResponseB: "",
            abStreamingA: false,
            abStreamingB: false,
          };
        });
      },

      setABResponseA: (response: string) => {
        set({ abResponseA: response });
      },

      appendABResponseA: (chunk: string) => {
        set((state) => ({
          abResponseA: state.abResponseA + chunk,
        }));
      },

      setABResponseB: (response: string) => {
        set({ abResponseB: response });
      },

      appendABResponseB: (chunk: string) => {
        set((state) => ({
          abResponseB: state.abResponseB + chunk,
        }));
      },

      clearABResponses: () => {
        set({ abResponseA: "", abResponseB: "" });
      },

      setABStreamingA: (v: boolean) => {
        set({ abStreamingA: v });
      },

      setABStreamingB: (v: boolean) => {
        set({ abStreamingB: v });
      },

      // === Actions: History ===
      saveToHistory: (
        promptContent: string,
        usage: TokenUsage,
        duration: number
      ) => {
        const state = get();
        const record: RunRecord = {
          id: v4Id(),
          promptType: state.promptType,
          promptContent,
          modelConfig: { ...state.modelConfig },
          response: state.response,
          tokenUsage: usage,
          timestamp: Date.now(),
          duration,
        };

        set((s) => ({
          history: [record, ...s.history].slice(0, 50),
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },

      // === Actions: Templates ===
      saveTemplate: (name: string) => {
        const state = get();
        const template: SavedTemplate = {
          id: v4Id(),
          name,
          promptType: state.promptType,
          variables: { ...state.variables },
          modelConfig: { ...state.modelConfig },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((s) => ({
          savedTemplates: [template, ...s.savedTemplates],
        }));
      },

      loadTemplate: (template: SavedTemplate) => {
        set({
          promptType: template.promptType,
          variables: { ...template.variables },
          modelConfig: { ...template.modelConfig },
        });
      },

      deleteTemplate: (id: string) => {
        set((state) => ({
          savedTemplates: state.savedTemplates.filter((t) => t.id !== id),
        }));
      },
    }),
    {
      name: "playground-storage",
      partialize: (state) => ({
        // 只持久化模板和历史，不持久化运行时状态
        savedTemplates: state.savedTemplates,
        history: state.history,
      }),
    }
  )
);
