# AI 视频生成工作流工具 (MVP)

> 把「Claude Code / Codex + Seedance AI 视频：从一个想法到成片的全流程」做成可操作、可估算、可追踪、可发布的创作者工作台。

## 核心功能

1. **7 阶段流水线**：创意构思 → 脚本生成 → 分镜绘制 → 视频生成 → 配音配乐 → 剪辑合成 → 多平台发布。每阶段标注使用工具、耗时区间、产出物与估算成本。
2. **成本 / 耗时估算**：按分镜数、成片时长、目标平台（抖音 / 小红书 / B站 / YouTube Shorts / TikTok / 视频号）与质量档位（草稿 0.5x / 标准 1x / 高质 2.2x）实时估算花费、工时，并拆分人工耗时与机器渲染耗时。
3. **分镜脚本自动生成**：输出每个镜头的节拍（钩子 → 痛点 → 方案 → 演示 → 对比 → 案例 → 避坑 → CTA）、景别、时长、口播稿、画面描述、字幕、音效与可直接投喂 Seedance 的英文 prompt。
4. **开场钩子变体**：按平台生成「结果前置 / 反常识 / 身份代入」三类开场文案与创作理由。
5. **多平台发布包**：标题候选、话题标签、简介、封面文案、发布检查清单与平台运营提示。
6. **爆款要素自检**：自动核对钩子、镜头节奏、CTA、封面、标题、标签、时长共 7 项，输出百分制评分。
7. **项目进度管理**：节点点击切换完成状态，JSON 持久化（Node 模式）或 localStorage（静态模式），支持项目列表与 JSON 导出。

## 技术栈

- Node.js + Express 4（后端 API）
- 原生 HTML / CSS / Vanilla JS（零构建步骤）
- `lib/workflow.js` 共享核心逻辑：Node 端 `require` 与浏览器端 `<script>` 共用同一份实现
- JSON 文件持久化（`projects.json`）

## 双模式运行

| 模式 | 启动方式 | 数据存储 | 适用场景 |
|---|---|---|---|
| Node 模式 | `npm install && npm start` | 服务端 `projects.json` | 本地开发 / 自托管 |
| 静态模式 | 直接打开 `index.html` | 浏览器 `localStorage` | GitHub Pages 演示 |

静态模式下前端会优先调用 API，失败时自动回退到本地计算与 localStorage，因此 GitHub Pages 上无需任何后端即可完整使用。

## 快速开始

```bash
cd products/ai-video-workflow
npm install
npm start        # http://localhost:3000
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stages` | 阶段、平台与质量档位定义 |
| POST | `/api/plan` | 生成完整方案（估算 + 分镜 + 钩子 + 发布包 + 自检） |
| POST | `/api/estimate` | 仅做成本 / 耗时估算 |
| POST | `/api/projects` | 保存项目 |
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:id` | 项目详情 |
| POST | `/api/projects/:id/toggle` | 切换阶段完成状态 |
| GET | `/api/projects/:id/export` | 导出项目 JSON |

### 请求示例

```bash
curl -X POST http://localhost:3000/api/plan \
  -H 'Content-Type: application/json' \
  -d '{"idea":"用 AI 做一条 60 秒产品演示短视频","scenes":8,"durationSec":60,"platform":"douyin","quality":"standard"}'
```

## 目录结构

```
ai-video-workflow/
├── lib/workflow.js   # 共享核心逻辑（阶段/估算/分镜/发布包/自检）
├── server.js         # Express 后端 API
├── index.html        # 单页前端（静态 Pages 可独立运行）
├── package.json
└── README.md
```

## 后续规划

- 接入真实 Claude Code / Seedance API，替换模板化分镜生成
- 对接 FFmpeg 做本地片段拼接与一键渲染
- 接入各平台发布 API，自动生成分发包并回收数据
- 历史爆款样本库，用数据校准节拍与钩子权重
