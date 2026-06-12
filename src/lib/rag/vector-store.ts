/**
 * 向量存储
 *
 * 支持两种模式：
 * 1. Chroma — 持久化向量数据库（生产推荐）
 * 2. MemoryStore — 内存 + JSON 文件（开发/演示，零依赖）
 *
 * 通过环境变量 CHROMA_URL 控制：
 * - 设置 CHROMA_URL → 使用 Chroma 服务器
 * - 未设置 → 使用内存模式
 */

import type { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";

// ============================================
// 向量存储接口
// ============================================

export interface VectorStore {
  /** 添加文档到向量库 */
  addDocuments: (docs: Document[]) => Promise<void>;

  /** 相似度检索 */
  similaritySearch: (
    query: string,
    k: number
  ) => Promise<Array<Document & { score: number }>>;

  /** 删除指定文档的向量 */
  deleteDocuments: (filename: string) => Promise<void>;

  /** 清空所有数据 */
  clear: () => Promise<void>;
}

// ============================================
// 向量存储工厂
// ============================================

export async function createVectorStore(
  embeddings: Embeddings,
  collectionName: string = "rag_knowledge"
): Promise<VectorStore> {
  const chromaUrl = process.env.CHROMA_URL;

  if (chromaUrl) {
    try {
      return await createChromaStore(embeddings, collectionName, chromaUrl);
    } catch (err) {
      console.warn("Chroma 连接失败，回退到内存模式:", err);
      return createMemoryStore(embeddings);
    }
  }

  console.log("使用内存向量存储（未检测到 CHROMA_URL）");
  return createMemoryStore(embeddings);
}

// ============================================
// Chroma 实现
// ============================================

async function createChromaStore(
  embeddings: Embeddings,
  collectionName: string,
  chromaUrl: string
): Promise<VectorStore> {
  const { Chroma } = await import("@langchain/community/vectorstores/chroma");
  const { ChromaClient } = await import("chromadb");

  const client = new ChromaClient({ path: chromaUrl });

  let store: InstanceType<typeof Chroma>;

  try {
    store = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: chromaUrl,
    });
  } catch {
    // 集合不存在，创建一个新的
    store = await Chroma.fromDocuments([], embeddings, {
      collectionName,
      url: chromaUrl,
    });
  }

  return {
    addDocuments: async (docs) => {
      await store.addDocuments(docs);
    },

    similaritySearch: async (query, k) => {
      const results = await store.similaritySearchWithScore(query, k);
      return results.map(([doc, score]) => ({
        ...doc,
        score: 1 - score, // Chroma 返回距离，转成相似度
      }));
    },

    deleteDocuments: async (filename) => {
      try {
        // 兼容 Chroma 类型约束
        await (store as unknown as { delete: (p: Record<string, unknown>) => Promise<void> }).delete({ filter: { filename } });
      } catch {
        // Chroma 不支持按条件删除时，跳过
      }
    },

    clear: async () => {
      try {
        await (store as unknown as { delete: (p: Record<string, unknown>) => Promise<void> }).delete({ filter: {} });
      } catch {
        // 忽略 Chroma 清空错误
      }
    },
  };
}

// ============================================
// 内存模式实现（零依赖，适合开发/演示）
// ============================================

function createMemoryStore(embeddings: Embeddings): VectorStore {
  let documents: Array<{
    doc: Document;
    vector: number[];
  }> = [];

  const persistPath = ".rag-data";

  /** 计算余弦相似度 */
  function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /** 持久化到 JSON 文件 */
  async function persist() {
    try {
      const fs = await import("fs/promises");
      await fs.mkdir(persistPath, { recursive: true });
      // 元数据（不含向量）持久化
      const meta = documents.map((d) => ({
        pageContent: d.doc.pageContent,
        metadata: d.doc.metadata,
      }));
      await fs.writeFile(
        `${persistPath}/docs.json`,
        JSON.stringify(meta, null, 2)
      );
    } catch {
      // 持久化失败不影响运行
    }
  }

  return {
    addDocuments: async (docs) => {
      const vectors = await embeddings.embedDocuments(
        docs.map((d) => d.pageContent)
      );

      documents.push(
        ...docs.map((doc, i) => ({
          doc,
          vector: vectors[i],
        }))
      );

      await persist();
    },

    similaritySearch: async (query, k) => {
      if (documents.length === 0) return [];

      const queryVector = await embeddings.embedQuery(query);

      // 计算所有文档与 query 的余弦相似度
      const scored = documents.map(({ doc, vector }) => ({
        ...doc,
        score: cosineSimilarity(queryVector, vector),
      }));

      // 取 Top-K
      return scored.sort((a, b) => b.score - a.score).slice(0, k);
    },

    deleteDocuments: async (filename) => {
      documents = documents.filter(
        (d) => d.doc.metadata?.filename !== filename
      );
      await persist();
    },

    clear: async () => {
      documents = [];
      try {
        const fs = await import("fs/promises");
        await fs.rm(`${persistPath}/docs.json`, { force: true });
      } catch {
        // ignore
      }
    },
  };
}
