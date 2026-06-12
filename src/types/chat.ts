// ============================================
// 聊天应用类型定义
// ============================================

/** 消息角色 */
export type MessageRole = "user" | "assistant" | "system";

/** Token 使用统计 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 单条消息 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** 会话 */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  tokenUsage: TokenUsage;
}

/** 流式状态 */
export type StreamStatus = "idle" | "streaming" | "error";

/** SSE 事件类型 */
export interface SSEChunkEvent {
  type: "chunk";
  content: string;
}

export interface SSEDoneEvent {
  type: "done";
  usage: TokenUsage;
}

export interface SSEErrorEvent {
  type: "error";
  error: string;
}

export type SSEEvent = SSEChunkEvent | SSEDoneEvent | SSEErrorEvent;
