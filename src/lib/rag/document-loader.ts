/**
 * 文档加载器
 *
 * 从 PDF 文件中提取纯文本，为后续切片做准备。
 *
 * 使用 pdf-parse 库解析 PDF：
 * - 提取所有页面文本
 * - 保留段落结构（换行符）
 * - 不处理图片/表格（纯文本 RAG）
 *
 * 面试问题：
 * Q: PDF 解析后表格数据丢失怎么办？
 * A: 可以结合 OCR（如 PaddleOCR）或专门的表格解析工具（如 Camelot、Tabula）
 *    将表格转为 Markdown 格式后再索引。
 *
 * Q: 如何处理扫描件 PDF？
 * A: 扫描件本质是图片，需要 OCR 引擎（如 Tesseract、Azure Document Intelligence）
 *    pdf-parse 不支持扫描件，需要先用 OCR 转文本。
 */

import { Document } from "@langchain/core/documents";

/**
 * PDF 解析结果
 */
export interface PdfParseResult {
  text: string;
  pageCount: number;
  metadata: Record<string, string>;
}

/**
 * 解析 PDF 文件为纯文本
 *
 * @param fileBuffer - PDF 文件的二进制数据
 * @param filename - 原始文件名（用于元数据）
 * @returns 解析后的文本 + 元数据
 */
export async function parsePdf(
  fileBuffer: Buffer,
  filename: string
): Promise<PdfParseResult> {
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({ data: fileBuffer });

  const textResult = await parser.getText();

  return {
    text: textResult.text,
    pageCount: textResult.total,
    metadata: {
      filename,
      pageCount: String(textResult.total),
      fileSize: String(fileBuffer.length),
    },
  };
}

/**
 * 从解析结果创建 LangChain Document
 */
export function createDocumentFromPdf(
  result: PdfParseResult,
  additionalMeta: Record<string, string> = {}
): Document {
  return new Document({
    pageContent: result.text,
    metadata: {
      ...result.metadata,
      ...additionalMeta,
    },
  });
}
