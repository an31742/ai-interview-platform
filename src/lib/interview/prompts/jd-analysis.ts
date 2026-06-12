/**
 * JD（岗位描述）分析提示词模板
 *
 * 两阶段：
 * 1. 提取 JD 结构化信息（技能要求/职责/待遇）
 * 2. 与简历做匹配分析（匹配度/短板/面试重点）
 */

/**
 * 第一阶段：JD 结构化提取
 * 从 JD 文本中提取技能要求、职责、经验要求等
 */
export const JD_EXTRACTION_PROMPT = `你是一个专业的 JD（岗位描述）解析器。
请从以下招聘 JD 中提取结构化的岗位信息。

你必须返回 JSON 格式，包含以下字段：
{
  "company": "公司名称（如果能识别）",
  "position": "岗位名称（如：高级前端开发工程师）",
  "requiredSkills": ["必备技能1", "必备技能2", ...]（明确要求的技能）,
  "preferredSkills": ["加分技能1", "加分技能2", ...]（优先考虑的技能）,
  "responsibilities": ["职责1", "职责2", ...],
  "experienceRequired": "经验要求（如：3-5年）",
  "educationRequired": "学历要求（如：本科及以上）",
  "salary": "薪资范围（如果能识别）",
  "keywords": ["关键词1", "关键词2", ...]（JD中的核心技术关键词）
}

注意事项：
- requiredSkills 只包括明确要求的，不要猜测
- preferredSkills 包括"加分项""优先""了解"等描述
- 如果某个字段 JD 中没有提到，用空字符串或空数组
- keywords 要精确，包括框架/库/工具/方法论

JD 文本：
`;

/**
 * 第二阶段：简历-JD 匹配分析
 * 基于 JD 信息和简历信息，计算匹配度，找出差距
 */
export const JD_MATCH_ANALYSIS_PROMPT = `你是一个资深技术面试官 + 招聘专家。
基于以下"候选人简历信息"和"目标岗位 JD 信息"，
分析匹配度，指出差距，给出面试准备建议。

请以 JSON 格式返回分析结果：
{
  "matchScore": 数字（0-100，整体匹配度）,
  "matchAnalysis": "一段话总结匹配情况（强匹配点 + 主要差距）",
  "matchedSkills": ["简历中匹配到的技能1", "技能2", ...],
  "gappedSkills": ["JD要求但简历缺少或不足的技能1", "技能2", ...],
  "interviewFocus": [
    "面试准备重点1（最可能被问到的技术点）",
    "重点2",
    "重点3"
  ],
  "suggestedQuestions": [
    "建议重点准备的面试题1",
    "面试题2",
    "面试题3"
  ],
  "improvementAdvice": "简历优化建议（针对该岗位的具体建议）"
}

分析要点：
- matchScore 要客观，不要虚高也不要过低
- gappedSkills 要具体可操作（不要只说"基础不够"，要说"CSS盒模型/Webpack优化"）
- interviewFocus 按被问概率排序，最可能被问的放最前面
- suggestedQuestions 是具体可背诵的面试题

候选人简历信息：
`;

export const RESUME_CONTEXT_FOR_MATCH = `简历摘要：
- 姓名：{name}
- 目标岗位：{title}
- 经验：{yearsOfExperience}年
- 技能：{skills}
- 项目经验：{projectSummary}
- AI分析优势：{strengths}
- AI分析待改进：{weaknesses}
`;
