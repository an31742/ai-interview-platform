"use client";

import { usePlaygroundStore } from "@/store/playground-store";
import {
  usePlaygroundSend,
} from "@/hooks/use-playground-send";

/**
 * 模型配置面板（中间栏）
 *
 * 职责：
 * 1. 模型选择
 * 2. Temperature / Max Tokens / Top P 参数调节
 * 3. "发送"按钮触发请求
 * 4. A/B 对比模式切换
 */
export function ModelConfigPanel() {
  const modelConfig = usePlaygroundStore((s) => s.modelConfig);
  const isStreaming = usePlaygroundStore((s) => s.isStreaming);
  const setModelConfig = usePlaygroundStore((s) => s.setModelConfig);
  const toggleABTest = usePlaygroundStore((s) => s.toggleABTest);
  const sendRequest = usePlaygroundSend();

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">模型配置</h2>
      </div>

      {/* 参数区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            模型
          </label>
          <select
            value={modelConfig.model}
            onChange={(e) => setModelConfig({ model: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="deepseek-coder">DeepSeek Coder</option>
          </select>
        </div>

        {/* Temperature */}
        <SliderControl
          label="Temperature"
          value={modelConfig.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => setModelConfig({ temperature: v })}
          description="控制输出的随机性。0 最确定，2 最随机"
          getLabel={(v) => {
            if (v <= 0.3) return "精确";
            if (v <= 0.7) return "平衡";
            if (v <= 1.2) return "创意";
            return "天马行空";
          }}
        />

        {/* Max Tokens */}
        <SliderControl
          label="Max Tokens"
          value={modelConfig.maxTokens}
          min={64}
          max={8192}
          step={64}
          onChange={(v) => setModelConfig({ maxTokens: v })}
          description="限制回复的最大长度"
          displayValue={`${modelConfig.maxTokens}`}
        />

        {/* Top P */}
        <SliderControl
          label="Top P"
          value={modelConfig.topP}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setModelConfig({ topP: v })}
          description="核采样参数，控制候选词范围"
          getLabel={(v) => {
            if (v >= 0.9) return "宽松";
            if (v >= 0.5) return "适中";
            return "严格";
          }}
        />
      </div>

      {/* 底部：A/B 切换 + 发送按钮 */}
      <div className="border-t p-4 space-y-2">
        <button
          onClick={toggleABTest}
          className="w-full rounded-lg border border-dashed border-muted-foreground/30 px-4 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          🧪 A/B 对比测试
        </button>

        <button
          onClick={sendRequest}
          disabled={isStreaming}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              输出中...
            </span>
          ) : (
            "发送测试 🚀"
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// 滑块控件组件
// ============================================

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
  getLabel,
  displayValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  description: string;
  getLabel?: (v: number) => string;
  displayValue?: string;
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {getLabel && (
            <span className="text-[10px] text-muted-foreground/70">
              {getLabel(value)}
            </span>
          )}
          <span className="text-xs font-mono tabular-nums">
            {displayValue ?? value}
          </span>
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`,
          }}
        />
      </div>

      <p className="text-[10px] text-muted-foreground/60">{description}</p>
    </div>
  );
}
