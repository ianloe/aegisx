#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ]; then
  case "$SESSION_SECRET" in
    ""|*CHANGE_ME*)
      echo "FATAL: SESSION_SECRET is unset or still a placeholder value. Refusing to start in production." >&2
      exit 1
      ;;
  esac
  if [ "${#SESSION_SECRET}" -lt 32 ]; then
    echo "FATAL: SESSION_SECRET must be at least 32 characters in production." >&2
    exit 1
  fi
  case "$INITIAL_ADMIN_PASSWORD" in
    ""|*CHANGE_ME*)
      echo "FATAL: INITIAL_ADMIN_PASSWORD is unset or still a placeholder value. Refusing to start in production." >&2
      exit 1
      ;;
  esac
fi

echo "{\"level\":\"info\",\"msg\":\"Running Prisma migrations...\"}"
prisma migrate deploy

echo "{\"level\":\"info\",\"msg\":\"Running idempotent seed...\"}"
node ./prisma/seed.cjs

echo "{\"level\":\"info\",\"msg\":\"Starting AI Governance Command Centre...\"}"
exec node server.js
