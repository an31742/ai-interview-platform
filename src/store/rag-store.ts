/**
 * RAG 知识库状态管理
 */

import { create } from "zustand";
import type { RagDocument, SourceInfo, RagConfig } from "@/types/rag";
import { DEFAULT_RAG_CONFIG } from "@/types/rag";

interface RagState {
  // === 文档管理 ===
  documents: RagDocument[];
  uploading: boolean;

  // === 问答 ===
  question: string;
  answer: string;
  sources: SourceInfo[];
  isQuerying: boolean;
  error: string | null;

  // === 配置 ===
  config: RagConfig;

  // === Actions: 文档 ===
  setDocuments: (docs: RagDocument[]) => void;
  updateDocumentStatus: (id: string, status: RagDocument["status"]) => void;
  setUploading: (v: boolean) => void;
  removeDocument: (id: string) => void;

  // === Actions: 问答 ===
  setQuestion: (q: string) => void;
  appendAnswer: (chunk: string) => void;
  clearAnswer: () => void;
  setSources: (sources: SourceInfo[]) => void;
  setQuerying: (v: boolean) => void;
  setError: (err: string | null) => void;

  // === Actions: 配置 ===
  setConfig: (config: Partial<RagConfig>) => void;
}

export const useRagStore = create<RagState>()((set) => ({
  // 初始状态
  documents: [],
  uploading: false,
  question: "",
  answer: "",
  sources: [],
  isQuerying: false,
  error: null,
  config: { ...DEFAULT_RAG_CONFIG },

  // === Actions: 文档 ===
  setDocuments: (documents) => set({ documents }),

  updateDocumentStatus: (id, status) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, status } : d
      ),
    })),

  setUploading: (uploading) => set({ uploading }),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    })),

  // === Actions: 问答 ===
  setQuestion: (question) => set({ question }),

  appendAnswer: (chunk) =>
    set((state) => ({ answer: state.answer + chunk })),

  clearAnswer: () => set({ answer: "", sources: [] }),

  setSources: (sources) => set({ sources }),

  setQuerying: (isQuerying) => set({ isQuerying }),

  setError: (error) => set({ error }),

  // === Actions: 配置 ===
  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),
}));
