#!/usr/bin/env bash
#
# Deploys Gameweek to Base mainnet, end to end.
#
#   cd contracts && ./script/deploy-all.sh
#
# What it does:
#   1. checks the RPC, the signing account and its balance before spending anything
#   2. deploys Gameweek and GameweekRouter, and verifies them on Basescan
#   3. registers every tokenized stock that has liquidity
#   4. writes the addresses into app/.env.local so the front end picks them up
#   5. reads the contracts back to prove the deployment landed
#
# Environment:
#   BASE_RPC_URL       required. A dedicated node; the public endpoint throttles.
#   ACCOUNT            Foundry keystore account name. Default: deployer.
#   TREASURY           receives router fees. Default: the deploying address.
#   BASESCAN_API_KEY   optional. Without it the contracts deploy but stay unverified.
#
# You are prompted once for the keystore password. It is never written anywhere.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"

ACCOUNT="${ACCOUNT:-deployer}"
: "${BASE_RPC_URL:?set BASE_RPC_URL to a Base mainnet RPC}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
fail() { printf "\033[31m%s\033[0m\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------- preflight

bold "1/5  Preflight"

CHAIN=$(cast chain-id --rpc-url "$BASE_RPC_URL" 2>/dev/null) || fail "Cannot reach $BASE_RPC_URL"
[ "$CHAIN" = "8453" ] || fail "Expected Base mainnet (8453), got chain $CHAIN"
echo "  rpc        ok, chain $CHAIN"

# Check the keystore file rather than parsing `cast wallet list`, whose output is formatted for
# humans and does not print the bare account name.
KEYSTORE_DIR="${FOUNDRY_KEYSTORES_DIR:-$HOME/.foundry/keystores}"
[ -f "$KEYSTORE_DIR/$ACCOUNT" ] \
  || fail "No keystore account named '$ACCOUNT' in $KEYSTORE_DIR. Create one with: cast wallet import $ACCOUNT --interactive"

# This is the one password prompt. Everything after it reuses the unlocked address.
DEPLOYER=$(cast wallet address --account "$ACCOUNT") || fail "Could not unlock '$ACCOUNT'"
echo "  deployer   $DEPLOYER"

BAL=$(cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL")
BAL_ETH=$(cast to-unit "$BAL" ether)
echo "  balance    $BAL_ETH ETH"
# Measured on Base at 0.006 gwei: both contracts plus registration is about 0.00003 ETH, roughly
# seven cents. 0.0002 ETH is six times that, which covers retries and a few leagues.
if [ "$(echo "$BAL_ETH < 0.0002" | bc -l)" = "1" ]; then
  fail "Balance too low. Send at least 0.0002 ETH on Base to $DEPLOYER (about \$0.50) and run again."
fi

TREASURY="${TREASURY:-$DEPLOYER}"
echo "  treasury   $TREASURY"

# Build the whole forge invocation as one array. macOS ships bash 3.2, where expanding an empty
# array under `set -u` is an unbound variable error, so an array that is sometimes empty is a trap.
FORGE_ARGS=(
  script script/Deploy.s.sol:Deploy
  --rpc-url "$BASE_RPC_URL"
  --account "$ACCOUNT"
  --sender "$DEPLOYER"
  --broadcast
)
if [ -n "${BASESCAN_API_KEY:-}" ]; then
  FORGE_ARGS+=(--verify --etherscan-api-key "$BASESCAN_API_KEY")
  echo "  verify     on"
else
  echo "  verify     off (BASESCAN_API_KEY unset; verify later with forge verify-contract)"
fi

# ---------------------------------------------------------------- deploy

bold "2/5  Deploying"

TREASURY="$TREASURY" forge "${FORGE_ARGS[@]}"

RUN="broadcast/Deploy.s.sol/8453/run-latest.json"
[ -f "$RUN" ] || fail "No broadcast record at $RUN"

read -r GAMEWEEK ROUTER <<< "$(python3 - "$RUN" <<'PY'
import json, sys
run = json.load(open(sys.argv[1]))
created = [t for t in run["transactions"] if t.get("transactionType") == "CREATE"]
byname = {t.get("contractName"): t.get("contractAddress") for t in created}
gw, rt = byname.get("Gameweek"), byname.get("GameweekRouter")
if not gw or not rt:
    sys.exit(f"could not find both contracts in the broadcast record: {byname}")
print(gw, rt)
PY
)"

echo "  Gameweek       $GAMEWEEK"
echo "  GameweekRouter $ROUTER"

# ---------------------------------------------------------------- register

bold "3/5  Registering tokenized stocks"
# Registration cannot go through forge: setToken reads decimals() from a B20 address, and B20
# tokens are node precompiles that forge's local simulation cannot execute. One setTokens call, so
# one signature and no chance of a half-registered contract.
ACCOUNT="$ACCOUNT" ./script/register-tokens.sh "$GAMEWEEK"

# ---------------------------------------------------------------- wire up the app

bold "4/5  Writing app/.env.local"

ENV_FILE="$ROOT/app/.env.local"
touch "$ENV_FILE"
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines()
out = [f"{key}={value}" if l.startswith(f"{key}=") else l for l in lines]
open(path, "w").write("\n".join(out) + "\n")
PY
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
  echo "  $key=$value"
}
set_env NEXT_PUBLIC_GAMEWEEK "$GAMEWEEK"
set_env NEXT_PUBLIC_GAMEWEEK_ROUTER "$ROUTER"
set_env NEXT_PUBLIC_RPC_URL "$BASE_RPC_URL"
set_env NEXT_TELEMETRY_DISABLED 1

# ---------------------------------------------------------------- verify

bold "5/5  Reading the contracts back"

TOKENS=$(cast call "$GAMEWEEK" "tokenCount()(uint256)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')
LEAGUES=$(cast call "$GAMEWEEK" "leagueCount()(uint256)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')
FEE=$(cast call "$ROUTER" "feeBps()(uint16)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')
FEE_TO=$(cast call "$ROUTER" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')

echo "  tokens registered $TOKENS"
echo "  leagues           $LEAGUES"
echo "  router fee        $FEE bps -> $FEE_TO"
[ "$TOKENS" = "10" ] || echo "  WARNING: expected 10 registered tokens, got $TOKENS"

bold "Done"
cat <<EOF

  Gameweek        https://basescan.org/address/$GAMEWEEK
  GameweekRouter  https://basescan.org/address/$ROUTER

  Next:
    1. Open a league:
         LEAGUE=$GAMEWEEK NAME="Lagos Bulls" START=<epoch> END=<epoch> \\
           forge script script/Deploy.s.sol:CreateLeague \\
           --rpc-url \$BASE_RPC_URL --account $ACCOUNT --broadcast
    2. Restart the app so it picks up app/.env.local, then draft a \$2 pick to prove the loop.
EOF
