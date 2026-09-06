#!/usr/bin/env bash
# Registers every live Coinbase Tokenized Stock on a deployed SundayLeague.
#
#   ./script/register-tokens.sh 0xLeagueAddress [--all]
#
# Why this is a shell script and not a forge script: setToken reads decimals() from a B20 address,
# and B20 tokens are Base node precompiles with no bytecode. `forge script` simulates locally before
# broadcasting and cannot execute a precompile, so it fails with OpcodeNotFound. `cast send` submits
# straight to the node, which runs the precompile natively.
#
# Requires: BASE_RPC_URL, and a Foundry keystore account named "deployer" (override with ACCOUNT).
set -euo pipefail

LEAGUE="${1:-}"
[ -z "$LEAGUE" ] && { echo "usage: $0 <league-address> [--all]" >&2; exit 1; }
ALL="${2:-}"
ACCOUNT="${ACCOUNT:-deployer}"
: "${BASE_RPC_URL:?set BASE_RPC_URL}"

CONFIG="$(dirname "$0")/../config/tokens.json"
COUNT=$(python3 -c "import json;print(json.load(open('$CONFIG'))['count'])")

echo "Registering tokens on $LEAGUE using account '$ACCOUNT'"
registered=0

for i in $(seq 0 $((COUNT - 1))); do
  read -r TICKER TOKEN FEED LIVE <<< "$(python3 -c "
import json
l = json.load(open('$CONFIG'))['listings'][$i]
print(l['ticker'], l['token'], l['feed'], str(l['live']).lower())
")"

  if [ "$LIVE" != "true" ] && [ "$ALL" != "--all" ]; then
    echo "  skip    $TICKER (zero supply, pass --all to include)"
    continue
  fi

  echo "  setToken $TICKER $TOKEN"
  cast send "$LEAGUE" "setToken(address,address)" "$TOKEN" "$FEED" \
    --rpc-url "$BASE_RPC_URL" --account "$ACCOUNT" >/dev/null
  registered=$((registered + 1))
done

ONCHAIN=$(cast call "$LEAGUE" "tokenCount()(uint256)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')
echo "Registered $registered tokens. Contract reports tokenCount = $ONCHAIN"
