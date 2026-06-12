import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Message, StreamStatus, TokenUsage } from "@/types/chat";
import { v4Id, getCurrentTimestamp } from "@/lib/utils";

// ============================================
// 聊天状态管理 (Zustand + persist)
// ============================================

interface ChatState {
  /** 所有会话列表 */
  conversations: Conversation[];
  /** 当前会话 ID */
  currentConversationId: string | null;
  /** 流式状态 */
  streamStatus: StreamStatus;
  /** 正在流式接收的消息内容 */
  streamingMessage: string;
  /** 错误信息 */
  error: string | null;
  /** persist 是否已完成恢复（hydration） */
  _hydrated: boolean;

  // === Actions ===

  /** 新建会话，返回会话 ID */
  addConversation: () => string;
  /** 删除指定会话 */
  deleteConversation: (id: string) => void;
  /** 切换到指定会话 */
  selectConversation: (id: string) => void;
  /** 添加消息到当前会话 */
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  /** 追加流式内容 */
  updateStreamingMessage: (chunk: string) => void;
  /** 设置流状态 */
  setStreamStatus: (status: StreamStatus) => void;
  /** 清空流式消息 */
  clearStreamingMessage: () => void;
  /** 更新 Token 统计数据 */
  updateTokenUsage: (usage: TokenUsage) => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 获取当前会话 */
  getCurrentConversation: () => Conversation | undefined;
  /** 更新会话标题 */
  updateConversationTitle: (id: string, title: string) => void;
  /** 标记 hydration 完成 */
  _setHydrated: (v: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // === 初始状态 ===
      conversations: [],
      currentConversationId: null,
      streamStatus: "idle",
      streamingMessage: "",
      error: null,
      _hydrated: false,

      // === Actions ===

      addConversation: () => {
        const id = v4Id();
        const now = getCurrentTimestamp();
        const conversation: Conversation = {
          id,
          title: "新对话",
          messages: [],
          createdAt: now,
          updatedAt: now,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };

        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: id,
        }));

        return id;
      },

      deleteConversation: (id: string) => {
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          // 如果删除的是当前会话，切换到最近的会话或 null
          const newCurrentId =
            state.currentConversationId === id
              ? filtered[0]?.id ?? null
              : state.currentConversationId;

          return {
            conversations: filtered,
            currentConversationId: newCurrentId,
          };
        });
      },

      selectConversation: (id: string) => {
        set({ currentConversationId: id, error: null });
      },

      addMessage: (messageInput) => {
        const { currentConversationId, conversations } = get();
        if (!currentConversationId) return;

        const message: Message = {
          id: v4Id(),
          ...messageInput,
          timestamp: getCurrentTimestamp(),
        };

        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  updatedAt: getCurrentTimestamp(),
                  // 用第一条用户消息自动生成标题
                  title:
                    conv.title === "新对话" && messageInput.role === "user"
                      ? messageInput.content.slice(0, 30) +
                        (messageInput.content.length > 30 ? "..." : "")
                      : conv.title,
                }
              : conv
          ),
        }));
      },

      updateStreamingMessage: (chunk: string) => {
        set((state) => ({
          streamingMessage: state.streamingMessage + chunk,
        }));
      },

      setStreamStatus: (status: StreamStatus) => {
        set({ streamStatus: status });
      },

      clearStreamingMessage: () => {
        set({ streamingMessage: "" });
      },

      updateTokenUsage: (usage: TokenUsage) => {
        const { currentConversationId } = get();
        if (!currentConversationId) return;

        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  tokenUsage: {
                    promptTokens: conv.tokenUsage.promptTokens + usage.promptTokens,
                    completionTokens:
                      conv.tokenUsage.completionTokens + usage.completionTokens,
                    totalTokens: conv.tokenUsage.totalTokens + usage.totalTokens,
                  },
                }
              : conv
          ),
        }));
      },

      setError: (error: string | null) => {
        set({ error });
      },

      getCurrentConversation: () => {
        const { conversations, currentConversationId } = get();
        return conversations.find((c) => c.id === currentConversationId);
      },

      updateConversationTitle: (id: string, title: string) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, title } : conv
          ),
        }));
      },

      _setHydrated: (v: boolean) => {
        set({ _hydrated: v });
      },
    }),
    {
      name: "ai-chat-storage", // localStorage key
      // 订阅 persist 恢复完成事件
      onRehydrateStorage: () => {
        return (state) => {
          if (state) state._setHydrated(true);
        };
      },
      partialize: (state) => ({
        // 只持久化会话数据，不持久化运行时状态
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
