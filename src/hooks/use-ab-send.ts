"use client";

import { useCallback, useRef } from "react";
import { usePlaygroundStore } from "@/store/playground-store";
import { buildPromptContent } from "./use-playground-send";

/**
 * A/B 测试发送 Hook
 *
 * 将同一个 Prompt 同时发送到两个不同配置的模型
 * 用于对比不同参数下的输出效果
 */
export function useABSend() {
  const abortRefA = useRef<AbortController | null>(null);
  const abortRefB = useRef<AbortController | null>(null);

  /**
   * 发送单个请求（供 A/B 各调用一次）
   */
  const sendOne = useCallback(
    async (
      config: { model: string; temperature: number; maxTokens: number; topP: number },
      onChunk: (chunk: string) => void,
      onDone: () => void,
      onError: (msg: string) => void,
      signal: AbortSignal
    ) => {
      const store = usePlaygroundStore.getState();
      const promptContent = buildPromptContent(store.promptType, store.variables);

      if (!promptContent.trim()) {
        onError("请输入 Prompt 内容");
        return;
      }

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content: `你是一个AI助手。当前配置: temperature=${config.temperature}, max_tokens=${config.maxTokens}, top_p=${config.topP}`,
              },
              { role: "user", content: promptContent },
            ],
            model: config.model,
          }),
          signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `请求失败: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("响应流不可用");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "chunk") {
                  onChunk(data.content);
                } else if (data.type === "done" || data.type === "error") {
                  onDone();
                }
              } catch {
                // skip
              }
            }
          }
        }

        onDone();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        onError(err instanceof Error ? err.message : "请求失败");
      }
    },
    []
  );

  const sendAB = useCallback(async () => {
    const store = usePlaygroundStore.getState();

    // 取消之前的请求
    abortRefA.current?.abort();
    abortRefB.current?.abort();

    const controllerA = new AbortController();
    const controllerB = new AbortController();
    abortRefA.current = controllerA;
    abortRefB.current = controllerB;

    // 重置
    store.clearABResponses();
    store.setABStreamingA(true);
    store.setABStreamingB(true);

    // 并发发送两个请求
    await Promise.all([
      sendOne(
        store.abConfigA,
        (chunk) => usePlaygroundStore.getState().appendABResponseA(chunk),
        () => usePlaygroundStore.getState().setABStreamingA(false),
        (msg) => {
          usePlaygroundStore.getState().appendABResponseA(`\n\n**错误:** ${msg}`);
          usePlaygroundStore.getState().setABStreamingA(false);
        },
        controllerA.signal
      ),
      sendOne(
        store.abConfigB,
        (chunk) => usePlaygroundStore.getState().appendABResponseB(chunk),
        () => usePlaygroundStore.getState().setABStreamingB(false),
        (msg) => {
          usePlaygroundStore.getState().appendABResponseB(`\n\n**错误:** ${msg}`);
          usePlaygroundStore.getState().setABStreamingB(false);
        },
        controllerB.signal
      ),
    ]);
  }, [sendOne]);

  return sendAB;
}
