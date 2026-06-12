/**
 * 面试 RAG 上下文服务
 *
 * 将简历内容向量化存储，面试时检索相关段落作为上下文增强。
 * 让 AI 面试官能精确引用简历细节追问，而不是笼统提问。
 *
 * 使用已有的 ChromaDB / MemoryStore 基础设施。
 */

import { createEmbeddings } from "@/lib/rag/embeddings";
import { createVectorStore } from "@/lib/rag/vector-store";
import { splitDocument } from "@/lib/rag/text-splitter";
import type { EmbeddingModel } from "@/types/rag";
import type { Resume } from "@/types/interview";

const COLLECTION_NAME = "interview_resume";

/**
 * 将简历内容索引到向量库
 * 上传简历后调用，将简历文本分段+向量化存储
 */
export async function indexResumeToRag(resume: Resume): Promise<void> {
  if (!resume.rawText && !resume.parsed) return;

  try {
    // 构建索引文本（优先使用结构化数据，更干净）
    const indexText = buildIndexText(resume);
    if (!indexText.trim()) return;

    const provider = (process.env.RAG_EMBEDDING_PROVIDER || "openai") as EmbeddingModel;
    const embeddings = await createEmbeddings(provider);
    const vectorStore = await createVectorStore(embeddings, COLLECTION_NAME);

    // 分段
    const chunks = await splitDocument(indexText, {
      filename: resume.fileName,
      resumeId: resume.id,
    });

    // 向量化存储
    await vectorStore.addDocuments(chunks);
  } catch (err) {
    console.warn("[rag-context] 索引失败（非致命）:", err);
    // RAG 索引失败不影响主流程
  }
}

/**
 * 为面试检索相关简历上下文
 * 根据当前对话提取关键词，检索最相关的简历段落
 */
export async function retrieveResumeContext(
  resumeId: string,
  query?: string
): Promise<string> {
  try {
    const provider = (process.env.RAG_EMBEDDING_PROVIDER || "openai") as EmbeddingModel;
    const embeddings = await createEmbeddings(provider);
    const vectorStore = await createVectorStore(embeddings, COLLECTION_NAME);

    // 使用简历ID或关键词检索
    const searchQuery = query || resumeId;
    const results = await vectorStore.similaritySearch(searchQuery, 3);

    if (results.length === 0) return "";

    // 组合检索结果
    return results
      .map((r, i) => `[相关经历 ${i + 1}（相关度 ${Math.round(r.score * 100)}%）]\n${r.pageContent}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

/**
 * 从简历构建索引文本
 */
function buildIndexText(resume: Resume): string {
  const parts: string[] = [];

  if (resume.rawText) {
    parts.push(resume.rawText);
  }

  if (resume.parsed) {
    const p = resume.parsed;
    parts.push(`姓名：${p.name}`);
    parts.push(`目标岗位：${p.title}`);
    parts.push(`工作经验：${p.yearsOfExperience}年`);
    parts.push(`技能：${p.skills.join("、")}`);

    for (const exp of p.experience) {
      parts.push(`工作经历：${exp.company} ${exp.role}（${exp.period}）- ${exp.description}`);
      if (exp.highlights.length > 0) {
        parts.push(`亮点：${exp.highlights.join("；")}`);
      }
    }

    for (const proj of p.projects) {
      parts.push(`项目：${proj.name}（${proj.techStack.join("/")}）- ${proj.description}。职责：${proj.responsibility}`);
    }
  }

  if (resume.analysis) {
    parts.push(`AI分析优势：${resume.analysis.strengths.join("、")}`);
    parts.push(`AI分析待改进：${resume.analysis.weaknesses.join("、")}`);
    parts.push(`面试重点：${resume.analysis.suggestedFocus.join("、")}`);
  }

  return parts.join("\n");
}
