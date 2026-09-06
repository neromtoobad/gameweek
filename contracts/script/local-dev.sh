#!/usr/bin/env bash
#
# Stands up a complete Gameweek world on a local anvil node, so the league screens can be built and
# tested without spending anything on mainnet.
#
#   cd contracts && ./script/local-dev.sh
#
# Then point the app at it:
#   NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 NEXT_PUBLIC_GAMEWEEK=<printed address> bun dev
#
# The real B20 tokens are Base node precompiles and cannot be executed by any local chain, so this
# uses mock tokens with the same 8 decimals and mock feeds seeded with real Base prices. Everything
# above the token layer, which is all of the league logic, behaves exactly as it does on mainnet.

set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${RPC:-http://127.0.0.1:8545}"
# anvil's first well-known account. Local only, and worthless.
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

bold() { printf "\033[1m%s\033[0m\n" "$1"; }

# ---------------------------------------------------------------- anvil

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  bold "Starting anvil"
  anvil --silent > /tmp/gameweek-anvil.log 2>&1 &
  for _ in $(seq 1 20); do
    cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi
cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 || { echo "anvil did not start; see /tmp/gameweek-anvil.log" >&2; exit 1; }
echo "  anvil on $RPC"

# ---------------------------------------------------------------- deploy

bold "Deploying"
OUT=$(forge script script/LocalDev.s.sol:LocalDev --rpc-url "$RPC" --broadcast --private-key "$DEPLOYER_KEY" 2>&1)
echo "$OUT" | grep -qE "ONCHAIN EXECUTION COMPLETE" || { echo "$OUT" | tail -30; exit 1; }

field() { echo "$OUT" | grep -oE "$1 +0x[0-9a-fA-F]{40}" | head -1 | awk '{print $NF}'; }
num()   { echo "$OUT" | grep -oE "$1 +[0-9]+" | head -1 | awk '{print $NF}'; }

GAMEWEEK=$(field "GAMEWEEK")
USDC=$(field "USDC")
OPEN_LEAGUE=$(num "OPEN_LEAGUE")
LIVE_LEAGUE=$(num "LIVE_LEAGUE")
echo "  Gameweek $GAMEWEEK"
echo "  USDC     $USDC"

# ---------------------------------------------------------------- players join

bold "Seeding the live league"
for NAME in alice bob carol; do
  KEY=$(cast keccak "gameweek.$NAME")
  ADDR=$(cast wallet address --private-key "$KEY")
  cast rpc anvil_setBalance "$ADDR" 0xde0b6b3a7640000 --rpc-url "$RPC" >/dev/null
  cast send "$GAMEWEEK" "join(uint256)" "$LIVE_LEAGUE" --rpc-url "$RPC" --private-key "$KEY" >/dev/null
  echo "  $NAME joined ($ADDR)"
done

# Past the league's start so it can be locked. anvil's clock, not the script's.
cast rpc evm_increaseTime 120 --rpc-url "$RPC" >/dev/null
cast rpc evm_mine --rpc-url "$RPC" >/dev/null

cast send "$GAMEWEEK" "lock(uint256)" "$LIVE_LEAGUE" --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" >/dev/null
echo "  locked, starting NAVs recorded"

cast send "$GAMEWEEK" "sponsor(uint256,uint128)" "$LIVE_LEAGUE" 2500000 --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" >/dev/null
echo "  pot seeded with 2.50 USDC"

# ---------------------------------------------------------------- report

bold "Ready"
clean() { sed 's/ \[.*\]//'; }
echo "  leagues        $(cast call "$GAMEWEEK" 'leagueCount()(uint256)' --rpc-url "$RPC" | clean)"
echo "  tokens         $(cast call "$GAMEWEEK" 'tokenCount()(uint256)' --rpc-url "$RPC" | clean)"
echo "  live members   $(cast call "$GAMEWEEK" 'memberCount(uint256)(uint256)' "$LIVE_LEAGUE" --rpc-url "$RPC" | clean)"
for NAME in alice bob carol; do
  ADDR=$(cast wallet address --private-key "$(cast keccak "gameweek.$NAME")")
  NAV=$(cast call "$GAMEWEEK" 'navOf(address)(uint256)' "$ADDR" --rpc-url "$RPC" | clean)
  printf "  %-14s %s (nav %s)\n" "$NAME" "$ADDR" "$NAV"
done

cat <<EOF

  Run the app against it:

    cd ../app
    NEXT_PUBLIC_RPC_URL=$RPC NEXT_PUBLIC_GAMEWEEK=$GAMEWEEK bun dev

  Open league (drafting):  $OPEN_LEAGUE
  Live league (locked):    $LIVE_LEAGUE
EOF
