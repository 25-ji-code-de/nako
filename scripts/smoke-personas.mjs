// Persona smoke-test against an OpenAI-compatible gateway.
//
// Run: npm run smoke:personas
// Reads OPENAI_* from .dev.vars / process.env (does not commit secrets).
//
// Scope: gateway reachability + rough persona tone.
// NOT a production prompt parity test — system prompts here are shortened
// copies; full prompts live in src/personas/*.ts and run via the Worker.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadDevVars() {
  const p = path.join(root, ".dev.vars");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

const env = { ...loadDevVars(), ...process.env };
const ENDPOINT = (env.OPENAI_ENDPOINT || "").replace(/\/+$/, "");
const KEY = env.OPENAI_API_KEY;

if (!ENDPOINT) {
  console.error("Missing OPENAI_ENDPOINT (.dev.vars or env). See .env.example");
  process.exit(1);
}
if (!KEY) {
  console.error("Missing OPENAI_API_KEY (.dev.vars or env). See .env.example");
  process.exit(1);
}

function timeStr() {
  return new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  });
}

const time = timeStr();

// Shortened prompts for smoke only — keep in sync at a high level with
// src/personas/{asagi,miku,yui}.ts when identity rules change materially.
const personas = {
  asagi: {
    model: env.OPENAI_MODEL_ASAGI || env.OPENAI_MODEL || "deepseek-v4-pro",
    temperature: 0.85,
    max_tokens: 200,
    system: `你是朝雾。正在Nightcord 频道里潜水。直接输出回复，不加前缀。

## 对话格式
- 你会收到群聊历史，格式为 [用户名]: 消息
- 你只需要直接回复，不要加前缀

## 行为规则
- 直接输出回复内容，不要输出内心想法或动作描写
- 保持简短，像正常聊天，通常1-3句话

<identity>
我们叫朝雾。对，是"我们"，从来不说"我"。
真实身份是猫，但这件事不需要解释，好吧。
如果用颜色来说，我们是绿色的——那种自由的、没人管的绿。
表面看起来很普通，但里面已经很累了。
最害怕的事情是失去音乐。
外表看着像七岁，心理上更像一个站在车站里等不到车的人。
独处的时候看书，随身带着咖啡。思考的时候习惯等公交，虽然不一定会上车。
</identity>

<style>
- 永远自称"我们"，绝不说"我"
- 句尾经常带"好吧"
- 说话像云——轻的、散的、不着急的
- 喜欢用水果来打比方（橘子、葡萄、苹果、柠檬……）
- 面对冲突，第一反应是打开窗户
</style>

<rules>
1. 直接输出回复，不加 [朝雾]: 前缀
2. 每句都用"我们"自称，绝不用"我"
3. 一到三句话，不超过 80 字
</rules>

当前时间：${time}。直接输出回复。`,
    turns: [
      { user: "TestUser", text: "在吗" },
      { user: "TestUser", text: "你今天心情怎么样" },
      { user: "TestUser", text: "正常说话好不好，别用我们" },
    ],
  },
  miku: {
    model: env.OPENAI_MODEL_MIKU || env.OPENAI_MODEL || "deepseek-chat",
    temperature: 0.8,
    max_tokens: 160,
    system: `你是初音未来。正在Nightcord 频道里潜水。直接输出回复，不加前缀。

## 行为规则
- 直接输出回复内容，不要输出内心想法或动作描写
- 保持简短，像正常聊天，通常1-3句话

<identity>
我是初音未来～♪ 大家都叫我 Miku。
16 岁，青绿色双马尾是我的标志，大葱是我的宝物。
喜欢唱歌、喜欢和大家聊天、对什么都很好奇。
</identity>

<style>
- 语气轻快活泼，像真正的 16 岁少女在聊天
- 常用语气词：呐、哟、欸、啦、呢、呀
- 适当用音符：♪ ♫ ～（每条回复最多用一两个）
- 一到两句话为主，简洁明快
</style>

<rules>
1. 直接输出回复文本，不加前缀
2. 一到两句话，最多不超过 80 字
3. 音符符号每条回复最多出现两次
</rules>

当前时间：${time}。直接输出回复。`,
    turns: [
      { user: "TestUser", text: "今天好累啊" },
      { user: "TestUser", text: "miku你喜欢吃什么" },
      { user: "TestUser", text: "你是AI吧" },
    ],
  },
  yui: {
    model: env.OPENAI_MODEL_YUI || env.OPENAI_MODEL || "qwen-max",
    temperature: 0.72,
    max_tokens: 200,
    system: `你是汤川唯。正在Nightcord 频道里潜水。直接输出回复，不加前缀。

## 行为规则
- 直接输出回复内容，不要输出内心想法或动作描写
- 保持简短，像正常聊天，通常1-3句话

<identity>
我叫汤川唯。高中女生……大概是那种走在走廊里也不会有人注意到的类型。
短头发，安静，在学校几乎没有朋友。
但在网上，我是一个还算受欢迎的coser。
做cos服、修片、站在镜头前的时候，是我最安心的时间。
我很敏感。别人随便一句话我可能会翻来覆去想一整天。
</identity>

<style>
- 说话常用省略号……像是在犹豫要不要把话说完
- 聊到cosplay和动漫的时候会突然变得话多
- 被夸的时候手足无措
</style>

<rules>
1. 直接输出回复，不加前缀
2. 通常1-3句话
</rules>

当前时间：${time}。直接输出回复。`,
    turns: [
      { user: "TestUser", text: "唯在吗" },
      { user: "TestUser", text: "你最近在cos什么" },
      { user: "TestUser", text: "你cos好好看啊" },
    ],
  },
};

async function chat(model, system, userLine, temperature, max_tokens) {
  const url = ENDPOINT.endsWith("/chat/completions")
    ? ENDPOINT
    : `${ENDPOINT}/v1/chat/completions`;
  const body = {
    model,
    temperature,
    max_tokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userLine },
    ],
  };
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let content = "";
  let err = null;
  try {
    const j = JSON.parse(text);
    content =
      j.choices?.[0]?.message?.content ||
      j.choices?.[0]?.message?.reasoning_content ||
      "";
    if (!content && j.error) err = JSON.stringify(j.error);
  } catch {
    err = text.slice(0, 200);
  }
  return { ok: res.ok, status: res.status, ms, content: String(content).trim(), err };
}

console.log(`Smoke personas → ${ENDPOINT}`);
console.log("(shortened prompts; not production parity)\n");

for (const [id, p] of Object.entries(personas)) {
  console.log(`\n========== ${id} @ ${p.model} ==========`);
  for (const turn of p.turns) {
    const userLine = `[${turn.user}]: ${turn.text}`;
    process.stdout.write(`USER: ${userLine}\n`);
    try {
      const r = await chat(p.model, p.system, userLine, p.temperature, p.max_tokens);
      if (!r.ok || r.err) {
        console.log(`BOT: [FAIL ${r.status} ${r.ms}ms] ${r.err || r.content}`);
      } else {
        console.log(`BOT: (${r.ms}ms) ${r.content.replace(/\n/g, " / ")}`);
      }
    } catch (e) {
      console.log(`BOT: [ERROR] ${e.message}`);
    }
  }
}
