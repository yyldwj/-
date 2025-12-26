
import { GoogleGenAI } from "@google/genai";
import { AIConfig } from "../types";

export async function analyzeLogs(logs: string, config: AIConfig): Promise<string> {
  const prompt = `
    你是一位资深的嵌入式系统工程师和通信协议专家。
    以下是一段串口通信日志（Serial Port Logs）。
    请对日志进行深入分析，重点关注以下几点：
    
    1. **协议识别**：分析通信模式，识别是否使用了标准协议（如 Modbus, AT 指令, NMEA-0183 等）或者是某种自定义帧结构。
    2. **数据解析**：尝试解读数据帧的含义（例如：命令头、数据长度、有效载荷、校验和）。
    3. **异常检测**：指出任何潜在的通信错误、超时、重试或异常的数据模式。
    4. **调试建议**：如果存在问题，请提供具体的排查步骤或建议。

    日志数据 (Log Data):
    ${logs.slice(-5000)} 

    请使用专业的中文进行回答，并使用 Markdown 格式优化排版。
  `;

  try {
    // Google Gemini Handler
    if (config.provider === 'gemini') {
      if (!config.apiKey) throw new Error("请配置 Gemini API Key");
      
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const model = config.model || "gemini-2.0-flash";
      
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text || "无法生成分析结果。";
    } 
    
    // OpenAI Compatible Handler (DeepSeek, Grok, GPT, Custom)
    else {
      if (!config.apiKey) throw new Error(`请配置 ${config.provider} API Key`);
      if (!config.baseUrl) throw new Error("API Base URL 不能为空");

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: '你是专业的嵌入式串口调试助手。' },
            { role: 'user', content: prompt }
          ],
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`请求失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "无内容生成";
    }

  } catch (error) {
    console.error("AI Analysis Error:", error);
    return `**AI 分析错误**:\n\n${(error as Error).message}\n\n请检查配置里的 API Key、模型名称和 Base URL 是否正确。`;
  }
}
