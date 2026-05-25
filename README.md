# PRTS-Vis Tactical Terminal

> 一个工业机能风格的安全审计终端 — Electron 桌面应用，集成 LLM 驱动的漏洞分析引擎。

## 预览

PRTS-Vis，一个专注于网络与计算机安全的 agent，设计灵感来源于游戏"明日方舟"中的本舰人工智能：PRTS。PRTS-Vis 拥有一个沉浸式战术终端界面，模拟安全审计工作站的视觉体验。

支持 GUI 桌面应用和 CLI 命令行两种使用方式，可对接 OpenAI / DeepSeek / SiliconFlow 等 LLM 提供商，进行漏洞查询、配置文件审计、在线威胁情报抓取等安全任务。

## 功能

### 通用
- **LLM 安全审计内核** — 基于工具调用（function calling）的 CVE 漏洞查询、配置文件凭证泄漏检测、在线威胁情报抓取
- **本地 CVE 数据库** — 内置离线漏洞库，支持精确和模糊匹配
- **多 Provider 配置** — 支持 OpenAI、DeepSeek、SiliconFlow 及自定义 API 端点
- **GUI / CLI 配置共享** — 配置通过 `~/.prts-vis/config.json` 在桌面应用和命令行间同步
- **自动更新** — 支持通过 GitHub Releases 自动下载更新

### 桌面应用 (GUI)
- **拖拽文件分析** — 支持 `.txt`、`.md`、`.json`、`.docx` 等格式文件拖入分析
- **系统监控面板** — 实时显示 CPU、RAM、系统信息等指标
- **工业机能风视觉** — Canvas 粒子引擎、线框球体视差、动态扫描线/噪点/六角网格覆盖层、blast door 过渡动画

### 命令行 (CLI)
- **全局命令** — 安装后可在任意终端直接输入 `prts` 启动
- **交互模式** — `PRTS>` 提示符，支持多轮对话
- **单次命令** — `prts "查询 OpenSSH 8.4 的漏洞"` 快速执行
- **流式输出** — 实时显示 Agent 生成内容

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 构建工具 | Vite |
| 语言 | 原生 JavaScript (ES Modules) |
| 样式 | 纯 CSS |
| 文档解析 | mammoth (.docx) |
| 打包 | electron-builder |
| 自动更新 | electron-updater |

## 项目结构

```
CLOSURE/
├── app/
│   └── main.cjs              # Electron 主进程
├── bin/
│   └── prts-cli.js          # CLI 客户端
├── src/
│   ├── css/
│   │   └── style.css          # 全部样式
│   ├── js/
│   │   ├── main.js            # 入口 — 唯一操作 DOM 的文件
│   │   ├── mainLoop.js        # 中心化 requestAnimationFrame 循环
│   │   ├── stateMachine.js    # 有限状态机
│   │   ├── bootSequence.js    # 启动序列编排
│   │   ├── terminalLogger.js  # 终端日志行渲染
│   │   ├── particleEngine.js  # Canvas 2D 粒子系统
│   │   ├── parallax.js        # 鼠标驱动的球体视差旋转
│   │   ├── agentKernel.js     # LLM 系统提示词 & 工具定义
│   │   ├── llmService.js      # LLM API 流式调用 (SSE)
│   │   ├── tools.js           # 工具执行 (CVE 查询、配置审计)
│   │   ├── configManager.js   # Provider 配置管理 (GUI/CLI 共享)
│   │   ├── cveDatabase.js     # 本地 CVE 数据库
│   │   ├── markedLocal.js     # Markdown 解析器
│   │   ├── sttService.js      # 语音识别服务
│   │   ├── sysMonitor.js      # 系统监控 & 可视化
│   │   └── surveillance.js     # 侦察分析
│   ├── context/
│   │   ├── compactionManager.js  # 上下文压缩管理
│   │   └── tokenCounter.js       # Token 估算
│   ├── main/
│   │   └── cliServer.js       # CLI 服务器 (UDS/Named Pipe)
│   └── tools/
│       └── core/
│           ├── ToolOrchestrator.js  # 工具并行/串行调度
│           ├── ToolRegistry.js      # 工具注册表
│           ├── ReadWriteLock.js     # 读写锁
│           ├── Tool.js              # 工具基类
│           ├── InputValidator.js    # 输入验证
│           └── ValidationError.js  # 验证错误
├── index.html                 # 单页入口
├── prts.bat                   # Windows 启动脚本
├── package.json
├── vite.config.js
└── .gitignore
```

## 快速开始

### 前提条件

- Node.js 18+
- npm 9+

### 安装

```bash
npm install
```

### 开发模式

启动 Vite 开发服务器并自动打开 Electron 窗口（含 DevTools）：

```bash
npm run dev
```

### CLI 模式

安装后可在任意终端直接使用：

```bash
prts                              # 交互模式
prts "查询 Redis 5.0.5 的漏洞"   # 单次命令模式
```

### 打包构建

```bash
npm run dist
```

构建产物输出到 `release/` 目录。

## 使用指南

### GUI 桌面应用

1. **启动应用** — 等待启动序列播放完毕
2. **点击 LOG IN** — 观看过渡动画
3. **配置 Provider** — 点击 `[SYS.CONFIG]` 按钮，选择 LLM 提供商并填入 API Key
4. **输入命令** — 在终端输入框中输入安全分析请求，按 Enter 发送
5. **拖放文件** — 将文件拖入窗口进行分析（支持 `.txt`、`.md`、`.json`、`.docx`）

### CLI 命令行

```
PRTS> 查询 OpenSSH 8.4 的漏洞
PRTS> 审计以下配置：
PRTS> 在线查询 Log4j 最新漏洞
PRTS> exit
```

### 示例指令

- `帮我查一下 Redis 5.0.5 有哪些漏洞`
- `扫描这份配置文件是否有硬编码凭证`
- `在线查询 Log4j 最新的漏洞情报`

## 状态机流程

```
IDLE → BOOTING → LOADING → READY → TRANSITIONING → SYSTEM_ONLINE
```

| 状态 | 表现 |
|------|------|
| BOOTING | 逐字打印启动信息 |
| LOADING | 进度条动画 + 终端日志流 |
| READY | LOG IN 按钮出现，侧面板滑入 |
| TRANSITIONING | 球体环爆发，blast door 打开 |
| SYSTEM_ONLINE | HUD 界面激活，粒子背景可见 |

## 配置

配置存储在 `~/.prts-vis/config.json`（CLI 和 GUI 共享）：

| 字段 | 说明 |
|------|------|
| provider | Provider 名称 (OpenAI / DeepSeek / SiliconFlow / Custom) |
| url | API 端点地址 |
| apiKey | API 密钥 |
| model | 模型名称 |

### CLI 模式环境变量覆盖

CLI 模式优先使用环境变量：

```bash
PRTS_API_KEY=xxx PRTS_MODEL=gpt-4o prts
```

配置不会以任何形式上传，仅在每次 LLM 请求时通过 `Authorization` 头传输。

## 上下文压缩

长对话场景下会自动触发上下文压缩：

- **差异化截断** — 按工具类型保留消息（read_file 保留较长，bash 输出快速淘汰）
- **覆盖式摘要** — 维护全局快照而非摘要堆叠
- **Dynamic Safety Buffer** — 根据模型系数动态调整 token 阈值
- **后验式补偿** — context overflow 时自动收紧 buffer