"use client";

import { AgentChat } from "@/components/agent/agent-chat";

/**
 * Agent 主页面
 *
 * 基于 Function Calling 的智能助手
 */
export default function AgentPage() {
  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col min-w-0">
        <AgentChat />
      </div>
    </div>
  );
}
