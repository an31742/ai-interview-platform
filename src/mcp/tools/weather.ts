/**
 * 天气查询 Tool
 *
 * 提供一个获取城市天气信息的 MCP Tool。
 * 使用模拟数据，生产环境应接入真实天气 API。
 */
export const weatherTool = {
  name: "get_weather",
  description: "查询指定城市的实时天气信息，包含温度、天气状况、湿度、风力",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "城市名称，如 北京、上海、广州",
      },
    },
    required: ["location"],
  },
};

/** 模拟天气数据库 */
const MOCK_WEATHER: Record<string, {
  temperature: number;
  condition: string;
  humidity: number;
  wind: string;
  advice: string;
}> = {
  Beijing: { temperature: 22, condition: "晴", humidity: 45, wind: "东南风 3级", advice: "适宜户外活动，紫外线中等" },
  Shanghai: { temperature: 26, condition: "多云", humidity: 65, wind: "南风 2级", advice: "体感舒适，建议带伞以防阵雨" },
  Guangzhou: { temperature: 32, condition: "雷阵雨", humidity: 80, wind: "西南风 2级", advice: "天气闷热，注意防暑降温" },
  Shenzhen: { temperature: 30, condition: "多云转阴", humidity: 75, wind: "东风 3级", advice: "适合室内活动" },
};

const CITY_ALIAS: Record<string, string> = {
  "北京": "Beijing", "北京市": "Beijing",
  "上海": "Shanghai", "上海市": "Shanghai",
  "广州": "Guangzhou", "广州市": "Guangzhou",
  "深圳": "Shenzhen", "深圳市": "Shenzhen",
};

export async function executeWeather(args: Record<string, unknown>): Promise<string> {
  const location = String(args.location || "");
  if (!location) return "请提供城市名称";

  const normalized = CITY_ALIAS[location] || location;
  const data = MOCK_WEATHER[normalized];

  if (!data) {
    // 未知城市返回默认数据
    return JSON.stringify({
      location,
      temperature: 25,
      condition: "多云",
      humidity: 60,
      wind: "微风",
      advice: "天气信息仅供参考",
    });
  }

  return JSON.stringify({
    location: normalized,
    temperature: `${data.temperature}°C`,
    condition: data.condition,
    humidity: `${data.humidity}%`,
    wind: data.wind,
    advice: data.advice,
  });
}
