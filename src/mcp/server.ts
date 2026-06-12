/**
 * MCP Server 入口
 *
 * 启动一个 MCP Server，通过 stdio 传输层与 Client 通信。
 * 提供天气查询和时间查询两个 Tool。
 *
 * 启动方式：
 *   npx tsx src/mcp/server.ts
 *
 * 协议流程：
 *   1. Client 连接 → initialize（版本协商）
 *   2. Client → tools/list  → Server 返回工具列表
 *   3. Client → tools/call  → Server 执行工具并返回结果
 *   4. Client 断开 → close
 */

import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, executeTool } from "./tools/index";

// ============================================
// 1. 创建 MCP Server
// ============================================

const server = new Server(
  {
    name: "ai-playground-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // 声明本 Server 支持 Tool 能力
    },
  }
);

// ============================================
// 2. 处理 tools/list — 返回工具列表
// ============================================
//
// MCP Client 连接后会调用 tools/list 来发现 Server 的能力。
// 返回的工具列表包含名称、描述和参数 Schema。
//
// Server 定义工具 → Client 自动发现 → 用户无需配置
//
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

// ============================================
// 3. 处理 tools/call — 执行工具
// ============================================
//
// 当 AI（或用户）决定调用某个工具时，Client 发送 tools/call 请求。
// Server 执行工具并返回结果。
//
// 结果格式：
//   { content: [{ type: "text", text: "..." }] }
//
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // request 经过 Zod Schema 验证，结构安全
  const { name, arguments: args } = request.params;

  if (!name) {
    return {
      content: [{ type: "text" as const, text: "错误: 未指定工具名称" }],
      isError: true,
    };
  }

  try {
    // 执行工具
    const result = await executeTool(name, (args as Record<string, unknown>) || {});

    return {
      content: [{ type: "text" as const, text: result }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "工具执行失败";

    return {
      content: [{ type: "text" as const, text: `错误: ${message}` }],
      isError: true,
    };
  }
});

// ============================================
// 4. 启动 Server
// ============================================

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // 输出到 stderr 避免干扰 stdout 的 MCP 协议通信
  console.error("✅ MCP Server 已启动");
  console.error(`   Server: ai-playground-mcp v1.0.0`);
  console.error(`   Tools: ${TOOLS.map((t) => t.name).join(", ")}`);
  console.error("   等待 MCP Client 连接...");
}

main().catch((err) => {
  console.error("❌ MCP Server 启动失败:", err.message);
  process.exit(1);
});
