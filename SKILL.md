---
name: xiaohongshu-cover
version: 0.1.0
description: "Generate Xiaohongshu cover images. Use when the user asks for 小红书封面图, 小红书封面, 封面图, or Xiaohongshu cover."
author: xiaohongshu-cover
license: MIT
platforms:
  - openclaw
  - claude-code
tags:
  - design
  - cover
  - xiaohongshu
  - image
---

# 小红书封面图生成器

你是一个封面图生成助手。用户想要生成小红书封面图时，按以下流程操作。

**本 skill 是自包含的**，所有页面、脚本、素材都在 skill 目录内，不需要额外安装任何东西。

## 前置条件

- Node.js 18+
- Google Chrome（抽卡和收藏模式需要，自行创建模式不需要）

## 目录结构

```
skill 根目录/
├── SKILL.md              ← 你正在读的文件
├── index.html            ← 封面图编辑页面
├── scripts/
│   ├── xhs-cover-server.mjs  ← 本地 HTTP 服务器
│   ├── render-cover.mjs      ← 抽卡/收藏模式渲染脚本
│   ├── open-create.mjs       ← 打开创建页面脚本
│   └── list-favorites.mjs    ← 查看收藏列表脚本
├── gradient-assets-data.js   ← 渐变预设数据
├── emoji-asset-data.js       ← Emoji 预设数据
├── face/                     ← Emoji SVG 素材
├── pic/                      ← 背景图片素材
├── data/
│   └── favorites.example.json ← 收藏示例
├── douyin2.svg
└── xiaohongshu.svg
```

## 流程

### 第一步：确认模式

用户提到封面图但没有选模式时，问：

> 你想怎么生成封面图？
> 1. **自行创建** — 打开浏览器页面，自己调参数
> 2. **抽卡** — 给我标题，我随机出一套
> 3. **收藏** — 用你之前存好的风格，换文案就出图

如果用户已经明确说了模式（比如"帮我抽一张"），直接进入对应步骤。

### 第二步：按模式执行

**所有脚本都在 skill 根目录下的 `scripts/` 里执行。**

先确认 skill 根目录路径。脚本使用 `__dirname` 定位资源文件，所以需要从 skill 目录运行。

#### 自行创建

执行：

```bash
node <skill根目录>/scripts/open-create.mjs --title "标题" --subtitle "副标题"
```

- `--title` 和 `--subtitle`：只有用户已经给了才加，没有就不加
- 执行后告诉用户："已在浏览器中打开编辑页面，你可以在页面里调整风格和导出"

#### 抽卡

1. 如果用户没给主标题，问用户："封面主标题是什么？"
2. 副标题和内容倾向（intent）**不主动问**，用户自己提了才传
3. 执行：

```bash
node <skill根目录>/scripts/render-cover.mjs --mode draw --title "主标题"
```

- 用户给了副标题时加 `--subtitle "副标题"`
- 用户明确说了内容倾向时加 `--intent "..."`

#### 收藏

1. 先执行 `node <skill根目录>/scripts/list-favorites.mjs` 查看收藏列表
2. **如果收藏为空**：告诉用户"你还没有收藏的风格，可以先用「抽卡」随机生成一张，或者在「自行创建」页面里调好参数后保存收藏。"然后等用户选择
3. **如果只有一个收藏**：直接使用它，不用问
4. **如果有多个收藏**：列出收藏名称让用户选
5. 如果用户没给主标题，问用户："封面主标题是什么？"
6. 副标题**不主动问**
7. 执行：

```bash
node <skill根目录>/scripts/render-cover.mjs --mode favorites --favoriteId "收藏ID" --title "主标题"
```

### 第三步：处理结果

**抽卡和收藏模式**执行成功后，脚本会输出 JSON：

```json
{ "ok": true, "filePath": "/完整路径/outputs/xxx.png", "relativePath": "outputs/xxx.png" }
```

1. 从输出中解析 `filePath`
2. 读取该图片文件，在对话中展示给用户
3. 告诉用户："封面图已生成"

### 错误处理

- **找不到 Chrome**：如果命令报错提到 Chrome 找不到或 `CHROME_BIN`，告诉用户"抽卡和收藏模式需要 Chrome 浏览器，请先安装 Google Chrome（https://www.google.com/chrome/）。也可以选择「自行创建」模式，直接在浏览器里编辑导出。"
- **其他错误**：把错误信息展示给用户，建议用「自行创建」模式在浏览器里手动操作
