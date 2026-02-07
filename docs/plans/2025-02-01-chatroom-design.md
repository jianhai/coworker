# Rust 在线聊天室设计文档

**日期:** 2025-02-01
**技术栈:** Rust (Axum) + React + Vite

## 1. 项目概述

构建一个支持多聊天室的在线聊天应用，用户通过网页以用户名+密码登录。

### 规模与约束
- **目标规模:** 50-500 并发用户
- **存储:** 内存存储（无持久化）
- **认证:** 用户账号系统

## 2. 系统架构

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   React 前端    │ ◄─────────────────────► │  Axum 后端服务   │
│  (Vite 构建)    │      持久连接             │  (tokio 异步)     │
└─────────────────┘                           └──────────────────┘
                                                          │
                                                    ┌─────┴─────┐
                                                    │  内存存储  │
                                                    │ • 用户会话 │
                                                    │ • 聊天室   │
                                                    │ • 消息历史 │
                                                    └───────────┘
```

## 3. 后端设计

### 3.1 核心组件

| 组件 | 职责 |
|------|------|
| `ConnectionManager` | 管理 WebSocket 连接，处理连接/断开，广播消息 |
| `RoomManager` | 管理聊天室，维护房间-用户映射，存储消息历史 |
| `SessionManager` | 存储已认证会话，绑定用户名与连接 |
| `AuthMiddleware` | 登录验证，token 生成与校验 |

### 3.2 API 设计

**HTTP API:**

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录，返回 token |
| GET | `/api/rooms` | 获取房间列表 |
| POST | `/api/rooms` | 创建新房间 |

**WebSocket 消息格式:**

```json
// 客户端 → 服务器
{
  "type": "join_room" | "leave_room" | "message" | "typing",
  "room_id": "string",
  "data": { ... }
}

// 服务器 → 客户端
{
  "type": "message" | "user_joined" | "user_left" | "typing" | "error",
  "room_id": "string",
  "data": { ... }
}
```

### 3.3 消息类型支持

| 类型 | 说明 |
|------|------|
| 纯文本 | 基础文本消息 |
| 时间戳 | 每条消息包含发送时间 |
| 图片 | Base64 或 URL 形式 |
| 输入指示器 | 用户正在输入状态 |

### 3.4 依赖项

```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.21"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
jsonwebtoken = "9"
bcrypt = "0.15"
tower-http = { version = "0.5", features = ["cors"] }
```

## 4. 前端设计

### 4.1 组件结构

```
src/
├── App.tsx              # 主应用，路由
├── pages/
│   ├── LoginPage.tsx    # 登录/注册页面
│   └── ChatPage.tsx     # 聊天主页面
├── components/
│   ├── RoomList.tsx     # 房间列表
│   ├── ChatWindow.tsx   # 聊天窗口
│   ├── MessageList.tsx  # 消息列表
│   └── MessageInput.tsx # 输入框+图片上传
├── hooks/
│   └── useWebSocket.ts  # WebSocket 封装
└── types/
    └── index.ts         # TypeScript 类型定义
```

### 4.2 UI 特性

- 响应式布局，支持移动端
- 自动滚动到最新消息
- 输入指示器实时显示
- 图片拖拽/粘贴上传
- 断线重连机制

### 4.3 技术栈

- React 18 + TypeScript
- Vite (构建工具)
- TailwindCSS (样式)
- 原生 WebSocket API

## 5. 数据流

### 5.1 登录流程

```
用户输入凭证 → POST /api/login → 服务器验证 → 返回 token
                              ↓
                         存储到 localStorage
                              ↓
                         建立 WebSocket 连接
                         (URL 参数携带 token)
```

### 5.2 消息发送流程

```
用户输入 → WebSocket(message) → 服务器验证 → 广播给房间内所有用户
                                    ↓
                              存入消息历史
```

### 5.3 加入房间流程

```
用户选择房间 → WebSocket(join_room) → 服务器更新房间成员列表
                                     → 广播 user_joined 事件
                                     → 发送房间历史消息
```

## 6. 内存数据结构

```rust
struct User {
    username: String,
    password_hash: String,
}

struct Room {
    id: String,
    name: String,
    members: HashSet<Username>,
    messages: Vec<Message>,
}

struct Message {
    id: Uuid,
    sender: String,
    content: MessageContent,
    timestamp: i64,
}

enum MessageContent {
    Text(String),
    Image(String),  // base64 or url
}
```

## 7. 安全考虑

1. 密码使用 bcrypt 哈希存储
2. JWT token 签名验证
3. CORS 配置限制来源
4. 消息大小限制
5. 房间成员数量限制

## 8. 扩展点

- 添加数据库持久化 (SQLite/PostgreSQL)
- 私聊功能 (1对1房间)
- 文件上传 (S3/本地存储)
- 消息搜索
- 用户在线状态
- 管理员权限
