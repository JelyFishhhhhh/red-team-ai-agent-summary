#!/usr/bin/env bash
# Convenience wrapper: load .env into the current shell and forward all
# args to import_to_neo4j.py. Keeps secrets out of process listings and
# shell history while supporting the standard --dry-run / --seed flow.
#
# Usage:
#   cp .env.example .env       # then edit .env with your real values
#   ./run.sh --seed ./seed_nodes.json
#   ./run.sh --seed ./seed_nodes.json --attackg ./out/attackg_nodes.json
#   ./run.sh --dry-run --seed ./seed_nodes.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE not found. Copy .env.example and fill in real values." >&2
  exit 1
fi

# Export all vars defined in .env without spilling values into the
# shell history or process listing of subshells.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

exec python3 "$SCRIPT_DIR/import_to_neo4j.py" "$@"
