/**
 * 计算器工具
 *
 * 安全地执行数学表达式计算
 * 使用 Function 构造函数（只计算，不访问变量），比 eval 更安全
 */

import type { Tool } from "./registry";

export const calculatorTool: Tool = {
  name: "calculate",
  description: "执行数学计算，支持 +、-、*、/、幂运算、三角函数等。输入数学表达式，返回计算结果",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "数学表达式，例如 '2 + 3 * 4'、'sqrt(16)'、'sin(45)'",
      },
    },
    required: ["expression"],
  },

  async execute(args) {
    const expression = (args.expression as string) || "";

    if (!expression.trim()) {
      return "请提供数学表达式";
    }

    // 安全检查：只允许数字、运算符、括号、数学函数
    const allowed = /^[\d\s+\-*/().,e%^]|sin|cos|tan|sqrt|abs|round|floor|ceil|pi|pow|log|max|min|E/g;
    const sanitized = expression.replace(allowed, "");
    if (sanitized.length > 0) {
      return `表达式中包含非法字符: "${sanitized}"`;
    }

    try {
      // 使用 Function 代替 eval（更安全，不访问外部作用域）
      const fn = new Function(
        "Math",
        `return (${expression
          .replace(/\^/g, "**")
          .replace(/sin/g, "Math.sin")
          .replace(/cos/g, "Math.cos")
          .replace(/tan/g, "Math.tan")
          .replace(/sqrt/g, "Math.sqrt")
          .replace(/abs/g, "Math.abs")
          .replace(/round/g, "Math.round")
          .replace(/floor/g, "Math.floor")
          .replace(/ceil/g, "Math.ceil")
          .replace(/pi/gi, "Math.PI")
          .replace(/log/g, "Math.log")
          .replace(/pow/g, "Math.pow")})`
      );
      const result = fn(Math);
      return String(result);
    } catch (err) {
      return `计算错误: ${err instanceof Error ? err.message : "表达式格式不正确"}`;
    }
  },
};
