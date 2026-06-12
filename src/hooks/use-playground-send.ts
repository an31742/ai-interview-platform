"use client";

import { useCallback, useRef } from "react";
import { usePlaygroundStore } from "@/store/playground-store";
import type { PromptType, PromptVariables } from "@/types/playground";

/**
 * Playground 发送请求 Hook
 *
 * 根据当前 Prompt 类型和变量值组装完整 prompt，
 * 调用 POST /api/chat 并处理 SSE 流式响应
 */
export function usePlaygroundSend() {
  const abortRef = useRef<AbortController | null>(null);

  const sendRequest = useCallback(async () => {
    const store = usePlaygroundStore.getState();

    // 取消之前的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 清空上一次的响应
    store.clearResponse();
    store.setStreaming(true);
    store.setError(null);

    // 组装完整 prompt
    const promptContent = buildPromptContent(
      store.promptType,
      store.variables
    );

    if (!promptContent.trim()) {
      store.setError("请输入 Prompt 内容");
      store.setStreaming(false);
      return;
    }

    const startTime = Date.now();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: promptContent }],
        }),
        signal: controller.signal,
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
                store.appendResponse(data.content);
              } else if (data.type === "done") {
                store.setStreaming(false);
                // 保存到历史
                const duration = Date.now() - startTime;
                store.saveToHistory(
                  promptContent,
                  data.usage || {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                  },
                  duration
                );
              } else if (data.type === "error") {
                store.setError(data.error);
                store.setStreaming(false);
              }
            } catch {
              // JSON 解析失败，跳过
            }
          }
        }
      }

      // 兜底：流正常结束但没收到 done
      if (usePlaygroundStore.getState().isStreaming) {
        const duration = Date.now() - startTime;
        store.saveToHistory(promptContent, { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, duration);
        store.setStreaming(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "未知错误";
      store.setError(msg);
      store.setStreaming(false);
    }
  }, []);

  return sendRequest;
}

/**
 * 根据 Prompt 类型和变量值组装完整 prompt
 */
export function buildPromptContent(
  type: PromptType,
  vars: PromptVariables
): string {
  switch (type) {
    case "plain":
      return vars.userInput ?? "";

    case "role": {
      const parts: string[] = [];
      if (vars.role) parts.push(`你是一名${vars.role}。`);
      if (vars.task) parts.push(`请完成以下任务：\n${vars.task}`);
      if (vars.additionalContext) parts.push(vars.additionalContext);
      return parts.join("\n\n");
    }

    case "few-shot": {
      const parts: string[] = [];
      if (vars.examples) {
        parts.push("以下是一些示例：\n");
        parts.push(vars.examples);
      }
      if (vars.fewShotInput) {
        parts.push(`\n现在请处理以下输入：\n${vars.fewShotInput}`);
      }
      if (vars.additionalContext) parts.push(`\n${vars.additionalContext}`);
      return parts.join("\n");
    }

    case "cot": {
      const parts: string[] = [];
      if (vars.question) parts.push(`问题：${vars.question}`);
      parts.push("\n让我们一步一步思考：");
      parts.push(vars.steps || "请逐步分析并给出最终答案。");
      if (vars.additionalContext) parts.push(`\n${vars.additionalContext}`);
      parts.push("\n请逐步推理并给出最终答案。");
      return parts.join("\n");
    }

    default:
      return "";
  }
}
