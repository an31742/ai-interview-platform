"use client";

import { usePlaygroundStore } from "@/store/playground-store";

/**
 * Few Shot Prompt 模板
 *
 * 通过提供输入输出示例，让 AI 学会"模式"
 * 适合：分类、翻译、格式化、情感分析等
 *
 * 模板：
 * 以下是一些示例：
 *
 * {examples}
 *
 * 现在请处理以下输入：
 * {fewShotInput}
 *
 * 适用场景：
 * - 情感分类（正面/负面/中性）
 * - 格式转换（JSON/XML/Markdown）
 * - 翻译任务
 * - 代码生成
 */
export function FewShotTemplate() {
  const variables = usePlaygroundStore((s) => s.variables);
  const updateVariable = usePlaygroundStore((s) => s.updateVariable);

  const examples = variables.examples ?? "";
  const input = variables.fewShotInput ?? "";
  const additionalContext = variables.additionalContext ?? "";

  const preview = buildFewShotPrompt(examples, input, additionalContext);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-3 py-2">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>💡 Few Shot 最佳实践：</strong>提供 2-3 个高质量示例，覆盖不同情况。
          示例要有代表性，输入和输出格式一致。
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          示例 <span className="text-destructive">*</span>
        </label>
        <textarea
          value={examples}
          onChange={(e) => updateVariable("examples", e.target.value)}
          placeholder={`输入: 今天天气真好\n情感: 正面\n\n输入: 这部电影太无聊了\n情感: 负面\n\n输入: 我买了本书\n情感: 中性`}
          rows={8}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none font-mono text-xs transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          待处理的输入 <span className="text-destructive">*</span>
        </label>
        <textarea
          value={input}
          onChange={(e) => updateVariable("fewShotInput", e.target.value)}
          placeholder="输入: 这个产品非常好用"
          rows={3}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          额外指令（可选）
        </label>
        <textarea
          value={additionalContext}
          onChange={(e) => updateVariable("additionalContext", e.target.value)}
          placeholder="例：仅输出情感标签，不要额外解释"
          rows={2}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      <PreviewBox content={preview} />
    </div>
  );
}

/** 构建 Few Shot Prompt */
function buildFewShotPrompt(
  examples: string,
  input: string,
  context: string
): string {
  const parts: string[] = [];

  if (examples) {
    parts.push("以下是一些示例：\n");
    parts.push(examples);
  }

  if (input) {
    parts.push(`\n现在请处理以下输入：\n${input}`);
  }

  if (context) {
    parts.push(`\n${context}`);
  }

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
          <span className="italic">填写示例和输入后将在此显示预览</span>
        )}
      </div>
    </div>
  );
}
