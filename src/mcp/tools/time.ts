/**
 * 时间查询 Tool
 *
 * 提供获取指定时区当前时间的 MCP Tool。
 * 支持常见时区名称和中文别名。
 */
export const timeTool = {
  name: "get_time",
  description: "获取指定时区的当前日期和时间",
  inputSchema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "时区名称，如 Asia/Shanghai、America/New_York，或中文别名如 北京、纽约",
      },
    },
    required: ["timezone"],
  },
};

/** 常见时区别名 */
const TZ_ALIAS: Record<string, string> = {
  "北京": "Asia/Shanghai", "上海": "Asia/Shanghai", "中国": "Asia/Shanghai",
  "东京": "Asia/Tokyo", "日本": "Asia/Tokyo",
  "纽约": "America/New_York",
  "伦敦": "Europe/London",
  "巴黎": "Europe/Paris",
  "悉尼": "Australia/Sydney",
  "香港": "Asia/Hong_Kong",
  "新加坡": "Asia/Singapore",
  "首尔": "Asia/Seoul",
  "迪拜": "Asia/Dubai",
};

export async function executeTime(args: Record<string, unknown>): Promise<string> {
  const timezone = String(args.timezone || "").trim();
  if (!timezone) return "请提供时区";

  try {
    const tz = TZ_ALIAS[timezone] || timezone;
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("zh-CN", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, weekday: "long",
    });

    const parts = formatter.formatToParts(now);
    const data: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "literal") data[p.type] = p.value;
    }

    return JSON.stringify({
      timezone: tz,
      datetime: `${data.year}-${data.month}-${data.day} ${data.hour}:${data.minute}:${data.second}`,
      weekday: data.weekday,
      timestamp: now.getTime(),
    });
  } catch {
    return `不支持的时区: "${timezone}"。请使用 IANA 时区格式，如 Asia/Shanghai`;
  }
}
