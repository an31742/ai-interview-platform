"use client";

import { usePlaygroundStore } from "@/store/playground-store";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { AlertCircle, Clock, FlaskConical, History, Zap } from "lucide-react";

/**
 * 输出面板（右侧栏）
 *
 * 支持普通模式 + A/B 对比模式
 */
export function OutputPanel() {
  const response = usePlaygroundStore((s) => s.response);
  const isStreaming = usePlaygroundStore((s) => s.isStreaming);
  const error = usePlaygroundStore((s) => s.error);
  const history = usePlaygroundStore((s) => s.history);
  const abTestMode = usePlaygroundStore((s) => s.abTestMode);
  const abResponseA = usePlaygroundStore((s) => s.abResponseA);
  const abResponseB = usePlaygroundStore((s) => s.abResponseB);
  const abStreamingA = usePlaygroundStore((s) => s.abStreamingA);
  const abStreamingB = usePlaygroundStore((s) => s.abStreamingB);

  const clearResponse = usePlaygroundStore((s) => s.clearResponse);
  const clearHistory = usePlaygroundStore((s) => s.clearHistory);

  const hasResponse = response.length > 0;

  // A/B 模式
  if (abTestMode) {
    const hasABResult = abResponseA.length > 0 || abResponseB.length > 0;
    const isAnyStreaming = abStreamingA || abStreamingB;

    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">A/B 对比结果</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!hasABResult && !isAnyStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FlaskConical className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                准备对比
              </h3>
              <p className="text-xs text-muted-foreground/60 max-w-[240px]">
                配置 A/B 参数后点击"运行 A/B 对比"
              </p>
            </div>
          )}

          {hasABResult && (
            <div className="p-4 space-y-4">
              {/* 结果 A */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-900">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                      A
                    </span>
                    <span className="text-xs font-medium">配置 A</span>
                  </div>
                  {abStreamingA && (
                    <span className="text-[10px] text-blue-500 flex items-center gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      输出中
                    </span>
                  )}
                </div>
                <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                  {abResponseA ? (
                    <MarkdownRenderer content={abResponseA} />
                  ) : abStreamingA ? (
                    <LoadingDots />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      等待响应...
                    </p>
                  )}
                </div>
              </div>

              {/* 结果 B */}
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                      B
                    </span>
                    <span className="text-xs font-medium">配置 B</span>
                  </div>
                  {abStreamingB && (
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      输出中
                    </span>
                  )}
                </div>
                <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                  {abResponseB ? (
                    <MarkdownRenderer content={abResponseB} />
                  ) : abStreamingB ? (
                    <LoadingDots />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      等待响应...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ 普通模式 ============
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">输出</h2>
        {hasResponse && (
          <button
            onClick={clearResponse}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            清空
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!hasResponse && !error && !isStreaming && history.length === 0 && (
          <EmptyState />
        )}

        {error && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => usePlaygroundStore.getState().setError(null)}
              className="text-xs underline hover:no-underline"
            >
              关闭
            </button>
          </div>
        )}

        {(hasResponse || isStreaming) && (
          <div className="p-4">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">
                  {isStreaming ? "输出中..." : "响应结果"}
                </span>
                {isStreaming && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
              </div>
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                {hasResponse ? (
                  <MarkdownRenderer content={response} />
                ) : (
                  <LoadingDots />
                )}
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                运行历史
                <span className="text-muted-foreground/60">
                  ({history.length})
                </span>
              </div>
              <button
                onClick={clearHistory}
                className="text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                清空
              </button>
            </div>
            <div className="space-y-2">
              {history.map((record) => (
                <HistoryItem key={record.id} record={record} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:0ms]" />
      <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Zap className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">
        等待发送
      </h3>
      <p className="text-xs text-muted-foreground/60 max-w-[240px]">
        在左侧编辑 Prompt，调整参数后点击"发送测试"查看结果
      </p>
    </div>
  );
}

function HistoryItem({
  record,
}: {
  record: {
    id: string;
    promptType: string;
    modelConfig: { model: string; temperature: number };
    response: string;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    timestamp: number;
    duration: number;
  };
}) {
  const time = new Date(record.timestamp);
  const timeStr = time.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const preview =
    record.response.length > 100
      ? record.response.slice(0, 100) + "..."
      : record.response;

  return (
    <div className="rounded-lg border bg-card p-3 text-xs space-y-1.5 cursor-pointer hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider">
            {record.promptType}
          </span>
          <span className="text-[10px]">
            {record.modelConfig.model} · T={record.modelConfig.temperature}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(record.duration / 1000).toFixed(1)}s
          </span>
          <span>{record.tokenUsage.totalTokens} tokens</span>
        </div>
      </div>
      <p className="text-muted-foreground line-clamp-2">{preview}</p>
      <div className="flex justify-end">
        <span className="text-[10px] text-muted-foreground/50">{timeStr}</span>
      </div>
    </div>
  );
}
