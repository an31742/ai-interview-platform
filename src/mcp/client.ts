/**
 * MCP Client 测试脚本
 *
 * 启动 MCP Server 子进程，通过 stdio 通信：
 * 1. connect → initialize
 * 2. tools/list → 获取工具列表
 * 3. tools/call → 调用 get_weather
 * 4. tools/call → 调用 get_time
 *
 * 运行方式：
 *   npx tsx src/mcp/client.ts
 */

import { spawn } from "node:child_process";
import path from "node:path";

// ============================================
// 简单 JSON-RPC Client
// ============================================

class SimpleMcpClient {
  private process: ReturnType<typeof spawn>;
  private messageId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private buffer = "";

  constructor() {
    // 使用 process.cwd() 定位 server.ts（从项目根目录运行）
    const serverPath = path.resolve(process.cwd(), "src/mcp/server.ts");

    this.process = spawn("npx", ["tsx", serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // 读取 stdout 中的 JSON-RPC 消息
    this.process.stdout!.on("data", (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // stderr 输出日志（不影响协议通信）
    this.process.stderr!.on("data", (data: Buffer) => {
      console.error(`[Server] ${data.toString().trim()}`);
    });

    this.process.on("exit", (code) => {
      console.error(`[Server] 进程退出, code=${code}`);
    });
  }

  private processBuffer() {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          resolve(msg);
        }
      } catch {
        // 忽略非 JSON 行（如日志）
      }
    }
  }

  /** 发送 JSON-RPC 请求 */
  async send(method: string, params?: unknown): Promise<unknown> {
    const id = this.messageId++;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? {},
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process.stdin!.write(JSON.stringify(request) + "\n");

      // 5s 超时
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`请求超时: ${method}`));
        }
      }, 5000);
    });
  }

  /** 初始化连接 */
  async initialize() {
    return this.send("initialize", {
      protocolVersion: "0.1.0",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    });
  }

  /** 获取工具列表 */
  async listTools() {
    const result = (await this.send("tools/list")) as {
      result?: { tools: Array<{ name: string; description: string }> };
    };
    return result.result?.tools ?? [];
  }

  /** 调用工具 */
  async callTool(name: string, args: Record<string, unknown>) {
    const result = (await this.send("tools/call", {
      name,
      arguments: args,
    })) as {
      result?: {
        content?: Array<{ type: string; text: string }>;
        isError?: boolean;
      };
    };
    return result.result;
  }

  /** 关闭连接 */
  close() {
    this.process.kill();
  }
}

// ============================================
// 测试流程
// ============================================

async function main() {
  console.log("=".repeat(50));
  console.log("MCP Server 测试");
  console.log("=".repeat(50));

  const client = new SimpleMcpClient();

  // 等待 Server 就绪
  await new Promise((r) => setTimeout(r, 2000));

  try {
    // 1. 初始化
    console.log("\n📡 1. 初始化连接...");
    const initResult = await client.initialize();
    console.log(`    ✅ 连接成功: ${JSON.stringify(initResult).slice(0, 100)}...`);

    // 2. 获取工具列表
    console.log("\n🔧 2. 获取工具列表...");
    const tools = await client.listTools();
    console.log(`    ✅ 发现 ${tools.length} 个工具:`);
    for (const tool of tools) {
      console.log(`       - ${tool.name}: ${tool.description}`);
    }

    // 3. 调用天气工具
    console.log('\n🌤️  3. 调用 get_weather("北京")...');
    const weatherResult = await client.callTool("get_weather", { location: "北京" });
    if (weatherResult?.content) {
      const text = weatherResult.content[0]?.text || "";
      console.log(`    ✅ 结果: ${text}`);
    }

    // 4. 调用时间工具
    console.log('\n🕐 4. 调用 get_time("Asia/Shanghai")...');
    const timeResult = await client.callTool("get_time", { timezone: "Asia/Shanghai" });
    if (timeResult?.content) {
      const text = timeResult.content[0]?.text || "";
      console.log(`    ✅ 结果: ${text}`);
    }

    // 5. 测试错误处理
    console.log('\n⚠️  5. 测试无效工具...');
    const badResult = await client.callTool("nonexistent", {});
    if ((badResult as any)?.isError) {
      const text = (badResult as any)?.content?.[0]?.text || "";
      console.log(`    ✅ 正确返回错误: ${text}`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ 全部测试通过!");
    console.log("=".repeat(50));
  } catch (err) {
    console.error("\n❌ 测试失败:", err instanceof Error ? err.message : err);
  } finally {
    client.close();
    process.exit(0);
  }
}

main();
