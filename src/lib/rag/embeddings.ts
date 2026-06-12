/**
 * Embedding 模型工厂
 *
 * 支持两种 Embedding 模型：
 * 1. OpenAI text-embedding-3-small — 默认，高质量
 * 2. BGE (BAAI/bge-base-zh-v1.5) — 需安装 @huggingface/inference
 *
 * 切换非常方便：
 *   RAG_EMBEDDING_PROVIDER=openai  # 使用 OpenAI
 *   RAG_EMBEDDING_PROVIDER=bge     # 使用 BGE
 */

import { OpenAIEmbeddings } from "@langchain/openai";
import type { Embeddings } from "@langchain/core/embeddings";
import type { EmbeddingModel } from "@/types/rag";

export async function createEmbeddings(
  provider: EmbeddingModel = "openai"
): Promise<Embeddings> {
  switch (provider) {
    case "openai":
      return createOpenAIEmbeddings();
    case "bge":
      return createBGEEmbeddings();
    default:
      return createOpenAIEmbeddings();
  }
}

function createOpenAIEmbeddings(): OpenAIEmbeddings {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY 未配置。请在 .env.local 中设置，\n" +
        "或设置 RAG_EMBEDDING_PROVIDER=bge 使用免费 BGE。"
    );
  }
  return new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey,
    dimensions: 768,
  });
}

/**
 * BGE Embedding (动态加载，按需安装依赖)
 *
 * 使用方式：
 *   1. npm install @huggingface/inference
 *   2. 在 .env.local 中设置 RAG_EMBEDDING_PROVIDER=bge
 *
 * 模型: BAAI/bge-base-zh-v1.5 (768维，中文优秀)
 */
async function createBGEEmbeddings(): Promise<Embeddings> {
  try {
    const { HuggingFaceInferenceEmbeddings } = await import(
      "@langchain/community/embeddings/hf"
    );
    return new HuggingFaceInferenceEmbeddings({
      model: "BAAI/bge-base-zh-v1.5",
      apiKey: process.env.HF_API_KEY || undefined,
    });
  } catch {
    throw new Error(
      "BGE Embedding 需要额外依赖。\n" +
        "请运行: npm install @huggingface/inference\n" +
        "或使用默认的 OpenAI Embedding。"
    );
  }
}
