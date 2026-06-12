"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import { ArrowUp, StopCircle } from "lucide-react";

/**
 * 聊天输入框组件
 *
 * 职责:
 * 1. 文本输入 + 发送
 * 2. Enter 快捷发送 (Shift+Enter 换行)
 * 3. 流式输出时切换为停止按钮
 * 4. 空内容禁用发送
 */
export function ChatInput() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streamStatus = useChatStore((s) => s.streamStatus);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const addConversation = useChatStore((s) => s.addConversation);
  const addMessage = useChatStore((s) => s.addMessage);
  const selectConversation = useChatStore((s) => s.selectConversation);

  const isStreaming = streamStatus === "streaming";
  const canSend = input.trim().length > 0 && !isStreaming;

  // 自动调整 textarea 高度
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // 聚焦输入框
  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentConversationId]);

  // 发送消息
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput("");

    // 确保有当前会话
    let convId = currentConversationId;
    if (!convId) {
      convId = addConversation();
    }

    // 添加用户消息
    addMessage({ role: "user", content });

    // 获取完整消息历史
    const state = useChatStore.getState();
    const conversation = state.conversations.find((c) => c.id === convId);
    if (!conversation) return;

    // 开始流式请求 (实际 API 调用在后续步骤实现)
    // 此处触发 SSE 请求，由 useChatStream hook 处理
    window.dispatchEvent(
      new CustomEvent("chat:send", {
        detail: {
          conversationId: convId,
          messages: conversation.messages,
        },
      })
    );
  }, [input, isStreaming, currentConversationId, addConversation, addMessage]);

  // 键盘事件: Enter 发送, Shift+Enter 换行
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t bg-background">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="relative flex items-end gap-2 rounded-2xl border bg-muted/30 px-4 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px]"
          />

          {/* 发送 / 停止按钮 */}
          <button
            onClick={isStreaming ? () => {} : handleSend}
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 rounded-full p-2 transition-colors",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label={isStreaming ? "停止" : "发送"}
          >
            {isStreaming ? (
              <StopCircle className="h-5 w-5" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* 底部提示 */}
        <p className="mt-1 text-center text-[10px] text-muted-foreground/50">
          AI 回复仅供参考，请验证重要信息
        </p>
      </div>
    </div>
  );
}

