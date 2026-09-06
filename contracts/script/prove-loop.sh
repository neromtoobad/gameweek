#!/usr/bin/env bash
#
# Proves the whole round lifecycle on Base mainnet, with real money, in about five minutes:
# open a round, join it, fund the pot, lock it, settle it, get paid.
#
#   cd contracts && set -a && . ../.env && set +a \
#     && GAMEWEEK=0x... ./script/prove-loop.sh
#
# Three keystore prompts, not six. Opening, joining and funding go in one forge broadcast; locking
# and settling cannot join them, because both read balances from B20 addresses and those are Base
# node precompiles that forge's local simulation cannot execute. Those two go through cast send,
# which submits straight to the node.
#
# Environment: BASE_RPC_URL, GAMEWEEK. ACCOUNT defaults to deployer, POT to 200000 (20 cents).

set -euo pipefail
cd "$(dirname "$0")/.."

ACCOUNT="${ACCOUNT:-deployer}"
POT="${POT:-200000}"
USDC="${USDC:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
: "${BASE_RPC_URL:?set BASE_RPC_URL}"
: "${GAMEWEEK:?set GAMEWEEK to the deployed contract address}"

bold() { printf "\n\033[1m%s\033[0m\n" "$1"; }
clean() { sed 's/ \[.*\]//'; }

NOW=$(date +%s)
START=$((NOW + 150))
END=$((START + 150))

bold "1/4  Opening a round, joining it, funding the pot"
echo "  locks   $(date -u -r "$START" '+%H:%M:%S') UTC"
echo "  settles $(date -u -r "$END" '+%H:%M:%S') UTC"
echo "  pot     \$$(python3 -c "print(f'{$POT/1e6:.2f}')")"

OUT=$(GAMEWEEK="$GAMEWEEK" USDC="$USDC" START="$START" END="$END" POT="$POT" \
  forge script script/ProveLoop.s.sol:ProveLoop \
  --rpc-url "$BASE_RPC_URL" --account "$ACCOUNT" --broadcast 2>&1)
echo "$OUT" | grep -qE "ONCHAIN EXECUTION COMPLETE" || { echo "$OUT" | tail -25; exit 1; }

ID=$(echo "$OUT" | grep -oE "LEAGUE_ID +[0-9]+" | head -1 | awk '{print $NF}')
echo "  league  #$ID"

wait_until() {
  local target="$1" label="$2"
  while [ "$(date +%s)" -lt "$target" ]; do
    printf "\r  waiting for %s, %ss to go   " "$label" "$((target - $(date +%s)))"
    sleep 5
  done
  printf "\r%-56s\r" " "
}

bold "2/4  Locking"
wait_until "$START" "lock"
LOCK_TX=$(cast send "$GAMEWEEK" "lock(uint256)" "$ID" \
  --rpc-url "$BASE_RPC_URL" --account "$ACCOUNT" --json | python3 -c "import sys,json;print(json.load(sys.stdin)['transactionHash'])")
echo "  locked  https://basescan.org/tx/$LOCK_TX"

MEMBERS=$(cast call "$GAMEWEEK" "getMembers(uint256)(address[])" "$ID" --rpc-url "$BASE_RPC_URL" | clean)
DEPLOYER=$(cast wallet address --account "$ACCOUNT")
NAV_START=$(cast call "$GAMEWEEK" "navStart(uint256,address)(uint256)" "$ID" "$DEPLOYER" --rpc-url "$BASE_RPC_URL" | clean)
echo "  starting NAV recorded: \$$(python3 -c "print(f'{$NAV_START/1e6:.2f}')")"

bold "3/4  Settling"
wait_until "$END" "settle"
BEFORE=$(cast call "$USDC" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$BASE_RPC_URL" | clean)
SETTLE_TX=$(cast send "$GAMEWEEK" "settle(uint256)" "$ID" \
  --rpc-url "$BASE_RPC_URL" --account "$ACCOUNT" --json | python3 -c "import sys,json;print(json.load(sys.stdin)['transactionHash'])")
AFTER=$(cast call "$USDC" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$BASE_RPC_URL" | clean)
echo "  settled https://basescan.org/tx/$SETTLE_TX"

bold "4/4  Reading it back"
SETTLED=$(cast call "$GAMEWEEK" "getLeague(uint256)((string,uint64,uint64,uint32,uint16,uint128,uint128,uint128,bool,bool,bool))" "$ID" --rpc-url "$BASE_RPC_URL" | clean)
PODIUM=$(cast call "$GAMEWEEK" "getPodium(uint256)(address[3])" "$ID" --rpc-url "$BASE_RPC_URL" | clean | tr '\n' ' ')
echo "  league  $SETTLED"
echo "  podium  $PODIUM"
echo "  paid    \$$(python3 -c "print(f'{($AFTER-$BEFORE)/1e6:.2f}')") back to the winner"

cat <<EOF

  Round #$ID, opened, joined, locked and settled on Base mainnet.

    lock    https://basescan.org/tx/$LOCK_TX
    settle  https://basescan.org/tx/$SETTLE_TX
    league  ${APP_URL:-https://gameweek-bay.vercel.app}/spectate/$ID
EOF
