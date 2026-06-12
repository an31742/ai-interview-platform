"use client";

import { MessageSquare } from "lucide-react";

/**
 * 空状态 - 新对话欢迎页
 *
 * 当会话没有消息时显示，引导用户开始对话
 */
export function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto max-w-md text-center px-4">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-semibold">AI Chat</h1>
        <p className="mb-6 text-muted-foreground">
          基于 DeepSeek API 构建的智能聊天助手
        </p>
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <div className="rounded-lg border bg-card p-3">
            💡 在下方输入消息开始对话
          </div>
          <div className="rounded-lg border bg-card p-3">
            📝 支持 Markdown 格式和代码高亮
          </div>
          <div className="rounded-lg border bg-card p-3">
            🔄 支持多会话管理和历史记录
          </div>
        </div>
      </div>
    </div>
  );
}
