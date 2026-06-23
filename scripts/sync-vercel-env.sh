#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env" >&2
  exit 1
fi

add_env() {
  local key="$1"
  local value="$2"
  if [[ -z "${value// }" ]]; then
    echo "skip $key (empty)"
    return 0
  fi
  printf '%s' "$value" | vercel env add "$key" production --force --yes >/dev/null
  echo "set $key"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  [[ "$key" == "PORT" ]] && continue
  add_env "$key" "$value"
done < .env

add_env NODE_ENV production
add_env TWILIO_MOCK false

echo "done"
