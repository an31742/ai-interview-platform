/**
 * 天气查询工具
 *
 * 模拟查询实时天气数据
 * 实际项目中应该调用真实天气 API（如和风天气、OpenWeatherMap）
 */

import type { Tool } from "./registry";

export const weatherTool: Tool = {
  name: "get_weather",
  description: "查询指定城市的实时天气信息，包括温度、天气状况、湿度和风力",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: '城市名称，如"北京"、"上海"、"广州"',
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "温度单位，默认摄氏度",
      },
    },
    required: ["location"],
  },

  async execute(args) {
    const location = args.location as string;
    const unit = (args.unit as string) || "celsius";

    if (!location) {
      return "请提供城市名称";
    }

    // 模拟天气数据（实际项目应调用真实 API）
    const weatherData = getMockWeather(location);

    const tempStr =
      unit === "fahrenheit"
        ? `${celsiusToFahrenheit(weatherData.temperature)}°F`
        : `${weatherData.temperature}°C`;

    return JSON.stringify({
      location: weatherData.location,
      temperature: tempStr,
      condition: weatherData.condition,
      humidity: `${weatherData.humidity}%`,
      wind: weatherData.wind,
      advice: weatherData.advice,
    });
  },
};

/** 模拟天气数据库 */
const MOCK_WEATHER: Record<
  string,
  { temperature: number; condition: string; humidity: number; wind: string; advice: string }
> = {
  Beijing: {
    temperature: 22,
    condition: "晴",
    humidity: 45,
    wind: "东南风 3级",
    advice: "适宜户外活动，紫外线中等，建议涂抹防晒霜",
  },
  Shanghai: {
    temperature: 26,
    condition: "多云",
    humidity: 65,
    wind: "南风 2级",
    advice: "体感舒适，建议带伞以防阵雨",
  },
  Guangzhou: {
    temperature: 32,
    condition: "雷阵雨",
    humidity: 80,
    wind: "西南风 2级",
    advice: "天气闷热，注意防暑降温，外出请带伞",
  },
  Shenzhen: {
    temperature: 30,
    condition: "多云转阴",
    humidity: 75,
    wind: "东风 3级",
    advice: "适合室内活动，建议携带雨具",
  },
};

function getMockWeather(location: string) {
  // 北京的各种写法映射
  const alias: Record<string, string> = {
    北京: "Beijing",
    北京市: "Beijing",
    上海: "Shanghai",
    上海市: "Shanghai",
    广州: "Guangzhou",
    广州市: "Guangzhou",
    深圳: "Shenzhen",
    深圳市: "Shenzhen",
  };

  const normalized = alias[location] || location;
  const data = MOCK_WEATHER[normalized];

  if (data) {
    return { location: normalized, ...data };
  }

  // 未知城市返回随机数据
  return {
    location,
    temperature: 25,
    condition: "多云",
    humidity: 60,
    wind: "微风",
    advice: "天气信息仅供参考",
  };
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}
