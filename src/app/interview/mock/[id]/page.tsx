"use client";

import { useEffect, useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Loader2, FileText } from "lucide-react";

// ============================================
// 模拟面试对话页（核心页面）
// ============================================

export default function MockInterviewChatPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useInterviewStore((s) =>
    s.sessions.find((s) => s.id === params.id)
  );
  const {
    addMessage,
    setSessionPhase,
    completeSession,
    setStreamStatus,
    streamStatus,
    streamingContent,
    appendStreamContent,
    clearStreamContent,
  } = useInterviewStore();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // 简历和 JD 上下文
  const resume = useInterviewStore((s) => {
    const id = s.currentResumeId;
    return id ? s.resumes.find((r) => r.id === id) : s.resumes[0];
  });

  useEffect(() => {
    if (!session) return;

    if (session.messages.length === 0) {
      const welcomeMsg = {
        role: "ai" as const,
        content:
          "你好，我是你的 AI 面试官。请先做一个简单的自我介绍吧，包括你的工作经历、技术栈和主要项目。",
        type: "question" as const,
        phase: "self-intro" as const,
      };
      addMessage(session.id, welcomeMsg);
    }
  }, [session?.id]);

  const handleSend = async () => {
    if (!input.trim() || !session || streamStatus === "streaming") return;

    const userMessage = input;
    setInput("");
    setError(null);

    addMessage(session.id, {
      role: "user",
      content: userMessage,
      type: "answer",
      phase: session.currentPhase,
    });

    if (session.status === "preparing") {
      useInterviewStore.getState().updateSession(session.id, {
        status: "in-progress",
      });
    }

    // 调用真实 API (SSE 流式)
    setStreamStatus("streaming");
    clearStreamContent();

    try {
      const resumeContext = resume?.parsed
        ? `${resume.parsed.name}，${resume.parsed.yearsOfExperience}年经验，技能：${resume.parsed.skills.join("、")}`
        : undefined;

      const response = await fetch("/api/interview/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...session.messages,
            { role: "user", content: userMessage, type: "answer", phase: session.currentPhase },
          ],
          phase: session.currentPhase,
          resumeContext,
          resumeId: resume?.id, // 传入 resumeId 用于 RAG 检索
          jdContext: session.jdContent,
        }),
      });

      if (!response.ok) throw new Error(`请求失败 (${response.status})`);

      // 读取 SSE 流
      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      let lastEval: { score: number; comment: string } | null = null;
      let newPhase = session.currentPhase;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);
            switch (event.type) {
              case "chunk":
                fullResponse += event.content;
                appendStreamContent(event.content);
                break;
              case "evaluation":
                lastEval = { score: event.score, comment: event.comment };
                break;
              case "phase-change":
                newPhase = event.phase;
                break;
              case "error":
                throw new Error(event.error);
            }
          } catch { /* 忽略解析错误 */ }
        }
      }

      await new Promise((r) => setTimeout(r, 100));

      addMessage(session.id, {
        role: "ai",
        content: fullResponse,
        type: "question",
        phase: session.currentPhase,
        score: lastEval?.score,
        evaluation: lastEval?.comment,
      });

      if (newPhase !== session.currentPhase) {
        setSessionPhase(session.id, newPhase as any);
      }

      // 检查是否结束
      if (
        fullResponse.includes("面试时间到了") ||
        fullResponse.includes("我来做个简单总结")
      ) {
        completeSession(session.id, {
          overall: 0,
          dimensions: { fundamentals: 0, projectDepth: 0, systemDesign: 0, expression: 0, aiCapability: 0 },
          strengths: [],
          weaknesses: [],
          suggestions: [],
          questionScores: [],
        });
        generateReport(session.id);
      }

      clearStreamContent();
      setStreamStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
      setStreamStatus("idle");
      clearStreamContent();
    }
  };

  const generateReport = async (sessionId: string) => {
    try {
      const s = useInterviewStore.getState().sessions.find((s) => s.id === sessionId);
      if (!s) return;

      const response = await fetch("/api/interview/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: s.messages,
          resumeContext: resume?.parsed
            ? `${resume.parsed.name}，${resume.parsed.yearsOfExperience}年经验`
            : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.score) {
          useInterviewStore.getState().completeSession(sessionId, result.score);
        }
      }
    } catch { /* 报告生成失败不影响主流程 */ }
  };

  /** 主动结束面试 */
  const handleEndInterview = async () => {
    if (!session || ending) return;
    setEnding(true);
    setShowEndConfirm(false);

    addMessage(session.id, {
      role: "ai",
      content: "⏰ 面试已结束，正在生成报告...",
      type: "system",
      phase: session.currentPhase,
    });

    completeSession(session.id, {
      overall: 0,
      dimensions: { fundamentals: 0, projectDepth: 0, systemDesign: 0, expression: 0, aiCapability: 0 },
      strengths: [],
      weaknesses: [],
      suggestions: [],
      questionScores: [],
    });

    await generateReport(session.id);
    setEnding(false);
    useInterviewStore.getState().refreshStats();
  };

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">面试会话不存在</p>
        <Button asChild className="mt-4">
          <Link href="/interview/mock">返回面试列表</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between border-b px-4 h-14 shrink-0">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/interview/mock">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            阶段:{" "}
            <span className="font-medium">
              {phaseLabel(session.currentPhase)}
            </span>
            {" · "}
            {session.difficulty === "senior" ? "高级" : session.difficulty === "mid" ? "中级" : "初级"}
          </span>
          {session.status === "in-progress" && (
            <>
              {showEndConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">确定结束？</span>
                  <Button size="sm" variant="destructive" onClick={handleEndInterview} disabled={ending}>
                    {ending ? "结束中..." : "确定"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowEndConfirm(false)}>
                    继续
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowEndConfirm(true)}>
                  结束面试
                </Button>
              )}
            </>
          )}
          {session.status === "completed" && (
            <Button size="sm" asChild>
              <Link href={`/interview/mock/${session.id}/report`}>
                <FileText className="h-4 w-4 mr-1" />
                查看报告
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {session.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.type === "system"
                      ? "bg-muted text-muted-foreground text-sm italic"
                      : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.evaluation && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      评分: {msg.score}/10 · {msg.evaluation}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 流式输出 */}
          {streamStatus === "streaming" && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                <p className="text-sm whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
                </p>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                ⚠️ {error}
                <button className="ml-2 underline" onClick={() => setError(null)}>
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 输入区 */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入你的回答... (Enter 发送, Shift+Enter 换行)"
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            disabled={streamStatus === "streaming" || session.status === "completed"}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || streamStatus === "streaming"}
            className="self-end"
          >
            {streamStatus === "streaming" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 阶段中文映射 */
function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    "self-intro": "自我介绍",
    "project-deep-dive": "项目深挖",
    fundamentals: "基础考察",
    "system-design": "系统设计",
    qa: "反问环节",
    completed: "已结束",
  };
  return map[phase] ?? phase;
}
