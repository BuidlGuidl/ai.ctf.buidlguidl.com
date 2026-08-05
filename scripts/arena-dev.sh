#!/usr/bin/env bash

set -Eeuo pipefail

# Local operator setup:
# 1. Copy packages/nextjs/.env.example to packages/nextjs/.env.local.
# 2. Set NEXT_PUBLIC_ARENA_DEV_SIGNER_KEY to Hardhat account 0:
#    0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# 3. Start this script. The defaults allowlist the matching address.
# That key signs the operator login and the run seed without a wallet prompt.
# To rehearse the real wallet prompts, import the same key into a browser wallet,
# connect it, and leave the dev key empty. Never use this public key off a local chain.

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly DEFAULT_OPERATOR_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

ONLY_SERVICE=""
SKIPPED_SERVICES=" "
PIDS=()
PID_NAMES=()
STARTED_PID=""

usage() {
  printf 'Usage: scripts/arena-dev.sh [--only <chain|backend|ponder|next>] [--skip <service>]\n'
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

valid_service() {
  case "$1" in
    chain|backend|ponder|next) return 0 ;;
    *) return 1 ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only)
      [[ $# -ge 2 ]] || fail '--only needs a service name.'
      valid_service "$2" || fail "Unknown service: $2"
      ONLY_SERVICE="$2"
      shift 2
      ;;
    --skip)
      [[ $# -ge 2 ]] || fail '--skip needs a service name.'
      valid_service "$2" || fail "Unknown service: $2"
      SKIPPED_SERVICES="${SKIPPED_SERVICES}$2 "
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unknown argument: $1"
      ;;
  esac
done

service_enabled() {
  local service="$1"
  if [[ -n "$ONLY_SERVICE" && "$ONLY_SERVICE" != "$service" ]]; then
    return 1
  fi
  [[ "$SKIPPED_SERVICES" != *" $service "* ]]
}

absolute_from_root() {
  local value="$1"
  if [[ "$value" = /* ]]; then
    printf '%s' "$value"
  else
    printf '%s/%s' "$ROOT_DIR" "$value"
  fi
}

readonly AI_CTF_DIR="$(absolute_from_root "${AI_CTF_REPO:-$ROOT_DIR}")"
readonly BACKEND_DIR="$(absolute_from_root "${ARENA_BACKEND_DIR:-../agents-arena-backend.frontend-merge}")"
# The backend uses tsx watch, so this file preserves runs across watch restarts while each script invocation starts clean.
readonly DEFAULT_ARENA_DB="${TMPDIR:-/tmp}/arena-dev-$$.db"

prefix_logs() {
  local service="$1"
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '[%-7s] %s\n' "$service" "$line"
  done
}

start_service() {
  local service="$1"
  local workdir="$2"
  shift 2

  (
    cd "$workdir"
    exec "$@"
  ) > >(prefix_logs "$service") 2>&1 &
  STARTED_PID="$!"
  PIDS+=("$STARTED_PID")
  PID_NAMES+=("$service")
  printf '[arena  ] started %s with pid %s\n' "$service" "$STARTED_PID"
}

run_step() {
  local service="$1"
  local workdir="$2"
  shift 2
  (
    cd "$workdir"
    "$@"
  ) 2>&1 | prefix_logs "$service"
}

chain_ready() {
  local response
  response="$(curl --silent --show-error --max-time 2 \
    --header 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    http://127.0.0.1:8545 2>/dev/null || true)"
  [[ "$response" == *'"result"'* ]]
}

wait_for_chain() {
  local chain_pid="$1"
  local attempt
  for attempt in {1..60}; do
    chain_ready && return 0
    kill -0 "$chain_pid" 2>/dev/null || return 1
    sleep 1
  done
  return 1
}

PROCESS_TREE=()

collect_process_tree() {
  local parent="$1"
  local child
  PROCESS_TREE+=("$parent")
  while IFS= read -r child; do
    [[ -n "$child" ]] && collect_process_tree "$child"
  done < <(pgrep -P "$parent" 2>/dev/null || true)
}

terminate_process_tree() {
  local root_pid="$1"
  local tree_pid
  PROCESS_TREE=()
  collect_process_tree "$root_pid"
  for tree_pid in "${PROCESS_TREE[@]}"; do
    kill -TERM "$tree_pid" 2>/dev/null || true
  done
}

cleanup() {
  local status=$?
  local pid
  trap - EXIT INT TERM
  if [[ ${#PIDS[@]} -gt 0 ]]; then
    printf '[arena  ] stopping services\n'
    for pid in "${PIDS[@]}"; do
      terminate_process_tree "$pid"
    done
    for pid in "${PIDS[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  fi
  exit "$status"
}

trap 'exit 130' INT TERM
trap cleanup EXIT

if ! service_enabled chain && ! service_enabled backend && ! service_enabled ponder && ! service_enabled next; then
  fail 'No services remain after applying --only and --skip.'
fi

if service_enabled chain || service_enabled backend; then
  [[ -f "$AI_CTF_DIR/package.json" ]] || \
    fail "AI_CTF_REPO must point to an ai.ctf.buidlguidl.com checkout. Missing: $AI_CTF_DIR/package.json"
fi

if service_enabled backend; then
  [[ -f "$BACKEND_DIR/package.json" ]] || \
    fail "ARENA_BACKEND_DIR must point to the backend checkout. Missing: $BACKEND_DIR/package.json"
fi

if service_enabled chain || service_enabled ponder || service_enabled next; then
  command -v yarn >/dev/null 2>&1 || fail 'yarn is required.'
fi
if service_enabled backend; then
  command -v pnpm >/dev/null 2>&1 || fail 'pnpm is required.'
  # better-sqlite3 is a native module. It only loads on the Node version that built it.
  (cd "$BACKEND_DIR/packages/backend" && node -e 'require("better-sqlite3")') >/dev/null 2>&1 || \
    fail "The backend's better-sqlite3 binary does not match this Node version ($(node --version)). Switch to Node 22, or rebuild it: (cd $BACKEND_DIR && pnpm rebuild better-sqlite3)"
fi
if service_enabled chain; then
  command -v curl >/dev/null 2>&1 || fail 'curl is required to check the local chain.'
fi

if service_enabled chain; then
  start_service chain "$AI_CTF_DIR" yarn workspace @se-2/hardhat chain
  readonly CHAIN_PID="$STARTED_PID"
  wait_for_chain "$CHAIN_PID" || fail 'The local chain did not become ready on port 8545.'
  run_step deploy "$AI_CTF_DIR" yarn deploy
fi

if service_enabled backend; then
  start_service backend "$BACKEND_DIR" env \
    PORT=4177 \
    ARENA_AUTO_SIGN="${ARENA_AUTO_SIGN:-false}" \
    ARENA_OPERATOR_TOKEN="${ARENA_OPERATOR_TOKEN:-local-arena-operator-token}" \
    ARENA_DB="${ARENA_DB:-$DEFAULT_ARENA_DB}" \
    ARENA_CORS_ORIGINS="${ARENA_CORS_ORIGINS:-http://localhost:3000}" \
    ARENA_OPERATOR_ADDRESSES="${ARENA_OPERATOR_ADDRESSES:-$DEFAULT_OPERATOR_ADDRESS}" \
    ARENA_SIWE_DOMAINS="${ARENA_SIWE_DOMAINS:-localhost:3000}" \
    ARENA_CHAIN_PROFILE=local \
    AI_CTF_REPO="$AI_CTF_DIR" \
    pnpm --filter backend dev
fi

if service_enabled ponder; then
  start_service ponder "$ROOT_DIR" yarn workspace @se-2/ponder dev
fi

if service_enabled next; then
  start_service next "$ROOT_DIR" yarn workspace @se-2/nextjs dev
fi

printf '[arena  ] services are running; press Ctrl-C to stop them\n'
while :; do
  for index in "${!PIDS[@]}"; do
    if ! kill -0 "${PIDS[$index]}" 2>/dev/null; then
      set +e
      wait "${PIDS[$index]}"
      status=$?
      set -e
      printf '[arena  ] %s exited with status %s\n' "${PID_NAMES[$index]}" "$status" >&2
      [[ $status -ne 0 ]] || status=1
      exit "$status"
    fi
  done
  sleep 1
done
