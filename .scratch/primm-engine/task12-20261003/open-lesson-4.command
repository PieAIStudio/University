#!/bin/zsh

# Double-clickable local Owner preview for PRIMM lesson 4. This file only
# starts the loopback preview; it does not change the product or course data.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PREVIEW_ROOT="$SCRIPT_DIR/unpublished-authoring/previews/2026-10-03T11-31-52-918Z"
LESSON_URL="http://127.0.0.1:23150/ai-literacy/understanding-ai/first-useful-step/edit-one-part?lang=zh-CN"
OLLAMA_TAGS_URL="http://127.0.0.1:11434/api/tags"
PREVIEW_MODEL="university-primm-local"
APP_PORT=23150
API_PORT=23151
PREVIEW_PID=""
STOPPING=0

fail() {
  print -u2 "第 4 关预览没有启动：$1"
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "本机没有 curl，无法检查 Ollama。"
command -v node >/dev/null 2>&1 || fail "本机没有 Node.js，无法启动预览。"
[[ -d "$PREVIEW_ROOT" ]] || fail "找不到第 4 关的预览资料，请确认仓库没有被移动。"

if ! curl -fsS --max-time 3 "$OLLAMA_TAGS_URL" >| "$TMPDIR/university-ollama-tags.$$.json"; then
  rm -f "$TMPDIR/university-ollama-tags.$$.json"
  fail "Ollama 没有在 127.0.0.1:11434 运行。"
fi
if ! OLLAMA_TAGS_FILE="$TMPDIR/university-ollama-tags.$$.json" PREVIEW_MODEL="$PREVIEW_MODEL" node - <<'NODE'
const fs = require("node:fs");
const tags = JSON.parse(fs.readFileSync(process.env.OLLAMA_TAGS_FILE, "utf8"));
const model = process.env.PREVIEW_MODEL;
const ready = (tags.models ?? []).some(({ name }) => name === model || name === `${model}:latest`);
process.exit(ready ? 0 : 1);
NODE
then
  rm -f "$TMPDIR/university-ollama-tags.$$.json"
  fail "Ollama 已运行，但没有模型 university-primm-local。"
fi
rm -f "$TMPDIR/university-ollama-tags.$$.json"

stop_process_group() {
  local pid="$1" pgid
  [[ -n "$pid" ]] || return 0
  pgid="$(ps -p "$pid" -o pgid= 2>/dev/null | tr -d ' ')"
  [[ -n "$pgid" && "$pgid" != "$$" && "$pgid" != "$(ps -p $$ -o pgid= | tr -d ' ')" ]] || return 0
  /bin/kill -TERM -- "-$pgid" 2>/dev/null || true
}

stop_known_preview_on_port() {
  local port="$1" pid command pgid
  for pid in ${(f)"$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null)"}; do
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$port" == "$APP_PORT" && "$command" == *"vite"* && "$command" == *"--port $APP_PORT"* ]]; then
      print "正在清理上次遗留的第 4 关页面进程……"
      stop_process_group "$pid"
    elif [[ "$port" == "$API_PORT" && "$command" == *"primm-preview.mjs"* ]]; then
      print "正在清理上次遗留的第 4 关执行端……"
      stop_process_group "$pid"
    else
      fail "端口 $port 已被其他程序占用，请先关闭它。"
    fi
  done
  for _ in {1..30}; do
    lsof -tiTCP:$port -sTCP:LISTEN >/dev/null 2>&1 || return 0
    sleep 0.2
  done
  fail "端口 $port 的旧进程没有退出。"
}

stop_known_preview_on_port "$APP_PORT"
stop_known_preview_on_port "$API_PORT"

cleanup() {
  [[ "$STOPPING" == 1 ]] && return 0
  STOPPING=1
  if [[ -n "$PREVIEW_PID" ]]; then
    kill -TERM "$PREVIEW_PID" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$PREVIEW_PID" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM HUP

cd "$ROOT_DIR" || fail "无法进入 University 仓库。"
UNIVERSITY_PRIMM_PREVIEW_ROOT="$PREVIEW_ROOT" \
  pnpm primm:preview &
PREVIEW_PID=$!

for _ in {1..120}; do
  if curl -fsS --max-time 1 "$LESSON_URL" >/dev/null 2>&1 && \
     curl -fsS --max-time 1 \
       -H "Origin: http://127.0.0.1:$APP_PORT" \
       -H "X-University-Primm: owner-preview-v1" \
       "http://127.0.0.1:$API_PORT/status" >/dev/null 2>&1; then
    print "第 4 关已打开：$LESSON_URL"
    open "$LESSON_URL"
    wait "$PREVIEW_PID"
    exit $?
  fi
  if ! kill -0 "$PREVIEW_PID" 2>/dev/null; then
    wait "$PREVIEW_PID"
    fail "预览进程提前退出，请看上面的具体原因。"
  fi
  sleep 0.5
done

fail "页面或执行端在 60 秒内没有准备好。"
