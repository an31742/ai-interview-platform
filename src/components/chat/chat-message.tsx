"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./markdown-renderer";
import { Bot, User } from "lucide-react";
import type { MessageRole } from "@/types/chat";

/**
 * 单条消息组件（React.memo 优化）
 *
 * ⚡ 优化说明：
 * React.memo 通过浅比较 props 来跳过不必要的重渲染。
 * 在流式场景中，只有最新的流式消息在变化，历史消息不会重渲染。
 * 用户消息 content 用一次后就不变了，效率最高。
 *
 * Props:
 * - role: 消息角色（user | assistant）
 * - content: 消息内容（纯文本）
 * - isStreaming: 是否为流式输出中
 */
export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  isStreaming = false,
}: {
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex w-full gap-3 px-4 py-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* 助手头像 */}
      {isAssistant && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
        </div>
      )}

      {/* 消息气泡 */}
      <div
        className={cn(
          "max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/50 text-foreground rounded-bl-md"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {content}
          </p>
        ) : content ? (
          <div className="min-w-0">
            <MarkdownRenderer content={content} />
            {/* 闪烁光标：表示正在输出 */}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          /* 初始加载状态：三个跳动点 */
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {/* 用户头像 */}
      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <User className="h-5 w-5" />
          </div>
        </div>
      )}
    </div>
  );
});
