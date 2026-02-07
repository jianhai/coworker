#!/bin/bash

# 聊天室管理脚本
# 用法: ./chatroom.sh {start|stop|restart|status|help}

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PIDS_FILE="$PROJECT_DIR/.pids"
LOGS_DIR="$PROJECT_DIR/logs"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印标题
print_header() {
    local title="$1"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}       $title${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# 启动后端
start_backend() {
    echo -e "${GREEN}[1/2] 启动后端服务...${NC}"
    cd "$BACKEND_DIR"
    nohup cargo run > "$LOGS_DIR/backend.log" 2>&1 &
    local pid=$!
    echo $pid >> "$PIDS_FILE"

    # 等待后端启动
    echo "等待后端服务启动..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ 后端服务启动成功${NC} (PID: $pid, http://127.0.0.1:3000)"
            return 0
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}✗ 后端服务启动超时${NC}"
            echo "查看日志: cat $LOGS_DIR/backend.log"
            return 1
        fi
        sleep 1
    done
}

# 启动前端
start_frontend() {
    echo -e "${GREEN}[2/2] 启动前端服务...${NC}"
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$LOGS_DIR/frontend.log" 2>&1 &
    local pid=$!
    echo $pid >> "$PIDS_FILE"

    # 等待前端启动
    sleep 3

    # 从日志中提取实际端口
    local port=$(grep -o 'localhost:[0-9]*' "$LOGS_DIR/frontend.log" 2>/dev/null | grep -o '[0-9]*$' | tail -1)
    if [ -z "$port" ]; then
        port=5173
    fi

    echo -e "${GREEN}✓ 前端服务启动成功${NC} (PID: $pid, http://127.0.0.1:$port)"
}

# 启动服务
cmd_start() {
    print_header "聊天室服务启动"

    # 检查是否已经在运行
    if [ -f "$PIDS_FILE" ]; then
        local backend_pid=$(sed -n '1p' "$PIDS_FILE" 2>/dev/null)
        local frontend_pid=$(sed -n '2p' "$PIDS_FILE" 2>/dev/null)

        local running=false
        if [ -n "$backend_pid" ] && ps -p "$backend_pid" > /dev/null 2>&1; then
            running=true
        fi
        if [ -n "$frontend_pid" ] && ps -p "$frontend_pid" > /dev/null 2>&1; then
            running=true
        fi

        if [ "$running" = true ]; then
            echo -e "${YELLOW}检测到服务已在运行${NC}"
            echo "请先运行: $0 stop"
            exit 1
        fi
        rm -f "$PIDS_FILE"
    fi

    # 创建日志目录
    mkdir -p "$LOGS_DIR"
    rm -f "$PIDS_FILE"

    # 启动服务
    if start_backend && start_frontend; then
        echo ""
        print_header "启动完成"

        # 从日志中提取实际端口
        local frontend_port=$(grep -oE 'Local: http://localhost:[0-9]+' "$LOGS_DIR/frontend.log" 2>/dev/null | grep -oE '[0-9]+$' | tail -1)
        if [ -z "$frontend_port" ]; then
            frontend_port=5173
        fi

        echo -e "  后端: ${GREEN}http://127.0.0.1:3000${NC}"
        echo -e "  前端: ${GREEN}http://127.0.0.1:$frontend_port${NC}"
        echo ""
        echo "  查看日志:"
        echo "    后端: tail -f $LOGS_DIR/backend.log"
        echo "    前端: tail -f $LOGS_DIR/frontend.log"
        echo ""
        echo -e "  停止服务: ${YELLOW}$0 stop${NC}"
        echo ""
    else
        echo -e "${RED}启动失败，请查看日志${NC}"
        exit 1
    fi
}

# 停止服务
cmd_stop() {
    print_header "聊天室服务停止"

    local found=false

    # 从 PID 文件读取
    if [ -f "$PIDS_FILE" ]; then
        local backend_pid=$(sed -n '1p' "$PIDS_FILE" 2>/dev/null)
        local frontend_pid=$(sed -n '2p' "$PIDS_FILE" 2>/dev/null)

        if [ -n "$backend_pid" ] && ps -p "$backend_pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}停止后端服务${NC} (PID: $backend_pid)..."
            kill "$backend_pid" 2>/dev/null || true
            sleep 1
            ps -p "$backend_pid" > /dev/null 2>&1 && kill -9 "$backend_pid" 2>/dev/null || true
            echo -e "${GREEN}✓ 后端服务已停止${NC}"
            found=true
        fi

        if [ -n "$frontend_pid" ] && ps -p "$frontend_pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}停止前端服务${NC} (PID: $frontend_pid)..."
            kill "$frontend_pid" 2>/dev/null || true
            sleep 1
            ps -p "$frontend_pid" > /dev/null 2>&1 && kill -9 "$frontend_pid" 2>/dev/null || true
            echo -e "${GREEN}✓ 前端服务已停止${NC}"
            found=true
        fi

        rm -f "$PIDS_FILE"
    fi

    # 通过进程名查找并终止
    local backend_pids=$(pgrep -f "chatroom-backend" 2>/dev/null || true)
    if [ -n "$backend_pids" ]; then
        echo -e "${YELLOW}发现残留后端进程，正在终止...${NC}"
        kill $backend_pids 2>/dev/null || true
        sleep 1
        pkill -9 -f "chatroom-backend" 2>/dev/null || true
        echo -e "${GREEN}✓ 后端进程已终止${NC}"
        found=true
    fi

    local frontend_pids=$(pgrep -f "vite.*chatroom" 2>/dev/null || true)
    if [ -n "$frontend_pids" ]; then
        echo -e "${YELLOW}发现残留前端进程，正在终止...${NC}"
        kill $frontend_pids 2>/dev/null || true
        sleep 1
        pkill -9 -f "vite.*chatroom" 2>/dev/null || true
        echo -e "${GREEN}✓ 前端进程已终止${NC}"
        found=true
    fi

    if [ "$found" = false ]; then
        echo -e "${YELLOW}未找到运行中的服务${NC}"
    else
        echo ""
        print_header "停止完成"
    fi
}

