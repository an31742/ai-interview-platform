/**
 * 复盘分析提示词模板
 *
 * 从非结构化的面试记录中提取：
 * - 公司/岗位信息
 * - 逐题分析（面试官原话/你的回答/正确答案/错误类型）
 * - 暴露的短板标签
 * - 改进建议
 */

export const REVIEW_EXTRACTION_PROMPT = `你是一个专业的面试复盘分析师。
请从以下面试记录中提取结构化的复盘信息。

你可以识别任意格式的面试记录——可能是自由文本、对话形式、或者结构化的问答列表。
尽力从中提取尽可能多的信息。

你必须返回 JSON 格式：
{
  "company": "公司名称（如果能识别，否则用空字符串）",
  "position": "岗位名称（如果能识别）",
  "date": "面试日期（如果能识别，格式 YYYY-MM-DD）",
  "result": "pass | fail | pending（根据上下文判断）",
  "summary": "一段话总结这场面试的表现和结果",
  "weaknessTags": ["暴露的短板1", "短板2", ...]（从回答中暴露的技术短板）,
  "actionItems": ["改进项1", "改进项2", ...],
  "questions": [
    {
      "original": "面试官的原问题",
      "yourAnswer": "你的回答内容（从记录中提取）",
      "score": 数字（0-10，基于回答质量评分）,
      "correctAnswer": "标准答案（基于你的经验水平给出）",
      "mistakeType": "concept-error（概念错误）| expression（表达问题）| depth（深度不足）| structure（结构混乱）",
      "prepStructure": {
        "point": "一句话结论",
        "reason": "为什么这么设计",
        "example": "项目中的实际例子",
        "restate": "总结"
      }
    }
  ]
}

注意事项：
- questions 数组要完整提取所有能识别的问题
- 即使记录中只有问题没有答案，也尽量提取问题并给出标准答案
- mistakeType 要判断准确，不确切的用 "depth"（深度不足）
- weaknessTags 从答错的问题中提炼技术标签
- score 要客观，基于回答的准确性和完整性

面试记录：
`;
