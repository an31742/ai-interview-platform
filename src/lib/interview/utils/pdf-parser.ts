/**
 * PDF 文本解析器
 *
 * 使用 pdfjs-dist/legacy 在 Node.js 服务端直接解析 PDF。
 * legacy build 包含完整的 Node.js 兼容代码，无需配置 web worker。
 *
 * 为什么不用 pdf-parse v2？
 *   pdf-parse v2 的 worker 加载方式在 Next.js 服务端环境下会报错
 *   （找不到 worker 模块路径），所以直接使用底层的 pdfjs-dist。
 *
 * 为什么用 legacy build？
 *   pdfjs-dist 的 esm 构建依赖 DOMMatrix 等浏览器 API（Node.js 没有），
 *   legacy build 使用 polyfill 兼容 Node.js 环境。
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

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
  try {
    // 1. 加载 PDF 文档
    const loadingTask = getDocument({
      data: new Uint8Array(fileBuffer),
      useSystemFonts: true, // 使用系统字体，中文支持
    });

    const pdfDocument = await loadingTask.promise;

    // 2. 逐页提取文本
    const pages: string[] = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();

      // 按行聚合文本，保留段落结构
      let lastY: number | null = null;
      let text = "";

      for (const item of content.items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textItem = item as any;
        const y = textItem.transform?.[5] ?? 0;

        if (lastY !== null && Math.abs(y - lastY) > 5) {
          text += "\n";
        } else if (text.length > 0 && !text.endsWith("\n")) {
          text += " ";
        }

        text += textItem.str;
        lastY = y;
      }

      pages.push(text.trim());
    }

    // 3. 组合所有页面文本
    const fullText = pages
      .filter((p) => p.length > 0)
      .join("\n\n--- 第 --- 页---\n\n");

    return {
      text: fullText,
      pageCount: pdfDocument.numPages,
      metadata: {
        filename,
        pageCount: String(pdfDocument.numPages),
        fileSize: String(fileBuffer.length),
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PDF 解析失败";
    throw new Error(`PDF 解析错误: ${message}`);
  }
}
