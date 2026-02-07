# Cowork - 协作聊天室

基于 Rust (Axum) + React 的多房间聊天应用，支持 AI 机器人。

## 功能特性

- 多聊天室支持
- 用户注册/登录认证
- 实时消息传输 (WebSocket)
- AI 机器人（关键词回复 + AI 对话）
- 机器人记忆功能（持续对话）
- 图片消息支持
- 输入状态提示
- 成员列表查看
- 数据自动持久化

## 技术栈

**后端：**
- Rust + Axum (异步 Web 框架)
- Tokio (异步运行时)
- WebSocket 实时通信
- JWT 认证
- bcrypt 密码加密

**前端：**
- React 18 + TypeScript
- Vite (构建工具)
- TailwindCSS (样式)
- React Router

## 快速开始

### 1. 安装依赖

```bash
# 后端依赖会自动通过 Cargo 安装
# 前端依赖
cd frontend
npm install
cd ..
```

### 2. 初始化配置

```bash
make init-config
```

这会创建 `~/.cowork/settings.json` 配置文件。

### 3. 配置 AI（可选）

编辑 `~/.cowork/settings.json`，填入你的 AI API Key：

```json
{
  "backend": {
    "url": "http://127.0.0.1:3000",
    "bind_address": "127.0.0.1:3000"
  },
  "frontend": {
    "port": 5173,
    "host": "0.0.0.0"
  },
  "ai": {
    "api_key": "your-api-key-here",
    "api_url": "https://api.deepseek.com/v1/chat/completions"
  }
}
```

### 4. 运行

```bash
# 使用 Makefile（推荐）
make run-backend    # 启动后端
make run-frontend   # 启动前端

# 或直接运行
cd backend && cargo run
cd frontend && npm run dev
```

访问 http://localhost:5173 开始使用。

## Makefile 命令

| 命令 | 说明 |
|------|------|
| `make build` | 构建前后端 |
| `make backend` | 构建后端 |
| `make frontend` | 构建前端 |
| `make run-backend` | 运行后端 |
| `make run-frontend` | 运行前端开发服务器 |
| `make clean` | 清理构建产物 |
| `make init-config` | 创建配置文件 |
| `make show-config` | 显示当前配置 |

## 配置说明

所有配置存储在 `~/.cowork/settings.json`：

| 字段 | 说明 |
|------|------|
| `backend.bind_address` | 后端服务器监听地址 |
| `backend.url` | 前端连接后端的地址 |
| `frontend.port` | 前端开发服务器端口 |
| `frontend.host` | 前端开发服务器监听地址 |
| `ai.api_key` | AI API 密钥 |
| `ai.api_url` | AI API 地址 |

## 机器人使用

1. 在聊天室中点击"添加"创建机器人
2. 设置名称、头像、默认回复
3. 添加关键词回复（可选）
4. 配置 AI 模型（可选，需要 API Key）

**@机器人触发对话：**
- 发送 `@机器人名 消息内容` 可与机器人对话
- 60秒内继续发送消息会持续与该机器人对话
- 超过60秒后需要重新 @机器人

## 数据存储

- 配置文件：`~/.cowork/settings.json`
- 数据文件：`~/.cowork/data.json`（每30秒自动保存）

## 项目结构

```
cowork/
├── backend/
│   └── src/
│       ├── main.rs         # 入口
│       ├── models.rs       # 数据模型
│       ├── websocket.rs    # WebSocket 处理
│       ├── auth.rs         # 认证
│       ├── rooms.rs        # 房间 API
│       ├── bot.rs          # 机器人 API
│       ├── ai.rs           # AI 服务
│       ├── storage.rs      # 数据持久化
│       └── config.rs       # 配置加载
├── frontend/
│   └── src/
│       ├── App.tsx         # 应用入口
│       ├── pages/          # 页面
│       ├── components/     # 组件
│       ├── hooks/          # React Hooks
│       ├── api.ts          # API 客户端
│       └── types/          # 类型定义
├── Makefile
└── README.md
```

## 开发

```bash
# 构建生产版本
make build

# 运行测试
cd backend && cargo test
```
