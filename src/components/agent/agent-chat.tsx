"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ToolCallCard } from "./tool-call-card";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { ArrowUp, Bot, User, Cpu } from "lucide-react";

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  isPending: boolean;
  result?: string;
  success?: boolean;
  duration?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "tool-start";
  content: string;
  toolCalls?: ToolCallInfo[];
}

export function AgentChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallInfo[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentToolCalls]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const addMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    addMessage(userMsg);

    // 准备消息历史
    const history = [
      ...messages.map((m) => {
        if (m.role === "tool-start") return null;
        return { role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content };
      }).filter(Boolean),
      { role: "user" as const, content },
    ];

    setIsStreaming(true);
    setCurrentToolCalls([]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantContent = "";
    const localToolCalls: ToolCallInfo[] = [];

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("请求失败");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("流不可用");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "tool_call") {
              const tc: ToolCallInfo = {
                id: data.id,
                name: data.name,
                args: data.args,
                isPending: true,
              };
              // 更新本地数组（finally 块使用）
              const idx = localToolCalls.findIndex((t) => t.id === data.id);
              if (idx >= 0) localToolCalls[idx] = tc;
              else localToolCalls.push(tc);
              // 更新 state（UI 渲染）
              setCurrentToolCalls((prev) => [
                ...prev.filter((t) => t.id !== data.id),
                tc,
              ]);
            } else if (data.type === "tool_result") {
              const tc: ToolCallInfo = {
                id: data.id,
                name: data.name,
                args: data.args || {},
                isPending: false,
                result: data.result,
                success: data.success,
                duration: data.duration,
              };
              // 更新本地数组（finally 块使用）
              const idx = localToolCalls.findIndex((t) => t.id === data.id);
              if (idx >= 0) localToolCalls[idx] = tc;
              // 更新 state（UI 渲染）
              setCurrentToolCalls((prev) =>
                prev.map((t) => (t.id === data.id ? tc : t))
              );
            } else if (data.type === "chunk") {
              assistantContent += data.content;
            } else if (data.type === "done") {
              // done
            } else if (data.type === "error") {
              console.error("Agent error:", data.error);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error(err);
      }
    } finally {
      // 添加助手消息（使用本地数组避免闭包过期）
      if (assistantContent || localToolCalls.length > 0) {
        addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent || "已完成工具调用。请继续提问。",
          toolCalls: [...localToolCalls],
        });
      }
      setCurrentToolCalls([]);
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages && !isStreaming && (
          <div className="flex h-full flex-col items-center justify-center text-center px-8">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Cpu className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Function Calling Agent</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              AI 可以自动调用工具来获取实时信息
            </p>

            {/* 示例提示 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
              {[
                { text: "北京今天多少度？", desc: "自动查询天气" },
                { text: "计算 256 * 1024 等于多少？", desc: "调用计算器" },
                { text: "东京现在几点了？", desc: "获取时区时间" },
              ].map((item) => (
                <button
                  key={item.text}
                  onClick={() => {
                    setInput(item.text);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  className="rounded-xl border bg-card p-3 text-left text-xs hover:bg-muted/50 transition-colors"
                >
                  <p className="font-medium mb-0.5">{item.text}</p>
                  <p className="text-muted-foreground">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          {messages.map((msg) => (
            <div key={msg.id}>
              {/* 用户消息 */}
              {msg.role === "user" && (
                <div className="flex justify-end px-4 py-3">
                  <div className="flex items-end gap-3 max-w-[80%] md:max-w-[70%]">
                    <div className="rounded-2xl bg-primary text-primary-foreground rounded-br-md px-4 py-2.5">
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  </div>
                </div>
              )}

              {/* 助手消息 */}
              {msg.role === "assistant" && (
                <div className="flex justify-start px-4 py-3">
                  <div className="flex gap-3 max-w-[80%] md:max-w-[70%]">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary mt-1">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      {msg.toolCalls?.map((tc) => (
                        <ToolCallCard
                          key={tc.id}
                          name={tc.name}
                          args={tc.args}
                          result={tc.result}
                          success={tc.success}
                          duration={tc.duration}
                          isPending={tc.isPending}
                        />
                      ))}
                      {msg.content && (
                        <div className="rounded-2xl bg-muted/50 rounded-bl-md px-4 py-2.5">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* 当前流式中的 Tool Calls */}
          {isStreaming && currentToolCalls.length > 0 && (
            <div className="flex justify-start px-4 py-3">
              <div className="flex gap-3 max-w-[80%] md:max-w-[70%]">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary mt-1">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0 space-y-1">
                  {currentToolCalls.map((tc) => (
                    <ToolCallCard
                      key={tc.id}
                      name={tc.name}
                      args={tc.args}
                      result={tc.result}
                      success={tc.success}
                      duration={tc.duration}
                      isPending={tc.isPending}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
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
              placeholder="输入你想让 AI 帮你做的事..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[200px]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={`flex-shrink-0 rounded-full p-2 transition-colors ${
                input.trim() && !isStreaming
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground/40">
            AI 可以自动调用天气查询、计算器、时间工具来回答你的问题
          </p>
        </div>
      </div>
    </div>
  );
}
