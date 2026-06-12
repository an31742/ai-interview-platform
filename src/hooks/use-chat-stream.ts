"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/chat-store";

/**
 * SSE 流式接收 Hook
 *
 * 监听 chat:send 自定义事件，发起 SSE 请求并逐步更新 store
 *
 * 职责：
 * 1. 监听事件 → 发起 fetch POST /api/chat
 * 2. 读取 ReadableStream → 逐块解析 SSE
 * 3. 解析 chunk/done/error 事件 → 更新 store
 *
 * 注意：实际 API 路由在第四/五步实现，此处已完成完整逻辑
 */
export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = async (event: Event) => {
      const { conversationId, messages } = (event as CustomEvent).detail;

      // 取消之前的请求
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      const store = useChatStore.getState();
      store.setStreamStatus("streaming");
      store.clearStreamingMessage();
      store.setError(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
            conversationId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `请求失败: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("响应流不可用");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // 按行解析 SSE 事件
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // 保留未完成的行

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "chunk") {
                  store.updateStreamingMessage(parsed.content);
                } else if (parsed.type === "done") {
                  // 从 streamingMessage 获取完整内容
                  const fullContent = useChatStore.getState().streamingMessage;
                  store.addMessage({
                    role: "assistant",
                    content: fullContent,
                  });
                  store.clearStreamingMessage();
                  store.setStreamStatus("idle");
                  if (parsed.usage) {
                    store.updateTokenUsage(parsed.usage);
                  }
                } else if (parsed.type === "error") {
                  store.setError(parsed.error);
                  store.setStreamStatus("error");
                }
              } catch {
                // JSON 解析失败，忽略该行
              }
            }
          }
        }

        // 流正常结束但没收到 done 事件（兜底）
        const currentStatus = useChatStore.getState().streamStatus;
        if (currentStatus === "streaming") {
          const fullContent = useChatStore.getState().streamingMessage;
          if (fullContent) {
            store.addMessage({
              role: "assistant",
              content: fullContent,
            });
          }
          store.clearStreamingMessage();
          store.setStreamStatus("idle");
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "未知错误";
        store.setError(message);
        store.setStreamStatus("error");
      }
    };

    window.addEventListener("chat:send", handler);
    return () => window.removeEventListener("chat:send", handler);
  }, []);
}
