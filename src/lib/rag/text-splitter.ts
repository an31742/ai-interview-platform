/**
 * 文本切片器 (Text Splitter)
 *
 * 为什么需要切片？
 * - LLM 上下文窗口有限
 * - 小片段检索更精确
 * - 降低 Token 成本
 *
 * 策略说明：
 * RecursiveCharacterTextSplitter 递归地尝试不同分隔符：
 *   先按 "\n\n"（段落）切 → 再按 "\n"（行）切 → 按 "。"切 → 按 "，"切
 * 保证每个 Chunk 大小尽量均匀，且语义完整
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * 文档切片配置
 */
export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

/**
 * 创建文本切片器
 *
 * @param config - 切片参数
 * @returns RecursiveCharacterTextSplitter 实例
 *
 * 参数说明：
 * - chunkSize: 每个切片的字符数（不是 Token 数）
 *   中文推荐 300-500，英文推荐 500-1000
 * - chunkOverlap: 相邻切片重叠字符数
 *   防止关键信息被切分边界切断
 *
 * 面试问题：
 * Q: chunk_size 设多大合适？
 * A: 取决于文档语言和检索粒度。
 *    中文 300-500，英文 500-1000。
 *    太小则上下文不完整，太大则检索不精确。
 *
 * Q: overlap 有什么用？
 * A: 保证边界信息不丢失。
 *    例如"注册资本认缴期限为五年"如果正好在
 *    "认缴"和"期限"之间被切开，overlap 保证
 *    两个 Chunk 都包含完整语义。
 */
export function createTextSplitter(config?: Partial<ChunkConfig>) {
  const chunkSize =
    (config?.chunkSize ?? Number(process.env.RAG_CHUNK_SIZE)) || 500;
  const chunkOverlap =
    (config?.chunkOverlap ?? Number(process.env.RAG_CHUNK_OVERLAP)) || 100;

  return new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    // 中文分隔符优先级
    separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
    lengthFunction: (text) => text.length, // 按字符数而非 Token 数计算
  });
}

/**
 * 将文档分割为 Chunk
 *
 * @param text - 原始文本
 * @param config - 切片配置
 * @param metadata - 附加元数据（如文件名）
 * @returns 带元数据的 Chunk 数组
 */
export async function splitDocument(
  text: string,
  metadata: Record<string, string> = {},
  config?: Partial<ChunkConfig>
) {
  const splitter = createTextSplitter(config);
  const documents = await splitter.createDocuments([text]);

  // 为每个 Chunk 添加元数据
  return documents.map((doc, index) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      ...metadata,
      chunkIndex: String(index),
      totalChunks: String(documents.length),
    },
  }));
}
