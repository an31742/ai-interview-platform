"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useChatStore } from "@/store/chat-store";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { Sidebar } from "@/components/chat/sidebar";
import { AlertCircle } from "lucide-react";

/**
 * 会话页面
 *
 * URL: /chat/c/[id]
 * - id = "new": 创建一个新会话后跳转
 * - id = UUID: 加载已有会话
 *
 * 设计要点：
 * 1. URL 即状态 — 会话 ID 在 URL 中，支持刷新和分享
 * 2. 等待 hydration 完成后再处理 URL，避免空数据覆盖
 * 3. 初始化 SSE 流式 hook
 */
export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  const initializedRef = useRef(false);

  const conversations = useChatStore((s) => s.conversations);
  const error = useChatStore((s) => s.error);
  const hydrated = useChatStore((s) => s._hydrated);
  const addConversation = useChatStore((s) => s.addConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);

  // 初始化 SSE 流式 hook（只挂一次）
  useChatStream();

  // URL 驱动：等待 hydration 完成后处理会话选择
  useEffect(() => {
    // 等待 persist 从 localStorage 恢复数据
    if (!hydrated) return;

    // 只执行一次
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (id === "new") {
      // 创建新会话并替换 URL
      const newId = addConversation();
      window.history.replaceState(null, "", `/chat/c/${newId}`);
    } else {
      // 查找已有会话
      const exists = conversations.some((c) => c.id === id);
      if (exists) {
        selectConversation(id);
      } else {
        // URL 的会话不存在（可能被删除），创建新的
        const newId = addConversation();
        window.history.replaceState(null, "", `/chat/c/${newId}`);
      }
    }
  }, [hydrated, id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-dvh w-full">
      {/* 侧边栏（桌面端固定显示） */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* 错误提示栏 */}
        {error && (
          <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => useChatStore.getState().setError(null)}
              className="text-xs underline hover:no-underline"
            >
              关闭
            </button>
          </div>
        )}

        {/* 消息列表 */}
        <ChatMessages />

        {/* 输入区域 */}
        <ChatInput />
      </div>
    </div>
  );
}
