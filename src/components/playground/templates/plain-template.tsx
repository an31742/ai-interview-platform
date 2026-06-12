"use client";

import { usePlaygroundStore } from "@/store/playground-store";

/**
 * 普通 Prompt 模板
 *
 * 最简单直接的形式：用户输入什么，就发送什么
 * 适合：简单问答、信息查询、翻译等
 *
 * 模板：
 * {userInput}
 */
export function PlainTemplate() {
  const userInput = usePlaygroundStore((s) => s.variables.userInput ?? "");
  const updateVariable = usePlaygroundStore((s) => s.updateVariable);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          输入你的问题或指令
        </label>
        <textarea
          value={userInput}
          onChange={(e) => updateVariable("userInput", e.target.value)}
          placeholder="在此输入你的 Prompt..."
          rows={10}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      {/* 实时预览 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          最终发送内容预览
        </label>
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap min-h-[40px]">
          {userInput || (
            <span className="italic">输入内容后将在此显示预览</span>
          )}
        </div>
      </div>
    </div>
  );
}
