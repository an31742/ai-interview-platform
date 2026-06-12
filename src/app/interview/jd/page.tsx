"use client";

import { useState } from "react";
import { useInterviewStore } from "@/store/interview-store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Send, Loader2, Trash2 } from "lucide-react";

// ============================================
// JD 分析页面
// ============================================

export default function JDPage() {
  const router = useRouter();
  const { jds, addJD, updateJD, deleteJD } = useInterviewStore();
  const resumes = useInterviewStore((s) => s.resumes);
  const [content, setContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState("");

  const handleAnalyze = async () => {
    if (!content.trim()) return;

    setAnalyzing(true);
    setStatusText("正在分析 JD...");

    try {
      const resume = resumes[0]; // 取最新简历

      const response = await fetch("/api/interview/analyze-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdContent: content,
          resume, // 客户端直接传入简历数据
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(err.error || `分析失败 (${response.status})`);
      }

      const result = await response.json();

      // 存入 Store
      const jdId = addJD({
        content,
        company: result.analysis?.company,
        position: result.analysis?.position,
        analysis: result.analysis,
      });

      setContent("");
      router.push("/interview/jd/analysis");
    } catch (err) {
      alert(err instanceof Error ? err.message : "分析失败，请重试");
    } finally {
      setAnalyzing(false);
      setStatusText("");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">JD 分析</h1>
        <p className="text-muted-foreground mt-1">
          粘贴岗位描述，AI 分析匹配度并生成面试考点
        </p>
      </div>

      {/* JD 输入 */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">
          粘贴 JD 内容
        </label>
        <Textarea
          placeholder={`将岗位描述粘贴到这里...\n\n支持中英文 JD，越长越准确`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="mb-2"
        />
        <Button onClick={handleAnalyze} disabled={!content.trim() || analyzing}>
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {statusText}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              开始分析
            </>
          )}
        </Button>
        {resumes.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            ⚠️ 暂未上传简历，将只分析 JD 基本信息（匹配度需要简历）
          </p>
        )}
      </div>

      {/* JD 列表 */}
      <h2 className="text-lg font-semibold mb-3">
        历史分析 ({jds.length})
      </h2>
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-3">
          {jds.map((jd) => (
            <div key={jd.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">
                    {jd.position || "岗位"} · {jd.company || "未知公司"}
                  </p>
                  {jd.analysis && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      匹配度: {jd.analysis.matchScore}/100 ·{" "}
                      {jd.analysis.requiredSkills.length} 项技能要求
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/interview/jd/analysis")}
                  >
                    查看分析
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteJD(jd.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {jd.content}
              </p>
            </div>
          ))}
          {jds.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              还没有分析过 JD
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
