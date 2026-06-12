/**
 * /chat 首页 - 空状态欢迎页
 * 用户没有选择任何会话时显示
 */

import Link from "next/link";

export default function ChatPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold">欢迎使用 AI Chat</h1>
        <p className="mb-6 text-muted-foreground">
          基于 DeepSeek API 构建的智能聊天助手
        </p>
        <Link
          href="/chat/c/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          开始新对话
        </Link>
      </div>
    </div>
  );
}
