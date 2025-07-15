/**
 * server.js  – 直接复制覆盖
 * 依赖：express cors axios dotenv https-proxy-agent
 * .env 示例：
 *   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   # PROXY_URL=http://127.0.0.1:7890   ← 如需走本地/公司代理再加
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
app.use(cors());
app.use(express.json());

/* === 配置 === */
const API_KEY = process.env.DASHSCOPE_API_KEY;
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'; // 若控制台是 -intl 改这里
const MODEL = 'qwen-turbo';      // 无权限可换 qwen-plus
const headers = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

/* ───────── 代理可选 ───────── */
const axiosCfg = { headers, timeout: 45000 };
if (process.env.PROXY_URL) {
  axiosCfg.httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL);
  console.log('🌐 使用代理:', process.env.PROXY_URL);
}

/* 生成题目 */
app.post('/api/generate', async (req, res) => {
  const { prompt, count } = req.body;
  try {
    const r = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: '你是题目生成器，输出纯 JSON 数组，字段 difficulty(1~5)、question、answer、explanation' },
          { role: 'user', content: `基于“${prompt}”生成${count}题` }
        ],
        temperature: 0.9, top_p: 1, presence_penalty: 1
      },
      axiosCfg
    );

    // const raw = r.data.choices[0].message.content.replace(/```json|```/g,'').trim();
    // const arr = JSON.parse(raw);

    
    let content = r.data.choices[0].message.content.trim();
    // ① 提取 ```json ... ``` 里的主体；若无代码块则退而求其次
    const m = content.match(/```(?:json)?\\s*([\\s\\S]+?)\\s*```/i);
    let jsonText;
    if (m) {
      jsonText = m[1].trim();
    } else {
      const first = content.indexOf('[');
      const last = content.lastIndexOf(']');
      jsonText = content.slice(first, last + 1);
    }
    const arr = JSON.parse(jsonText);     // ← 现在不会再报错


    for (let i = arr.length - 1; i > 0; i--) {       // 洗牌防止首题固定
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    res.json(arr);

  } catch (e) {
    console.error('❌ 生成失败：', e.response?.data || e.message);
    res.status(500).json({ error: '生成失败' });
  }
});

/* 批阅答案 */
app.post('/api/grade', (req, res) => {
  const graded = req.body.answers.map(a => ({
    index: a.index,
    isCorrect: a.userAns.trim() === a.correct,
    explanation: a.userAns.trim() === a.correct ? '回答正确' : `参考答案：${a.correct}`
  }));
  res.json(graded);
});

app.listen(3000, () =>
  console.log('✅ Server listening on http://localhost:3000')
);
