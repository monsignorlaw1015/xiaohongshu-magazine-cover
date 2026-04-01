# 小红书封面图生成器

一键生成小红书 3:4 竖版封面图。三种方式：自己调、随机抽、收藏复用。

## 效果示例

| 抽卡模式 | 收藏模式 |
| --- | --- |
| ![Draw Demo](assets/demo-draw.png) | ![Favorite Demo](assets/demo-favorite.png) |

---

## 方式一：直接使用（不用 AI）

适合所有人，不需要任何技术基础。

### 第一步：下载

去 [GitHub Releases](../../releases) 下载最新的 `小红书封面图生成器.zip`，解压到任意位置。

### 第二步：打开

双击解压后的 `index.html`，浏览器会自动打开编辑页面。

### 第三步：做封面

- 左边是控制面板，右边是实时预览
- 选模板、改字体、换背景、调颜色
- 满意了点「导出 PNG」下载图片

> 抽卡和收藏功能需要启动本地服务，见下方「AI 用户」部分。

---

## 方式二：配合 AI 使用（OpenClaw / Claude Code）

如果你使用 AI 编程工具，可以让 AI 直接帮你生成封面图。

### 安装

需要 Node.js 18+ 和 Google Chrome。

```bash
npm install -g xiaohongshu-cover-generator
```

### 安装到 OpenClaw

```bash
xhs-cover install openclaw
```

### 安装到 Claude Code

安装到当前项目：

```bash
xhs-cover install claude-code
```

安装为全局 agent：

```bash
xhs-cover install claude-code --scope user
```

### 使用

安装完成后，直接跟 AI 说：

- "帮我生成一张小红书封面图"
- "生成封面图，标题是「5个习惯让你越来越自律」"
- "用抽卡模式出一张封面"

AI 会引导你选择模式：

| 模式 | 说明 |
|------|------|
| **自行创建** | AI 打开浏览器编辑页面，你自己调参数 |
| **抽卡** | 你给个标题，AI 随机出一套封面 |
| **收藏** | 用你之前存好的风格，换文案直接出图 |

生成的图片会直接显示在对话中。

### 手动调用（不需要 AI）

```bash
# 启动编辑页面
xhs-cover open-create --title "你的标题"

# 抽卡出图
xhs-cover render --mode draw --title "你的标题"

# 用收藏出图
xhs-cover render --mode favorites --title "你的标题"

# 查看收藏列表
xhs-cover list-favorites
```

---

## 常见问题

**打开 HTML 后样式不对？** 需要联网加载字体，确认网络正常。

**AI 生成时报错找不到 Chrome？** 需要安装 [Google Chrome](https://www.google.com/chrome/)。

**收藏模式提示没有收藏？** 先用「自行创建」模式在页面上调好参数，保存为收藏后再使用。

---

## License

[MIT](LICENSE)