# 重启服务
cmd_restart() {
    print_header "聊天室服务重启"
    echo ""

    # 先停止服务
    echo -e "${YELLOW}[1/2] 停止服务...${NC}"
    cmd_stop

    # 等待一秒确保进程完全终止
    sleep 1

    # 启动服务
    echo ""
    echo -e "${YELLOW}[2/2] 启动服务...${NC}"
    cmd_start
}

# 查看状态
cmd_status() {
    print_header "聊天室服务状态"
    echo ""

    # 检查后端
    local backend_running=false
    local backend_pid=""

    if [ -f "$PIDS_FILE" ]; then
        local recorded_pid=$(sed -n '1p' "$PIDS_FILE" 2>/dev/null)
        if [ -n "$recorded_pid" ] && ps -p "$recorded_pid" > /dev/null 2>&1; then
            backend_running=true
            backend_pid=$recorded_pid
        fi
    fi

    if [ "$backend_running" = false ]; then
        backend_pid=$(pgrep -f "chatroom-backend" | head -1 2>/dev/null || true)
        if [ -n "$backend_pid" ]; then
            backend_running=true
        fi
    fi

    echo -ne "后端服务: "
    if [ "$backend_running" = true ]; then
        if curl -s http://127.0.0.1:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}运行中${NC} (PID: $backend_pid)"
            echo -e "          ${CYAN}URL: http://127.0.0.1:3000${NC}"
        else
            echo -e "${YELLOW}进程存在但无响应${NC} (PID: $backend_pid)"
        fi
    else
        echo -e "${RED}未运行${NC}"
    fi

    # 检查前端
    local frontend_running=false
    local frontend_pid=""
    local frontend_port=""

    if [ -f "$PIDS_FILE" ]; then
        local recorded_pid=$(sed -n '2p' "$PIDS_FILE" 2>/dev/null)
        if [ -n "$recorded_pid" ] && ps -p "$recorded_pid" > /dev/null 2>&1; then
            frontend_running=true
            frontend_pid=$recorded_pid
        fi
    fi

    if [ "$frontend_running" = false ]; then
        frontend_pid=$(pgrep -f "vite.*chatroom" | head -1 2>/dev/null || true)
        if [ -n "$frontend_pid" ]; then
            frontend_running=true
        fi
    fi

    # 检测实际端口 - 使用 lsof
    if [ "$frontend_running" = true ] && [ -n "$frontend_pid" ]; then
        frontend_pid=$(pgrep -f "vite" | head -1 2>/dev/null || true)
        if [ -n "$frontend_pid" ]; then
            frontend_port=$(lsof -Pan -p $frontend_pid -i 2>/dev/null | grep -o 'TCP.*:[0-9]* (LISTEN)' | grep -o '[0-9]*$' | head -1)
        fi
    fi

    # 如果 lsof 失败，从日志文件提取
    if [ -z "$frontend_port" ] && [ -f "$LOGS_DIR/frontend.log" ]; then
        frontend_port=$(grep -o 'localhost:[0-9]*' "$LOGS_DIR/frontend.log" | grep -o '[0-9]*$' | tail -1)
    fi

    # 默认端口
    if [ -z "$frontend_port" ]; then
        frontend_port="5173"
    fi

    echo -ne "前端服务: "
    if [ "$frontend_running" = true ]; then
        echo -e "${GREEN}运行中${NC} (PID: $frontend_pid)"
        echo -e "          ${CYAN}URL: http://127.0.0.1:$frontend_port${NC}"
    else
        echo -e "${RED}未运行${NC}"
    fi

    # 日志文件
    echo ""
    echo "日志文件:"
    if [ -f "$LOGS_DIR/backend.log" ]; then
        echo "  后端: $LOGS_DIR/backend.log"
    else
        echo "  后端: ${YELLOW}(无日志)${NC}"
    fi

    if [ -f "$LOGS_DIR/frontend.log" ]; then
        echo "  前端: $LOGS_DIR/frontend.log"
    else
        echo "  前端: ${YELLOW}(无日志)${NC}"
    fi

    echo ""
}

# 显示帮助
cmd_help() {
    print_header "聊天室管理脚本"
    echo ""
    echo "用法: $0 {start|stop|restart|status|help}"
    echo ""
    echo "命令:"
    echo "  start   启动后端和前端服务"
    echo "  stop    停止所有服务"
    echo "  restart 重启所有服务"
    echo "  status  查看服务运行状态"
    echo "  help    显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start    # 启动服务"
    echo "  $0 restart  # 重启服务"
    echo "  $0 status   # 查看状态"
    echo "  $0 stop     # 停止服务"
    echo ""
}

# 主函数
main() {
    local cmd="${1:-help}"

    case "$cmd" in
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        restart)
            cmd_restart
            ;;
        status)
            cmd_status
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            echo -e "${RED}错误: 未知命令 '$cmd'${NC}"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
