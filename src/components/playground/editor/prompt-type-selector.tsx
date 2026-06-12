"use client";

import { usePlaygroundStore } from "@/store/playground-store";
import { PROMPT_TYPE_META } from "@/types/playground";
import { cn } from "@/lib/utils";

/**
 * Prompt 类型选择器
 *
 * 2×2 网格卡片布局，选中状态有高亮和阴影
 */
export function PromptTypeSelector() {
  const currentType = usePlaygroundStore((s) => s.promptType);
  const setPromptType = usePlaygroundStore((s) => s.setPromptType);

  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-muted-foreground">
        Prompt 模式
      </label>
      <div className="grid grid-cols-2 gap-2">
        {PROMPT_TYPE_META.map((meta) => {
          const isActive = currentType === meta.value;
          return (
            <button
              key={meta.value}
              onClick={() => setPromptType(meta.value)}
              className={cn(
                "group relative flex flex-col gap-1.5 rounded-xl border-2 px-3 py-3 text-left transition-all duration-200",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                  : "border-border/60 bg-card hover:border-muted-foreground/30 hover:bg-accent/30 hover:shadow-sm"
              )}
            >
              {/* 选中指示器 */}
              {isActive && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <svg
                    className="h-2.5 w-2.5 text-primary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}

              <span className="text-lg">{meta.icon}</span>
              <div>
                <div
                  className={cn(
                    "text-xs font-semibold",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {meta.label}
                </div>
                <div className="text-[10px] leading-tight text-muted-foreground/70 mt-0.5 line-clamp-2">
                  {meta.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
