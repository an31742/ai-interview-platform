"use client";

import { usePlaygroundStore } from "@/store/playground-store";

/**
 * 角色 Prompt 模板
 *
 * 通过指定角色让 AI 以特定身份回答问题
 *
 * 模板：
 * 你是一名{role}。
 * 请完成以下任务：
 * {task}
 *
 * {additionalContext}
 *
 * 适用场景：客服机器人、领域专家咨询、角色扮演等
 */
export function RoleTemplate() {
  const variables = usePlaygroundStore((s) => s.variables);
  const updateVariable = usePlaygroundStore((s) => s.updateVariable);

  const role = variables.role ?? "";
  const task = variables.task ?? "";
  const additionalContext = variables.additionalContext ?? "";

  // 实时构建完整 prompt
  const preview = buildRolePrompt(role, task, additionalContext);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          角色定义 <span className="text-destructive">*</span>
        </label>
        <input
          value={role}
          onChange={(e) => updateVariable("role", e.target.value)}
          placeholder="例：资深 Python 架构师、客服主管、数学教授..."
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          任务描述 <span className="text-destructive">*</span>
        </label>
        <textarea
          value={task}
          onChange={(e) => updateVariable("task", e.target.value)}
          placeholder="描述你想要 AI 完成的具体任务..."
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
          placeholder="提供额外的背景信息、约束条件..."
          rows={3}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none transition-colors"
        />
      </div>

      {/* 实时预览 */}
      <PreviewBox content={preview} />
    </div>
  );
}

/** 构建角色 Prompt */
function buildRolePrompt(
  role: string,
  task: string,
  context: string
): string {
  const parts: string[] = [];

  if (role) {
    parts.push(`你是一名${role}。`);
  }
  if (task) {
    parts.push(`请完成以下任务：\n${task}`);
  }
  if (context) {
    parts.push(context);
  }

  return parts.join("\n\n");
}

/** 预览组件 */
function PreviewBox({ content }: { content: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        最终发送内容预览
      </label>
      <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap min-h-[40px] max-h-[150px] overflow-y-auto">
        {content || (
          <span className="italic">填写角色和任务后将在此显示预览</span>
        )}
      </div>
    </div>
  );
}
