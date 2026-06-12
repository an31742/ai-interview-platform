"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRagStore } from "@/store/rag-store";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { SourceBadge } from "./source-badge";
import { ArrowUp, Loader2, BookOpen } from "lucide-react";
import type { SourceInfo } from "@/types/rag";

/**
 * RAG 问答界面
 *
 * 与 ChatGPT 风格类似，但多了来源引用展示
 */
export function RagChat() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const answer = useRagStore((s) => s.answer);
  const sources = useRagStore((s) => s.sources);
  const isQuerying = useRagStore((s) => s.isQuerying);
  const hasAnswer = answer.length > 0;

  const setQuestion = useRagStore((s) => s.setQuestion);
  const appendAnswer = useRagStore((s) => s.appendAnswer);
  const clearAnswer = useRagStore((s) => s.clearAnswer);
  const setSources = useRagStore((s) => s.setSources);
  const setQuerying = useRagStore((s) => s.setQuerying);
  const setError = useRagStore((s) => s.setError);

  const abortRef = useRef<AbortController | null>(null);

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  // 自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [answer, sources]);

  // 发送 RAG 查询
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isQuerying) return;

    setInput("");
    setQuestion(content);
    clearAnswer();
    setQuerying(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "查询失败");
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
                appendAnswer(data.content);
              } else if (data.type === "sources") {
                setSources(data.sources);
              } else if (data.type === "error") {
                setError(data.error);
                setQuerying(false);
              } else if (data.type === "done") {
                setQuerying(false);
              }
            } catch {
              // skip
            }
          }
        }
      }

      if (useRagStore.getState().isQuerying) {
        setQuerying(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "查询失败");
      setQuerying(false);
    }
  }, [input, isQuerying, setQuestion, clearAnswer, setQuerying, setError, appendAnswer, setSources]);

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
    <div className="flex flex-1 flex-col min-h-0">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {!hasAnswer && !isQuerying && (
          <div className="flex h-full flex-col items-center justify-center text-center px-8">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-1">RAG 知识库问答</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              上传 PDF 文档后，在这里提问，AI 将基于文档内容为你解答
            </p>
          </div>
        )}

        {hasAnswer && (
          <div className="mx-auto max-w-3xl p-4">
            <div className="rounded-xl border bg-card">
              <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">RAG 回答</span>
                {isQuerying && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
                )}
              </div>
              <div className="p-4">
                <MarkdownRenderer content={answer} />
                {isQuerying && (
                  <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
                )}
                <SourceBadge sources={sources} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="relative flex items-end gap-2 rounded-2xl border bg-muted/30 px-4 py-2 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你想了解的问题..."
              rows={1}
              disabled={isQuerying}
              className="flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isQuerying}
              className={`flex-shrink-0 rounded-full p-2 transition-colors ${
                input.trim() && !isQuerying
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isQuerying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground/40">
            AI 回答基于已上传的知识库文档，请验证重要信息
          </p>
        </div>
      </div>
    </div>
  );
}
