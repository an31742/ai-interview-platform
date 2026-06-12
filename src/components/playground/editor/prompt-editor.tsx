"use client";

import { usePlaygroundStore } from "@/store/playground-store";
import { PromptTypeSelector } from "./prompt-type-selector";
import { TemplateManager } from "./template-manager";
import { PlainTemplate } from "../templates/plain-template";
import { RoleTemplate } from "../templates/role-template";
import { FewShotTemplate } from "../templates/few-shot-template";
import { CoTTemplate } from "../templates/cot-template";

/**
 * Prompt 编辑器（左侧面板的核心组件）
 *
 * 职责：
 * 1. 显示类型选择器
 * 2. 模板保存/加载
 * 3. 根据当前类型渲染对应的模板编辑器
 */
export function PromptEditor() {
  const promptType = usePlaygroundStore((s) => s.promptType);
  const resetVariables = usePlaygroundStore((s) => s.resetVariables);

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Prompt 编辑器</h2>
        <button
          onClick={resetVariables}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="重置所有输入"
        >
          重置
        </button>
      </div>

      {/* 内容区域（可滚动） */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <PromptTypeSelector />

          {/* 模板管理器 */}
          <TemplateManager />

          {/* 分隔 */}
          <div className="border-t" />

          {/* 根据类型渲染对应模板 */}
          <div className="pb-4">
            {promptType === "plain" && <PlainTemplate />}
            {promptType === "role" && <RoleTemplate />}
            {promptType === "few-shot" && <FewShotTemplate />}
            {promptType === "cot" && <CoTTemplate />}
          </div>
        </div>
      </div>
    </div>
  );
}
