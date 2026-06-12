/**
 * RAG 问答链
 *
 * 这是 RAG 系统的核心，将检索和生成编排在一起。
 *
 * 流程：
 * 1. 用户提问
 * 2. 向量检索 → 找到 Top-K 相关文档片段
 * 3. Prompt 组装 → 将文档片段 + 用户问题拼接
 * 4. LLM 生成 → 基于文档内容回答
 * 5. 返回答案 + 引用来源
 */

import OpenAI from "openai";
import type { Embeddings } from "@langchain/core/embeddings";
import type { SourceInfo } from "@/types/rag";
import type { VectorStore } from "./vector-store";

/** RAG 问答结果 */
export interface RagResult {
  /** 完整回答文本（流式拼接后） */
  answer: string;
  /** 引用来源 */
  sources: SourceInfo[];
}

// ============================================
// RAG 系统提示词
// ============================================

const RAG_SYSTEM_PROMPT = `你是一个知识库问答助手。

你的回答必须严格基于以下提供的文档内容。
如果你不知道答案，或者文档中没有相关信息，请如实说"根据提供的文档，我没有找到相关信息"。

要求：
1. 只使用提供的文档内容来回答问题
2. 如果文档内容不足以回答，请明确说明
3. 不要编造或推测文档中没有的信息
4. 在回答末尾，引用你使用的文档来源文件名
5. 使用 Markdown 格式输出

文档内容如下：
---

{documents}

---

请基于以上文档内容回答用户的问题。`;

// ============================================
// Prompt 组装
// ============================================

/**
 * 组装 RAG 问答 Prompt
 *
 * 将检索到的文档片段 + 用户问题 → 发给 LLM 的完整消息
 */
function buildRagPrompt(documents: string, question: string) {
  const systemPrompt = RAG_SYSTEM_PROMPT.replace("{documents}", documents);

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: question },
  ];
}

// ============================================
// 检索
// ============================================

/**
 * 从向量库检索相关文档
 *
 * @param vectorStore - 向量存储
 * @param query       - 用户问题
 * @param topK        - 返回 Top-K 结果
 * @returns 文档片段 + 引用信息
 */
async function retrieveDocuments(
  vectorStore: VectorStore,
  query: string,
  topK: number
): Promise<{ documents: string; sources: SourceInfo[] }> {
  const results = await vectorStore.similaritySearch(query, topK);

  if (results.length === 0) {
    return {
      documents: "（未检索到相关文档）",
      sources: [],
    };
  }

  // 拼接文档内容 + 构建引用信息
  const documentParts: string[] = [];
  const sources: SourceInfo[] = [];

  results.forEach((doc, i) => {
    const filename = (doc.metadata?.filename as string) || "未知文档";
    const chunkIndex = Number(doc.metadata?.chunkIndex) || 0;
    const score = (doc as unknown as { score: number }).score || 0;

    // 文档内容（带编号，方便 LLM 引用）
    documentParts.push(`[文档 ${i + 1}] (${filename}):\n${doc.pageContent}`);

    // 引用信息（返回给前端展示）
    sources.push({
      filename,
      chunkIndex,
      content: doc.pageContent.slice(0, 200), // 预览前 200 字符
      score,
    });
  });

  return {
    documents: documentParts.join("\n\n---\n\n"),
    sources: sources.sort((a, b) => b.score - a.score),
  };
}

// ============================================
// RAG 问答（非流式）
// ============================================

/**
 * RAG 问答（返回完整结果）
 *
 * 适合 Playground 中的"一键问答"，不流式输出
 */
export async function ragQuery(
  vectorStore: VectorStore,
  question: string,
  topK: number = 3
): Promise<RagResult> {
  // 1. 检索
  const { documents, sources } = await retrieveDocuments(
    vectorStore,
    question,
    topK
  );

  // 2. 组装 Prompt
  const messages = buildRagPrompt(documents, question);

  // 3. LLM 生成
  const deepseek = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

  const response = await deepseek.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages,
    temperature: 0.3, // RAG 场景低温度，更精准
    max_tokens: 2048,
  });

  const answer = response.choices[0]?.message?.content || "";

  return { answer, sources };
}

// ============================================
// RAG 问答（流式）
// ============================================

/**
 * RAG 流式问答 — 逐块返回
 *
 * 流程：
 * 1. 先检索（同步）
 * 2. 再流式生成（SSE）
 * 3. 最后返回引用来源
 *
 * 适用于聊天界面，用户体验更好
 */
export async function ragQueryStream(
  vectorStore: VectorStore,
  question: string,
  onChunk: (chunk: string) => void,
  onSources: (sources: SourceInfo[]) => void,
  onError: (error: string) => void,
  onDone: () => void,
  topK: number = 3
): Promise<void> {
  try {
    // 1. 检索文档
    const { documents, sources } = await retrieveDocuments(
      vectorStore,
      question,
      topK
    );

    // 先返回引用来源（前端可以先显示"正在搜索到 N 篇相关文档"）
    onSources(sources);

    // 如果没找到相关文档
    if (sources.length === 0) {
      onChunk(
        "根据当前知识库，我没有找到与您问题相关的文档内容。请尝试上传相关文档后再提问。"
      );
      onDone();
      return;
    }

    // 2. 组装 Prompt
    const messages = buildRagPrompt(documents, question);

    // 3. 流式调用 DeepSeek
    const deepseek = new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const stream = await deepseek.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      stream: true,
    });

    // 4. 逐块返回
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        onChunk(content);
      }
    }

    onDone();
  } catch (err) {
    const message = err instanceof Error ? err.message : "RAG 查询出错";
    onError(message);
  }
}
