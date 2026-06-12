"use client";

import { useState } from "react";
import { usePlaygroundStore } from "@/store/playground-store";
import { cn } from "@/lib/utils";
import { Bookmark, Check, Download, Trash2, X } from "lucide-react";

/**
 * 模板管理器
 *
 * 允许用户保存当前的 Prompt 配置为模板
 * 支持加载和删除已保存的模板
 */
export function TemplateManager() {
  const savedTemplates = usePlaygroundStore((s) => s.savedTemplates);
  const saveTemplate = usePlaygroundStore((s) => s.saveTemplate);
  const loadTemplate = usePlaygroundStore((s) => s.loadTemplate);
  const deleteTemplate = usePlaygroundStore((s) => s.deleteTemplate);

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSave = () => {
    if (!templateName.trim()) return;
    saveTemplate(templateName.trim());
    setTemplateName("");
    setShowSaveInput(false);
  };

  const handleLoad = (template: (typeof savedTemplates)[0]) => {
    loadTemplate(template);
    setShowTemplates(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteTemplate(id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* 保存按钮 */}
        {!showSaveInput ? (
          <button
            onClick={() => setShowSaveInput(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bookmark className="h-3.5 w-3.5" />
            保存模板
          </button>
        ) : null}

        {/* 查看模板列表 */}
        {savedTemplates.length > 0 && (
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              showTemplates
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Download className="h-3.5 w-3.5" />
            加载模板 ({savedTemplates.length})
          </button>
        )}
      </div>

      {/* 保存输入框 */}
      {showSaveInput && (
        <div className="flex items-center gap-1.5">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setShowSaveInput(false);
            }}
            placeholder="模板名称..."
            className="flex-1 rounded-md border bg-muted/30 px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="rounded p-1 text-primary hover:bg-primary/10 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowSaveInput(false)}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 模板列表 */}
      {showTemplates && savedTemplates.length > 0 && (
        <div className="rounded-lg border bg-card max-h-[200px] overflow-y-auto">
          {savedTemplates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleLoad(tpl)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors border-b last:border-b-0"
            >
              <span className="text-base">
                {[
                  { t: "plain", i: "💬" },
                  { t: "role", i: "🎭" },
                  { t: "few-shot", i: "📋" },
                  { t: "cot", i: "🧠" },
                ].find((x) => x.t === tpl.promptType)?.i || "📄"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{tpl.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {tpl.promptType} · T={tpl.modelConfig.temperature}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, tpl.id)}
                className="rounded p-0.5 text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
