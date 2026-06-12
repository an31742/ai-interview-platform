"use client";

import { usePlaygroundStore } from "@/store/playground-store";
import { useABSend } from "@/hooks/use-ab-send";

/**
 * A/B 对比配置面板
 *
 * 显示两个并排的配置，用不同的参数发送相同 Prompt
 * 对比分析输出差异
 */
export function ABConfigPanel() {
  const abConfigA = usePlaygroundStore((s) => s.abConfigA);
  const abConfigB = usePlaygroundStore((s) => s.abConfigB);
  const abStreamingA = usePlaygroundStore((s) => s.abStreamingA);
  const abStreamingB = usePlaygroundStore((s) => s.abStreamingB);
  const setABConfigA = usePlaygroundStore((s) => s.setABConfigA);
  const setABConfigB = usePlaygroundStore((s) => s.setABConfigB);
  const toggleABTest = usePlaygroundStore((s) => s.toggleABTest);
  const sendAB = useABSend();

  const isStreaming = abStreamingA || abStreamingB;

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">A/B 对比</h2>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            BETA
          </span>
        </div>
        <button
          onClick={toggleABTest}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          退出对比
        </button>
      </div>

      {/* 双配置区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 配置 A */}
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
              A
            </span>
            <span className="text-xs font-medium">配置 A</span>
            {abStreamingA && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            )}
          </div>

          <SmallSlider
            label="Temperature"
            value={abConfigA.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => setABConfigA({ temperature: v })}
          />

          <SmallSlider
            label="Max Tokens"
            value={abConfigA.maxTokens}
            min={64}
            max={8192}
            step={64}
            onChange={(v) => setABConfigA({ maxTokens: v })}
          />
        </div>

        {/* 配置 B */}
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              B
            </span>
            <span className="text-xs font-medium">配置 B</span>
            {abStreamingB && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            )}
          </div>

          <SmallSlider
            label="Temperature"
            value={abConfigB.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => setABConfigB({ temperature: v })}
          />

          <SmallSlider
            label="Max Tokens"
            value={abConfigB.maxTokens}
            min={64}
            max={8192}
            step={64}
            onChange={(v) => setABConfigB({ maxTokens: v })}
          />
        </div>
      </div>

      {/* 发送按钮 */}
      <div className="border-t p-3">
        <button
          onClick={sendAB}
          disabled={isStreaming}
          className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              A/B 测试中...
            </span>
          ) : (
            "运行 A/B 对比 🧪"
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * 微型滑块组件（适合紧凑布局）
 */
function SmallSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono">{value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer bg-muted
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-primary"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`,
        }}
      />
    </div>
  );
}
