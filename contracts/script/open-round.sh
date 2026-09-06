#!/usr/bin/env bash
#
# Opens a round. Two shapes:
#
#   ./script/open-round.sh next          the next real round: locks at the coming 21:00 UTC
#                                        weekday close and settles 24 hours later
#   ./script/open-round.sh proof         a short round that locks in 10 minutes and settles 20
#                                        minutes after that, to prove the whole lifecycle onchain
#
# Environment: BASE_RPC_URL, GAMEWEEK, and ACCOUNT for the keystore name (default: deployer).
# NAME sets the league name. MAX_MEMBERS defaults to 20.
#
# Staleness tolerance is 26 hours on purpose. The Chainlink equity feeds publish on a 0.5% move or a
# 24 hour heartbeat, so a quiet feed is legitimately a day old and a tighter bound would refuse to
# settle a perfectly healthy league. Anything older than that is genuinely frozen.

set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-next}"
ACCOUNT="${ACCOUNT:-deployer}"
MAX_MEMBERS="${MAX_MEMBERS:-20}"
STALENESS=93600 # 26 hours
: "${BASE_RPC_URL:?set BASE_RPC_URL}"
: "${GAMEWEEK:?set GAMEWEEK to the deployed contract address}"

read -r START END LABEL <<< "$(python3 - "$MODE" <<'PY'
from datetime import datetime, timedelta, timezone
import sys

mode = sys.argv[1]
now = datetime.now(timezone.utc)

if mode == "proof":
    start = now + timedelta(minutes=10)
    end = start + timedelta(minutes=20)
    label = "short"
else:
    # The next 21:00 UTC that falls on a trading day. Feeds hold their last price at the weekend,
    # so a round opened into a Saturday would score every side zero.
    start = now.replace(hour=21, minute=0, second=0, microsecond=0)
    if start <= now + timedelta(minutes=30):
        start += timedelta(days=1)
    while start.weekday() >= 5:
        start += timedelta(days=1)
    end = start + timedelta(days=1)
    while end.weekday() >= 5:
        end += timedelta(days=1)
    label = f"{start:%a %H:%M} -> {end:%a %H:%M} UTC"

print(int(start.timestamp()), int(end.timestamp()), label)
PY
)"

NAME="${NAME:-$([ "$MODE" = proof ] && echo "Proof Round" || echo "Matchday")}"

echo "Opening \"$NAME\""
echo "  locks   $(date -u -r "$START" '+%a %d %b %H:%M') UTC"
echo "  settles $(date -u -r "$END" '+%a %d %b %H:%M') UTC"
echo "  members up to $MAX_MEMBERS, no buy-in"

cast send "$GAMEWEEK" \
  "createLeague(string,uint64,uint64,uint128,uint32,uint16)" \
  "$NAME" "$START" "$END" 0 "$STALENESS" "$MAX_MEMBERS" \
  --rpc-url "$BASE_RPC_URL" --account "$ACCOUNT" >/dev/null

COUNT=$(cast call "$GAMEWEEK" "leagueCount()(uint256)" --rpc-url "$BASE_RPC_URL" | sed 's/ \[.*\]//')
ID=$((COUNT - 1))

echo "  opened as league #$ID"
echo
echo "  Join it at:  ${APP_URL:-https://gameweek-bay.vercel.app}/league/$ID"
echo "  Watch it at: ${APP_URL:-https://gameweek-bay.vercel.app}/spectate/$ID"
