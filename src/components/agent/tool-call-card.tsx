"use client";

import { CheckCircle, Loader2, XCircle, Clock } from "lucide-react";

/**
 * Tool 调用卡片 — 可视化展示工具调用过程
 *
 * 状态流转：
 * pending (灰色) → 正在调用
 * success (绿色) → 执行成功，显示结果
 * error (红色)   → 执行失败，显示错误
 */
export function ToolCallCard({
  name,
  args,
  result,
  success,
  duration,
  isPending,
}: {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  success?: boolean;
  duration?: number;
  isPending?: boolean;
}) {
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const toolIcons: Record<string, string> = {
    get_weather: "🌤️",
    calculate: "🧮",
    get_time: "🕐",
  };

  const toolLabels: Record<string, string> = {
    get_weather: "查询天气",
    calculate: "数学计算",
    get_time: "获取时间",
  };

  const icon = toolIcons[name] || "🔧";
  const label = toolLabels[name] || name;

  return (
    <div className="flex justify-start px-4 py-2">
      <div className="w-full max-w-[80%] md:max-w-[70%]">
        <div
          className={`rounded-xl border p-3 text-sm transition-colors ${
            isPending
              ? "border-muted-foreground/30 bg-muted/30"
              : success
              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          {/* 头部：图标 + 工具名 + 状态 */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span className="text-xs font-medium">{label}</span>
              <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono">
                {name}({argsStr})
              </code>
            </div>

            <div className="flex items-center gap-1.5">
              {isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    调用中...
                  </span>
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  {duration && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {duration}ms
                    </span>
                  )}
                </>
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
            </div>
          </div>

          {/* 结果内容 */}
          {!isPending && result && (
            <div className="mt-1 rounded-lg bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {safeParse(result)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 尝试解析 JSON 结果，让其更可读 */
function safeParse(str: string): string {
  try {
    const obj = JSON.parse(str);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  } catch {
    return str;
  }
}
