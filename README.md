# Nightcord Nako Chatbot API

<div align="center">

![GitHub License](https://img.shields.io/github/license/25-ji-code-de/nako?style=flat-square&color=884499)
![GitHub stars](https://img.shields.io/github/stars/25-ji-code-de/nako?style=flat-square&color=884499)
![GitHub forks](https://img.shields.io/github/forks/25-ji-code-de/nako?style=flat-square&color=884499)
![GitHub issues](https://img.shields.io/github/issues/25-ji-code-de/nako?style=flat-square&color=884499)
![GitHub last commit](https://img.shields.io/github/last-commit/25-ji-code-de/nako?style=flat-square&color=884499)
![GitHub repo size](https://img.shields.io/github/repo-size/25-ji-code-de/nako?style=flat-square&color=884499)
[![CodeFactor](https://img.shields.io/codefactor/grade/github/25-ji-code-de/nako?style=flat-square&color=884499)](https://www.codefactor.io/repository/github/25-ji-code-de/nako)

</div>

一个基于 Cloudflare Workers AI 的聊天机器人 API，具有动态人格系统和智能表情推荐功能。

## 功能

- **无状态设计**：不使用数据库，对话历史由前端传入
- **AI 模型**：使用 Cloudflare Workers AI 的 Qwen 3 30B 模型
- **响应模式**：支持流式（SSE）和非流式两种响应方式
- **表情推荐**：基于 Vectorize 向量搜索的表情包推荐功能
- **角色扮演**：基于预设人格配置生成对话回复
- **CORS 支持**：可直接从前端调用
- **TypeScript**：完整的类型定义

## API 接口

所有 API 接口都需要 SEKAI Pass 认证。请在请求头中包含有效的 access token：

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

如果未提供或 token 无效，将返回 401 Unauthorized 错误。

### POST /api/chat

发送消息给 Nako 并获取回复。

### POST /api/recommend

根据文本内容推荐表情包。

#### 非流式模式（默认）

**请求体：**
```json
{
  "userId": "UserA",
  "message": "今天天气真好啊",
  "history": [
    {
      "userId": "UserB",
      "message": "早上好",
      "isBot": false
    },
    {
      "userId": "Nako",
      "message": "哼...早什么早",
      "isBot": true
    }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "response": "哼,天气好又怎样...[stamp0004]",
  "reasoningContent": "思考过程（如果模型支持）",
  "usage": {
    "promptTokens": 411,
    "completionTokens": 187,
    "totalTokens": 598
  }
}
```

**响应格式说明：**
- `success`: 请求是否成功
- `response`: Nako 的回复文本，表情包以 `[stamp0004]` 格式嵌入在文本中
- `reasoningContent`: （可选）模型的内部推理过程（从 `choices[0].message.reasoning_content` 提取）
- `usage`: Token 使用统计
  - `promptTokens`: 输入 token 数（系统提示词 + 历史记录 + 用户消息）
  - `completionTokens`: 回复 token 数
  - `totalTokens`: 总 token 数

**注意：**
- 表情包通过向量搜索自动推荐，以 `[assetbundleName]` 格式插入回复文本末尾
- `reasoningContent` 字段仅在模型支持时返回，Qwen 3 30B 通常不支持此功能

#### 流式模式

**请求体：**
```json
{
  "userId": "UserA",
  "message": "今天天气真好啊",
  "stream": true,
  "history": []
}
```

**响应：**
Server-Sent Events (SSE) 流，`Content-Type: text/event-stream`

流式响应遵循 OpenAI Chat Completion 格式，每个数据块包含部分回复：

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"哼"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"，"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"天气"},"logprobs":null,"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"@cf/qwen/qwen3-30b-a3b-fp8","choices":[{"index":0,"delta":{"content":"好"},"logprobs":null,"finish_reason":null}]}

data: [DONE]
```

**注意：** 表情包推荐会在流结束前作为额外的 chunk 追加到回复末尾。

### POST /api/recommend

根据文本提示推荐表情包。

**请求体：**
```json
{
  "prompt": "好开心啊",
  "excludeRecent": ["之前的消息1", "之前的消息2[stamp0001]"],
  "topK": 5
}
```

**参数：**
- `prompt` (必需): 用于搜索匹配表情包的文本描述
- `excludeRecent` (可选): 最近消息数组，用于提取并排除已使用的表情包
- `topK` (可选): 返回的表情包数量（1-20，默认：5）

**响应：**
```json
{
  "success": true,
  "stickers": [
    {
      "assetbundleName": "stamp0004",
      "name": "流歌：好开心啊",
      "score": 0.8234
    },
    {
      "assetbundleName": "stamp0123",
      "name": "铃：一起加油吧～！",
      "score": 0.7891
    },
    {
      "assetbundleName": "stamp0456",
      "name": "未来：请多关照",
      "score": 0.7654
    }
  ],
  "query": "好开心啊"
}
```

**字段说明：**
- `assetbundleName`: 表情包标识符
- `name`: 表情包显示名称
- `score`: 相似度分数（0-1，越高越匹配）

**示例（POST）：**
```bash
curl -X POST https://your-worker.workers.dev/api/recommend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "prompt": "开心快乐",
    "topK": 3
  }'
```

### GET /api/recommend

使用查询参数的 GET 方式，功能与 POST 相同。

**查询参数：**
- `prompt` (必需): 文本描述
- `topK` (可选): 返回结果数量（1-20，默认：5）
- `excludeRecent` (可选): 逗号分隔的最近消息列表

**示例（GET）：**
```bash
curl "https://your-worker.workers.dev/api/recommend?prompt=开心快乐&topK=3" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**带排除项：**
```bash
curl "https://your-worker.workers.dev/api/recommend?prompt=开心&excludeRecent=之前用过[stamp0001],另一条消息" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 开发

### 环境要求

- Node.js 18+
- Cloudflare 账号（需开通 Workers AI）

### 本地开发

1. 克隆仓库：
```bash
git clone https://github.com/25-ji-code-de/nako.git
cd nako
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
```bash
# 复制示例配置
cp .env.example .env
cp wrangler.jsonc.example wrangler.jsonc

# 编辑 .env 填入你的 Cloudflare 配置
# 编辑 wrangler.jsonc 配置你的域名（可选）
```

4. 启动本地服务：
```bash
npm run dev
```

5. 测试 API：

**非流式：**
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "userId": "TestUser",
    "message": "你好啊Nako",
    "history": []
  }'
```

**流式：**
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "userId": "TestUser",
    "message": "你好啊Nako",
    "stream": true,
    "history": []
  }'
```

### 部署

#### 1. 登录 Cloudflare

```bash
npx wrangler login
```

#### 2. 本地配置文件

```bash
cp wrangler.jsonc.example wrangler.jsonc
# 编辑 wrangler.jsonc：填入 AUTH_DB / DB 的 database_id，按需改 name / 路由
```

本地 LLM 密钥（openai 人设）写入 **`.dev.vars`**（勿提交）：

```bash
# 参考 .env.example
OPENAI_ENDPOINT=https://your-openai-compatible-gateway.example
OPENAI_API_KEY=sk-...
```

#### 3. 生产 Secrets

```bash
npx wrangler secret put OPENAI_ENDPOINT   # 你的 OpenAI 兼容网关根 URL
npx wrangler secret put OPENAI_API_KEY

# 可选：覆盖某个人设模型（注册 id 大写）
# npx wrangler secret put OPENAI_MODEL_ASAGI
# npx wrangler secret put WORKERS_AI_MODEL   # Nako 用 Workers AI 时
```

Workers AI、Vectorize、D1 绑定在 `wrangler.jsonc` 里配置，不需要 secret 写模型路径（除非你要覆盖 `WORKERS_AI_MODEL`）。

#### 4. 发布

```bash
npm run deploy
# 等价: npx wrangler deploy
```

部署成功后终端会打印 `*.workers.dev` 地址。自定义域名在 `wrangler.jsonc` 的 `routes` 里配置。

#### 5. 冒烟测试

```bash
# 经 Worker（含鉴权 + 真人设 prompt）
curl -X POST https://你的域名/api/chat?persona=miku \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 你的_SEKAI_PASS_TOKEN" \
  -d "{\"userId\":\"TestUser\",\"message\":\"今天好累啊\",\"history\":[]}"

# 本地直连网关（不经 Worker / 鉴权；prompt 为精简副本，只验模型可达与粗语气）
npm run smoke:personas
# 读取 .dev.vars 的 OPENAI_*
```

表情包 Vectorize 见 [STICKER_DEPLOYMENT.md](./STICKER_DEPLOYMENT.md)（可选，未绑定时聊天仍可用、只是无贴纸）。

## 项目结构

```
nightcord-nako/
├── src/
│   ├── index.ts              # Worker 入口
│   ├── handlers/
│   │   ├── chat.ts           # 聊天请求处理
│   │   └── recommend.ts      # 表情推荐处理
│   ├── middleware/
│   │   └── auth.ts           # SEKAI Pass 认证中间件
│   ├── services/
│   │   ├── ai.ts             # AI 服务封装
│   │   └── sticker.ts        # 表情搜索服务
│   ├── models/               # Workers AI / OpenAI 兼容 Provider
│   │   └── format-history.ts # 群聊历史 → role messages（两 Provider 共用）
│   ├── personas/             # 多人设（provider / model / modelConfig / prompt）
│   ├── config/
│   │   ├── llm.ts            # endpoint / key / model 解析（Env 优先）
│   │   └── persona.ts        # 遗留 Nako prompt 辅助
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   └── utils/
│       ├── validation.ts     # 请求验证
│       └── response.ts       # 响应格式化
├── scripts/
│   ├── smoke-personas.mjs    # 本地 openai 人设抽检（精简 prompt）
│   ├── prepare-stickers.ts   # 预处理表情数据
│   ├── upload-vectors.ts     # 上传到 Vectorize
│   └── test-search.ts        # 本地测试搜索
├── wrangler.jsonc.example    # Cloudflare Workers 配置示例
├── stickers.json             # 表情数据库
├── package.json
├── tsconfig.json
├── README.md
└── STICKER_DEPLOYMENT.md     # 表情配置指南
```

## 配置说明

### LLM API（endpoint / key / 每人设独立 model）

人设可选 `workers-ai` 或 `openai`（任意 OpenAI 兼容网关）。

```bash
# 生产 Secrets
npx wrangler secret put OPENAI_ENDPOINT
npx wrangler secret put OPENAI_API_KEY

# 可选：只改某个人设的模型（注册 id 大写，如 asagi → OPENAI_MODEL_ASAGI）
npx wrangler secret put OPENAI_MODEL_ASAGI

# 可选：全局模型覆盖（调试用；优先级低于 OPENAI_MODEL_<ID>）
# npx wrangler secret put OPENAI_MODEL

# 本地：写入 .dev.vars（见 .env.example，已 gitignore）
```

| 变量 | 作用 |
|------|------|
| `OPENAI_ENDPOINT` / `OPENAI_API_KEY` | openai 人设必填 |
| `OPENAI_MODEL_<ID>` | 人设专属模型，**最高优先** |
| `OPENAI_MODEL` | 全局覆盖（调试；盖不过 `OPENAI_MODEL_<ID>`） |
| `WORKERS_AI_MODEL` | Workers AI 模型覆盖 |

OpenAI 模型解析：`OPENAI_MODEL_<ID>` → `OPENAI_MODEL` → 人设 `openai.model` → `deepseek-v4-flash`。

采样参数仍在各人设 `modelConfig`。

### 人设与默认模型

| 人设 id | Provider | 代码默认 model |
|---------|----------|----------------|
| nako | workers-ai | `@cf/qwen/qwen3-30b-a3b-fp8` |
| asagi | openai | `glm-5.2-instant` |
| miku | openai | `gpt-4.1-mini` |
| yui | openai | `glm-4.5-flash` |

请求：`POST /api/chat?persona=asagi`（省略时默认 nako）。

### Workers AI / Qwen3 注意

- Nako 默认 `enableThinking: true`。在 CF Workers AI 上对 Qwen3 传 `enable_thinking: false`（`chat_template_kwargs`）实测容易把 `content` 掐空，勿随意关。
- 若模型只把短回复写在 `reasoning_content` 里，Worker 会尝试从中抠出可见回复，并在日志打 `[workers-ai] empty content; recovered…`；**不会**把思维链回给客户端。

### Cloudflare Workers AI 响应格式

API 使用 Cloudflare Workers AI，返回 OpenAI 兼容格式：

**非流式响应：**
```json
{
  "id": "completion-id",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "@cf/qwen/qwen3-30b-a3b-fp8",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "哼,天气好又怎样..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 411,
    "completion_tokens": 187,
    "total_tokens": 598
  }
}
```

API 提取 `choices[0].message.content` 并封装为简化的响应格式。

**流式响应：**
直接返回 Cloudflare Workers AI 的原始 Server-Sent Events (SSE) 流。

### 角色系统

聊天机器人的人格配置特点：
- **动态人格**：根据时间段（凌晨/早上/下午/晚上）自动调整对话风格
- **多样化语气**：支持多种对话模式随机切换，避免回复单调
- **上下文感知**：基于对话历史生成连贯的回复
- **状态系统**：随机生成当前状态和话题，增加对话真实感
- **自然对话**：模拟真实聊天场景，语气轻松自然

## 🌐 SEKAI 生态

本项目是 **SEKAI 生态**的一部分。

查看完整的项目列表和架构：**[SEKAI 门户](https://sekai.nightcord.de5.net)**

## 🤝 贡献

欢迎贡献！我们非常感谢任何形式的贡献。

在贡献之前，请阅读：
- [贡献指南](./CONTRIBUTING.md)
- [行为准则](./CODE_OF_CONDUCT.md)

## 🔒 安全

如果发现安全漏洞，请查看我们的 [安全政策](./SECURITY.md)。

## 📄 许可证

本项目采用 Apache License 2.0 许可证 - 详见 [LICENSE](./LICENSE) 文件。

## 📧 联系方式

- **GitHub Issues**: [https://github.com/25-ji-code-de/nako/issues](https://github.com/25-ji-code-de/nako/issues)
- **项目主页**: [https://nako.nightcord.de5.net](https://nako.nightcord.de5.net)
- **哔哩哔哩**: [@bili_47177171806](https://space.bilibili.com/3546904856103196)

## 🙏 致谢

- 感谢所有贡献者
- 感谢 Cloudflare 提供的 Workers AI 和 Vectorize 服务

## ⭐ Star History

如果这个项目对你有帮助，请给我们一个 Star！

[![Star History Chart](https://api.star-history.com/svg?repos=25-ji-code-de/nako&type=Date)](https://star-history.com/#25-ji-code-de/nako&Date)

---

<div align="center">

**[SEKAI 生态](https://sekai.nightcord.de5.net)** 的一部分

Made with 💜 by the [25-ji-code-de](https://github.com/25-ji-code-de) team

</div>
