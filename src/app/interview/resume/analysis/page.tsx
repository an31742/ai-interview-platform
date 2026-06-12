"use client";

import { useInterviewStore } from "@/store/interview-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Download } from "lucide-react";

// ============================================
// 简历分析报告页面
// ============================================

export default function ResumeAnalysisPage() {
  const router = useRouter();
  const resume = useInterviewStore((s) => {
    const id = s.currentResumeId;
    return id ? s.resumes.find((r) => r.id === id) : s.resumes[0];
  });

  if (!resume) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <p className="text-muted-foreground">还没有上传简历</p>
        <Button asChild className="mt-4">
          <a href="/interview/resume">去上传</a>
        </Button>
      </div>
    );
  }

  if (resume.status === "uploading" || resume.status === "analyzing") {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <p className="text-muted-foreground">简历正在分析中，请稍候...</p>
      </div>
    );
  }

  if (resume.status === "error") {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <p className="text-destructive font-medium mb-2">简历分析失败</p>
        <p className="text-sm text-muted-foreground mb-4">
          请确认简历是文字版 PDF（非扫描件），然后重新上传
        </p>
        <Button asChild>
          <a href="/interview/resume">重新上传</a>
        </Button>
      </div>
    );
  }

  const { parsed, analysis } = resume;
  if (!parsed) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-12">
        <p className="text-muted-foreground">简历数据不完整，请重新上传</p>
      </div>
    );
  }

  const handleExport = () => {
    const data = JSON.stringify(
      { parsed, analysis },
      null,
      2
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${parsed.name}-简历分析报告.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl mx-auto">
        {/* 返回按钮 */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/interview/resume")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回简历列表
          </Button>
        </div>

        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">简历分析报告</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {resume.fileName} · {resume.parsed?.name}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            导出报告
          </Button>
        </div>

        {/* 基本信息 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">基本信息</h2>
          <div className="grid grid-cols-4 gap-3">
            <InfoCard label="姓名" value={parsed.name} />
            <InfoCard label="目标岗位" value={parsed.title} />
            <InfoCard label="工作经验" value={`${parsed.yearsOfExperience} 年`} />
            <InfoCard label="技术栈" value={parsed.skills.slice(0, 4).join("、")} />
          </div>
        </section>

        {/* 工作经历 */}
        {parsed.experience.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">工作经历</h2>
            <div className="space-y-3">
              {parsed.experience.map((exp, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">
                      {exp.company}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {exp.role}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground">{exp.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{exp.description}</p>
                  {exp.highlights.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                      {exp.highlights.map((h, j) => (
                        <li key={j}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 项目经历 */}
        {parsed.projects.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">项目经历</h2>
            <div className="space-y-3">
              {parsed.projects.map((proj, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <p className="font-medium mb-1">{proj.name}</p>
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {proj.techStack.map((t, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{proj.description}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">职责：</span>
                    {proj.responsibility}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI 分析 */}
        {analysis && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">🤖 AI 面试分析</h2>

            {/* 置信度 */}
            <div className="mb-4 rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">综合评分</span>
                <span className="text-lg font-bold text-primary">{analysis.confidence}/100</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${analysis.confidence}%` }}
                />
              </div>
            </div>

            {/* 优势 */}
            <div className="mb-4 rounded-lg border p-4">
              <h3 className="font-semibold text-sm text-green-600 mb-2 flex items-center gap-1">
                ✅ 优势
              </h3>
              <ul className="space-y-1">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc list-inside">
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* 待改进 */}
            <div className="mb-4 rounded-lg border p-4">
              <h3 className="font-semibold text-sm text-orange-600 mb-2 flex items-center gap-1">
                ⚠️ 待改进
              </h3>
              <ul className="space-y-1">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc list-inside">
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* 面试重点 */}
            <div className="mb-4 rounded-lg border p-4">
              <h3 className="font-semibold text-sm text-blue-600 mb-2 flex items-center gap-1">
                🎯 面试准备重点
              </h3>
              <ul className="space-y-1">
                {analysis.suggestedFocus.map((f, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc list-inside">
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* 缺失关键词 */}
            {analysis.missingKeywords.length > 0 && (
              <div className="mb-4 rounded-lg border p-4">
                <h3 className="font-semibold text-sm text-purple-600 mb-2 flex items-center gap-1">
                  📌 建议补充的技能
                </h3>
                <div className="flex gap-1 flex-wrap">
                  {analysis.missingKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-600"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 整体建议 */}
            {analysis.suggestion && (
              <div className="rounded-lg border-l-4 border-l-primary bg-muted/30 p-4">
                <h3 className="font-semibold text-sm mb-1">💡 整体建议</h3>
                <p className="text-sm text-muted-foreground">{analysis.suggestion}</p>
              </div>
            )}
          </section>
        )}

        {/* 原文预览 */}
        {resume.rawText && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">原文预览</h2>
            <div className="rounded-lg border bg-muted/30 p-4">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {resume.rawText.slice(0, 1500)}
                {resume.rawText.length > 1500 ? "\n...(截断)" : ""}
              </pre>
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}

/** 信息卡片 */
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium truncate">{value || "-"}</p>
    </div>
  );
}
