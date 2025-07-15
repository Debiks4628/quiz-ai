/**
 * server.js
 * 依赖：express cors axios dotenv https-proxy-agent
 * .env 示例：
 *   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
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
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'; // 若控制台给 -intl 请改成 -intl
const MODEL = 'qwen-turbo';      // 无权限可换 qwen-turbo
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890'); // 如直连可删此行
const headers = {                   // ★★ 只补这一行，解决 “headers is not defined”
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

/* 生成题目 */
app.post('/api/generate', async (req, res) => {
  const { prompt, count } = req.body;
  try {
    const resp = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: '你是题目生成器，输出纯 JSON 数组，字段 difficulty(1~5)、question、answer、explanation' },
          { role: 'user', content: `基于“${prompt}”生成${count}题` }
        ],
        temperature: 0.9,
        top_p: 1,
        presence_penalty: 1
      },
      { headers, httpsAgent: proxyAgent, timeout: 45000 }
    );

    const raw = resp.data.choices[0].message.content.replace(/```json|```/g, '').trim();
    // res.json(JSON.parse(raw));
    {
      const arr = JSON.parse(raw);                 // 先转数组
      for (let i = arr.length - 1; i > 0; i--) {   // Fisher‑Yates 洗牌
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      res.json(arr);                               // 再返回
    }

  } catch (err) {
    console.error('❌ 生成失败：', err.response?.data || err.message);
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
