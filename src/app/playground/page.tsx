"use client";

import { usePlaygroundStore } from "@/store/playground-store";
import { PromptEditor } from "@/components/playground/editor/prompt-editor";
import { ModelConfigPanel } from "@/components/playground/config/model-config-panel";
import { ABConfigPanel } from "@/components/playground/config/ab-config-panel";
import { OutputPanel } from "@/components/playground/output/output-panel";

/**
 * Playground 主页面
 *
 * 三栏布局（A/B 模式下中间栏替换为双配置面板）
 *
 * 面板间使用阴影分隔，而非纯边框，视觉层次更清晰
 */
export default function PlaygroundPage() {
  const abTestMode = usePlaygroundStore((s) => s.abTestMode);

  return (
    <div className="flex h-full w-full">
      {/* 左侧：Prompt 编辑器 */}
      <div className="w-[420px] min-w-[360px] max-w-[480px] border-r bg-background flex flex-col shrink-0">
        <PromptEditor />
      </div>

      {/* 中间：模型配置 / A/B 对比 */}
      <div className="w-[320px] min-w-[280px] border-r bg-background flex flex-col shrink-0">
        {abTestMode ? <ABConfigPanel /> : <ModelConfigPanel />}
      </div>

      {/* 右侧：输出面板 */}
      <div className="flex-1 flex flex-col bg-background min-w-0">
        <OutputPanel />
      </div>
    </div>
  );
}
