"use client";

import { usePlaygroundStore } from "@/store/playground-store";

/**
 * Chain of Thought Prompt 模板
 *
 * 引导 AI 逐步推理，最后给出答案
 * 适合：数学题、逻辑推理、复杂决策、代码调试
 *
 * 模板：
 * 问题：{question}
 *
 * 让我们一步一步思考：
 * {steps}
 *
 * 请逐步推理并给出最终答案。
 *
 * 适用场景：
 * - 数学应用题
 * - 逻辑推理题
 * - 代码 Debug
 * - 决策分析
 */
export function CoTTemplate() {
  const variables = usePlaygroundStore((s) => s.variables);
  const updateVariable = usePlaygroundStore((s) => s.updateVariable);

  const question = variables.question ?? "";
  const steps = variables.steps ?? "";
  const additionalContext = variables.additionalContext ?? "";

  const preview = buildCoTPrompt(question, steps, additionalContext);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <strong>🧠 CoT 原理：</strong>通过引导 AI 显式输出中间推理步骤，可以显著提高复杂问题的准确率。对于需要多步推理的任务，CoT 的效果通常比直接提问好 20-30%。
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          问题 / 任务 <span className="text-destructive">*</span>
        </label>
        <textarea
          value={question}
          onChange={(e) => updateVariable("question", e.target.value)}
          placeholder={`例：
一个池塘里有 120 条鱼。
每天早上卖掉 1/3，晚上又补充 20 条。
3 天后池塘里有多少条鱼？`}
          rows={4}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          步骤引导（可选）
        </label>
        <textarea
          value={steps}
          onChange={(e) => updateVariable("steps", e.target.value)}
          placeholder={`1. 计算第一天结束时的鱼数量
2. 计算第二天结束时的鱼数量
3. 计算第三天结束时的鱼数量
4. 得出最终答案`}
          rows={4}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          额外上下文（可选）
        </label>
        <textarea
          value={additionalContext}
          onChange={(e) => updateVariable("additionalContext", e.target.value)}
          placeholder="例：请用 Python 代码验证你的推理"
          rows={2}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      <PreviewBox content={preview} />
    </div>
  );
}

/** 构建 CoT Prompt */
function buildCoTPrompt(
  question: string,
  steps: string,
  context: string
): string {
  const parts: string[] = [];

  if (question) {
    parts.push(`问题：${question}`);
  }

  parts.push("\n让我们一步一步思考：");

  if (steps) {
    parts.push(steps);
  } else {
    parts.push("请逐步分析并给出最终答案。");
  }

  if (context) {
    parts.push(`\n${context}`);
  }

  parts.push("\n请逐步推理并给出最终答案。");

  return parts.join("\n");
}

function PreviewBox({ content }: { content: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        最终发送内容预览
      </label>
      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap min-h-[40px] max-h-[150px] overflow-y-auto">
        {content || (
          <span className="italic">填写问题后将在此显示预览</span>
        )}
      </div>
    </div>
  );
}
