export type MessageContent =
  | { content_type: 'text'; text: string }
  | { content_type: 'image'; image: string }

export interface Message {
  id: string
  sender: string
  content: MessageContent
  timestamp: number
  room_id: string
}

export interface Room {
  id: string
  name: string
  member_count: number
  members?: string[]
}

export interface ClientMessage {
  type: 'join_room' | 'leave_room' | 'message' | 'typing'
  room_id?: string
  content?: MessageContent
}

export interface ServerMessage {
  type: 'message' | 'user_joined' | 'user_left' | 'typing' | 'error' | 'history'
  room_id?: string
  message?: Message
  username?: string
  messages?: Message[]
  error?: string
}

export interface AuthResponse {
  token: string
  username: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
}

// Bot related types
export interface Bot {
  id: string
  name: string
  avatar: string
  room_id: string
}

export interface BotDetail {
  id: string
  name: string
  avatar: string
  default_reply: string
  keywords: Record<string, string>
}

export interface CreateBotRequest {
  name: string
  avatar?: string
  default_reply?: string
  keywords?: Record<string, string>
  ai_model?: string
  system_prompt?: string
}

export interface RoomWithBot {
  room_id: string
  room_name: string
  bot: BotDetail
}
