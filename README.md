# PRTS-Vis Tactical Terminal

> 一个工业机能风格的安全审计终端 — Electron 桌面应用，集成 LLM 驱动的漏洞分析与工具执行引擎。

## 预览

PRTS-Vis 源自"明日方舟"中本舰人工智能 PRTS 的设计灵感，是一个专注于网络与计算机安全的 Agent。拥有沉浸式战术终端界面，模拟安全审计工作站的视觉体验。

支持 GUI 桌面应用和 CLI 命令行两种使用方式，可对接 OpenAI / DeepSeek / SiliconFlow 等 LLM 提供商。

## v1.2.0 更新

**17 个 Claude Code 风格工具现已上线**

| 文件操作 | 系统工具 | 安全工具 | 生产力工具 |
|---------|---------|---------|-----------|
| ReadFile / WriteFile / Glob / Grep / FileEdit | Bash / WebFetch / WebSearch | AnalyzeConfigLeak / QueryLocalCVE / FetchOnlineCVE | AskUserQuestion / TodoWrite / TaskCreate / Brief / NotebookEdit |

**CLI 增强**
- 旋转光标等待动画
- ESC 键随时中断执行
- 行缓冲流式输出，避免乱码
- 精简日志，只显示核心内容

**基础设施**
- ToolRegistry 工具注册中心
- ToolOrchestrator 并行/串行调度
- ToolExecutor 自动重试与降级
- ReadWriteLock 并发控制
- appState 状态管理与发布订阅

## 功能

### 通用
- **LLM 安全审计内核** — 基于 function calling 的 CVE 查询、配置审计、威胁情报抓取
- **本地 CVE 数据库** — 内置离线漏洞库，支持精确和模糊匹配
- **多 Provider 配置** — 支持 OpenAI、DeepSeek、SiliconFlow 及自定义 API
- **GUI / CLI 配置共享** — 配置通过 `~/.prts-vis/config.json` 同步
- **自动更新** — 支持 GitHub Releases 自动下载

### 桌面应用 (GUI)
- **拖拽文件分析** — 支持 `.txt`、`.md`、`.json`、`.docx` 等格式
- **系统监控面板** — 实时 CPU、RAM、系统信息
- **工业机能风视觉** — Canvas 粒子引擎、线框球体视差、blast door 过渡动画

### 命令行 (CLI)
- **全局命令** — 任意终端输入 `prts` 启动
- **交互模式** — `PRTS>` 提示符，多轮对话
- **单次命令** — `prts "查询 OpenSSH 漏洞"`
- **旋转光标** — 流式输出时显示等待动画
- **ESC 中断** — 随时终止正在执行的任务

## 下载安装

前往 [Releases](https://github.com/WuTong260/PRTS-Vis/releases/latest) 页面下载：

| 文件 | 说明 |
|------|------|
| `PRTS-Vis-Setup-X.X.X.exe` | NSIS 安装包（推荐） |
| `PRTS-Vis-X.X.X.exe` | 便携版，无需安装 |

> 支持**自动更新**，新版本发布后会自动提示。

## 快速开始

### 开发

```bash
npm install
npm run dev          # 启动开发服务器
```

### CLI 模式

```bash
npm run cli:server   # 启动 CLI 服务器
npm run cli:client   # 启动 CLI 客户端
```

或全局安装后直接使用：
```bash
prts                 # 交互模式
prts "查询 Redis 漏洞"  # 单次命令
```

### 打包

```bash
npm run dist         # 构建安装包
```

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 构建工具 | Vite |
| 语言 | 原生 JavaScript (ES Modules) |
| 样式 | 纯 CSS |
| 打包 | electron-builder |
| 自动更新 | electron-updater |

## 项目结构

```
CLOSURE/
├── bin/
│   └── prts-cli.js              # CLI 客户端
├── src/
│   ├── css/
│   │   └── style.css            # 全部样式
│   ├── js/
│   │   ├── main.js              # 入口（唯一操作 DOM）
│   │   ├── mainLoop.js          # 中心化 rAF 循环
│   │   ├── stateMachine.js      # 有限状态机
│   │   ├── bootSequence.js      # 启动序列编排
│   │   ├── agentKernel.js       # LLM 系统提示词 & 工具定义
│   │   ├── llmService.js        # LLM API 流式调用
│   │   ├── tools.js             # 工具执行入口
│   │   ├── configManager.js     # Provider 配置管理
│   │   ├── state/
│   │   │   └── appState.js      # 状态管理（pub/sub）
│   │   └── tools/
│   │       ├── core/            # 核心基础设施
│   │       │   ├── Tool.js
│   │       │   ├── ToolRegistry.js
│   │       │   ├── ToolOrchestrator.js
│   │       │   ├── ToolExecutor.js
│   │       │   ├── ReadWriteLock.js
│   │       │   ├── InputValidator.js
│   │       │   └── ValidationError.js
│   │       ├── execution/        # 执行器
│   │       │   └── ToolExecutor.js
│   │       ├── formatters/      # 格式化
│   │       │   └── ResultSummarizer.js
│   │       ├── tools/           # 17 个工具实现
│   │       └── utils/           # 工具函数
│   ├── main/
│   │   └── cliServer.js         # CLI 服务器（UDS/Named Pipe）
│   └── context/
│       └── compactionManager.js # 上下文压缩
├── index.html
└── package.json
```

## 配置

配置存储在 `~/.prts-vis/config.json`：

| 字段 | 说明 |
|------|------|
| provider | OpenAI / DeepSeek / SiliconFlow / Custom |
| url | API 端点 |
| apiKey | API 密钥 |
| model | 模型名称 |

CLI 模式支持环境变量覆盖：
```bash
PRTS_API_KEY=xxx PRTS_MODEL=gpt-4o prts
```

## 状态机

```
IDLE → BOOTING → LOADING → READY → TRANSITIONING → SYSTEM_ONLINE
```

| 状态 | 表现 |
|------|------|
| BOOTING | 逐字打印启动信息 |
| LOADING | 进度条动画 + 终端日志流 |
| READY | LOG IN 按钮出现 |
| TRANSITIONING | 球体环爆发，blast door 打开 |
| SYSTEM_ONLINE | HUD 激活，粒子背景可见 |

## 示例指令

```
PRTS> 帮我查一下 Redis 5.0.5 有哪些漏洞
PRTS> 扫描这份配置文件是否有硬编码凭证
PRTS> 在线查询 Log4j 最新的漏洞情报
PRTS> 给我说一个最新的 AI 资讯
PRTS> 列出抖音热搜有哪些
```