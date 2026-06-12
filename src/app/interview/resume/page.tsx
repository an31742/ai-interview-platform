"use client";

import { useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Trash2, Loader2, AlertCircle } from "lucide-react";

// ============================================
// 简历管理页面
// ============================================

export default function ResumePage() {
  const { resumes, addResume, updateResume, deleteResume, selectResume, currentResumeId } =
    useInterviewStore();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file || file.type !== "application/pdf") return;

    setUploading(true);
    setStatusText("正在上传...");

    // 立即创建一条"上传中"的记录
    const resumeId = addResume({
      fileName: file.name,
      fileSize: file.size,
      status: "uploading",
    });

    try {
      // 1. 上传文件到分析 API
      setStatusText("正在解析 PDF...");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/interview/analyze-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(err.error || `上传失败 (${response.status})`);
      }

      // 2. 接收分析结果
      setStatusText("AI 正在分析简历...");
      const result = await response.json();

      // 3. 更新 Store
      updateResume(resumeId, {
        status: "ready",
        rawText: result.rawText,
        parsed: result.parsed,
        analysis: result.analysis,
      });

      // 4. 自动跳转到分析报告
      selectResume(resumeId);
      router.push("/interview/resume/analysis");
    } catch (err) {
      updateResume(resumeId, {
        status: "error",
      });
      alert(err instanceof Error ? err.message : "上传失败，请重试");
    } finally {
      setUploading(false);
      setStatusText("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">简历管理</h1>
        <p className="text-muted-foreground mt-1">
          上传 PDF 简历，AI 自动分析你的技术栈和面试重点
        </p>
      </div>

      {/* 上传区域 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mb-6 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{statusText}</p>
            <p className="text-xs text-muted-foreground">解析+AI分析约需 5-10 秒</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              拖拽 PDF 文件到此处，或点击选择文件
            </p>
            <p className="text-xs text-muted-foreground">支持 PDF 格式</p>
            <Input
              type="file"
              accept=".pdf"
              className="hidden"
              id="resume-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("resume-upload")?.click()}
            >
              选择文件
            </Button>
          </div>
        )}
      </div>

      {/* 简历列表 */}
      <h2 className="text-lg font-semibold mb-3">
        已上传简历 ({resumes.length})
      </h2>
      <ScrollArea className="max-h-96">
        <div className="space-y-3">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className={`rounded-lg border p-4 flex items-center justify-between ${
                resume.id === currentResumeId
                  ? "border-primary bg-primary/5"
                  : resume.status === "error"
                    ? "border-destructive/30 bg-destructive/5"
                    : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {resume.status === "error" ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">{resume.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {resume.status === "error" ? (
                      <span className="text-destructive">❌ 解析失败</span>
                    ) : resume.status === "uploading" ? (
                      <span className="text-muted-foreground">⏳ 处理中...</span>
                    ) : resume.status === "analyzing" ? (
                      <span className="text-muted-foreground">🤖 AI 分析中...</span>
                    ) : (
                      <>
                        {resume.parsed?.name || "未解析"} ·{" "}
                        {resume.parsed?.yearsOfExperience ?? "?"}年经验 · ✅ 已就绪
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/interview/resume/analysis">查看分析</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteResume(resume.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {resumes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              还没有上传简历
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
