# AI 视频生成工作流工具 (MVP)

> 把「Claude Code / Codex + Seedance AI 视频：从一个想法到成片的全流程」做成可操作、可估算、可追踪的工作流工具。

## 核心功能

1. **7 阶段流水线**：创意构思 → 脚本生成 → 分镜绘制 → 视频生成 → 配音配乐 → 剪辑合成 → 多平台发布，每阶段标注使用的工具、耗时与产出物。
2. **成本 / 耗时估算**：按分镜数、成片时长、质量档位（draft 0.5x / standard 1x / high 2.2x）实时估算花费与工时。
3. **分镜脚本自动生成**：输出每个镜头的节拍（钩子、痛点、方案、演示、对比、案例、避坑、CTA）、景别、时长、口播稿、画面描述与 Seedance prompt。
4. **项目进度管理**：节点点击切换完成状态，JSON 持久化，支持项目列表与单项目导出。

## 技术栈

- Node.js 24 + Express 4
- 原生 HTML / CSS / Vanilla JS（零构建步骤）
- JSON 文件持久化（`projects.json`）

## 快速开始

```bash
cd products/ai-video-workflow
npm install
npm start        # http://localhost:3000
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stages` | 工作流阶段定义 |
| POST | `/api/plan` | 生成方案：估算 + 分镜脚本 |
| POST | `/api/projects` | 保存项目 |
| GET | `/api/projects` | 项目列表 |
| GET | `/api/projects/:id` | 项目详情 |
| POST | `/api/projects/:id/toggle` | 切换阶段完成状态 |
| GET | `/api/projects/:id/export` | 导出项目 JSON |

## 目录结构

```
ai-video-workflow/
├── server.js      # Express 后端
├── index.html     # 单页前端
├── package.json
└── README.md
```

## 后续规划

- 接入真实 Claude Code / Seedance API，替换模板化分镜生成
- 对接 FFmpeg 做本地片段拼接
- 接入各平台发布 API，自动生成分发包
