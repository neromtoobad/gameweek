#!/usr/bin/env bash
#
# Registers every tradeable Coinbase Tokenized Stock on a deployed Gameweek contract.
#
#   ./script/register-tokens.sh 0xGameweekAddress [--all]
#
# Why this is a shell script and not a forge script: setToken reads decimals() from a B20 address,
# and B20 tokens are Base node precompiles with no bytecode. `forge script` simulates locally before
# broadcasting and cannot execute a precompile, so it dies with OpcodeNotFound even with --broadcast.
# `cast send` submits straight to the node, which runs the precompile natively.
#
# All the tokens go in one setTokens call, so this is one signature and one transaction. A partially
# registered contract would price some leagues against nothing.
#
# By default only listings with supply are registered. Pass --all to include the three that have
# nothing minted, which no router can trade into anyway.
#
# Environment: BASE_RPC_URL, and ACCOUNT for the keystore account name (default: deployer).

set -euo pipefail

GAMEWEEK="${1:-}"
[ -z "$GAMEWEEK" ] && { echo "usage: $0 <gameweek-address> [--all]" >&2; exit 1; }
ALL="${2:-}"
ACCOUNT="${ACCOUNT:-deployer}"
: "${BASE_RPC_URL:?set BASE_RPC_URL}"

CONFIG="$(dirname "$0")/../config/tokens.json"

read -r TICKERS TOKENS FEEDS <<< "$(python3 - "$CONFIG" "$ALL" <<'PY'
import json, sys
config, mode = sys.argv[1], sys.argv[2]
listings = json.load(open(config))["listings"]
chosen = [l for l in listings if l["live"] or mode == "--all"]
print(
    ",".join(l["ticker"] for l in chosen),
    "[" + ",".join(l["token"] for l in chosen) + "]",
    "[" + ",".join(l["feed"] for l in chosen) + "]",
)
PY
)"

COUNT=$(awk -F, '{print NF}' <<< "$TICKERS")
echo "Registering $COUNT tokens on $GAMEWEEK as '$ACCOUNT'"
echo "  $TICKERS"

cast send "$GAMEWEEK" "setTokens(address[],address[])" "$TOKENS" "$FEEDS" \
  --rpc-url "$BASE_RPC_URL" --account "$ACCOUNT" >/dev/null

ONCHAIN=$(cast call "$GAMEWEEK" "tokenCount()(uint256)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')
echo "  contract reports tokenCount = $ONCHAIN"
[ "$ONCHAIN" = "$COUNT" ] || { echo "  WARNING: expected $COUNT" >&2; exit 1; }
