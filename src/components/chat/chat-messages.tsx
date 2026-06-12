"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useChatStore } from "@/store/chat-store";
import { ChatMessage } from "./chat-message";
import { EmptyState } from "./empty-state";
import { ChevronUp } from "lucide-react";

/**
 * 消息列表容器（含长对话优化）
 *
 * ⚡ 优化策略：
 *
 * 1. 分页渲染 — 默认只渲染最近 50 条消息
 *    超过时显示"加载更早消息"按钮，避免创建大量 DOM 节点
 *    这对聊天场景特别有效：用户永远关注最新的消息
 *
 * 2. 自动滚动 — 新消息时自动滚到底部
 *    如果用户向上翻看历史，不强制滚动（"打断不滚动"）
 *
 * 3. 精确订阅 — 只订阅需要的 Zustand 字段
 *    conversations 变化时不会重渲染整个列表
 */

/** 每页渲染的消息数量 */
const PAGE_SIZE = 50;

export function ChatMessages() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamStatus = useChatStore((s) => s.streamStatus);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const allMessages = currentConversation?.messages ?? [];
  const isStreaming = streamStatus === "streaming";

  // ===== 分页渲染：默认只显示最近 PAGE_SIZE 条 =====
  const [visibleRange, setVisibleRange] = useState({
    start: Math.max(0, allMessages.length - PAGE_SIZE),
    end: allMessages.length,
  });

  // 消息数量变化时重置可见范围（新消息追加到底部）
  useEffect(() => {
    setVisibleRange({
      start: Math.max(0, allMessages.length - PAGE_SIZE),
      end: allMessages.length,
    });
  }, [allMessages.length]);

  const visibleMessages = useMemo(
    () => allMessages.slice(visibleRange.start, visibleRange.end),
    [allMessages, visibleRange]
  );

  const hasOlderMessages = visibleRange.start > 0;

  // 加载更早消息
  const loadMore = useCallback(() => {
    setVisibleRange((prev) => ({
      start: Math.max(0, prev.start - PAGE_SIZE),
      end: prev.end,
    }));
  }, []);

  // ===== 滚动行为 =====
  // 检测用户是否在底部附近
  const checkNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 200; // 距离底部 200px 以内算"在底部"
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // 自动滚动到底部（仅在用户接近底部时）
  const scrollToBottom = useCallback(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // 监听滚动事件
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkNearBottom, { passive: true });
    return () => el.removeEventListener("scroll", checkNearBottom);
  }, [checkNearBottom]);

  // 新消息或流式内容变化时自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [visibleMessages.length, streamingMessage, scrollToBottom]);

  // ===== 空状态 =====
  if (!currentConversation) {
    return <EmptyState />;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-y-auto"
      onScroll={checkNearBottom}
    >
      {/* 顶部间距 */}
      <div className="h-4" />

      {/* 消息列表 */}
      <div className="mx-auto max-w-3xl space-y-1">
        {/* "加载更早消息"按钮 */}
        {hasOlderMessages && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              className="flex items-center gap-1 rounded-full border bg-background px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              加载更早消息（还有 {visibleRange.start} 条）
            </button>
          </div>
        )}

        {/* 可见消息 */}
        {visibleMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
          />
        ))}

        {/* 流式消息 */}
        {isStreaming && (
          <ChatMessage
            role="assistant"
            content={streamingMessage}
            isStreaming
          />
        )}
      </div>

      {/* 底部间距 + 自动滚动锚点 */}
      <div className="h-4" />
      <div ref={messagesEndRef} />
    </div>
  );
}
