/**
 * RAG 知识库问答系统类型定义
 */

/** 文档状态 */
export type DocumentStatus = "processing" | "ready" | "error";

/** 已索引的文档 */
export interface RagDocument {
  id: string;
  filename: string;
  status: DocumentStatus;
  chunkCount: number;
  fileSize: number;        // bytes
  uploadedAt: number;
  error?: string;
}

/** 文档引用来源 */
export interface SourceInfo {
  filename: string;        // 来源文件名
  chunkIndex: number;      // 切片序号
  content: string;         // 切片内容预览
  score: number;           // 相似度分数
}

/** RAG 查询响应 */
export interface RagQueryResponse {
  answer: string;
  sources: SourceInfo[];
}

/** Embedding 模型类型 */
export type EmbeddingModel = "openai" | "bge";

/** Embedding 模型配置 */
export interface EmbeddingConfig {
  provider: EmbeddingModel;
  modelName: string;
  dimension: number;
  description: string;
}

/** 支持的 Embedding 模型列表 */
export const EMBEDDING_MODELS: EmbeddingConfig[] = [
  {
    provider: "openai",
    modelName: "text-embedding-3-small",
    dimension: 1536,
    description: "OpenAI 通用嵌入模型，质量高，费用低",
  },
  {
    provider: "bge",
    modelName: "BAAI/bge-base-zh-v1.5",
    dimension: 768,
    description: "开源中文嵌入模型，本地运行免费",
  },
];

/** RAG 配置参数 */
export interface RagConfig {
  embeddingProvider: EmbeddingModel;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
}

/** 默认 RAG 配置 */
export const DEFAULT_RAG_CONFIG: RagConfig = {
  embeddingProvider: "openai",
  chunkSize: 500,
  chunkOverlap: 100,
  topK: 3,
};
