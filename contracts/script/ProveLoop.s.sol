// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Gameweek} from "../src/Gameweek.sol";

/// @notice Opens a short round, joins it, and funds the pot, all in one broadcast.
///
/// @dev Three calls in one transaction batch means one keystore prompt instead of three. Locking
///      and settling cannot join them: both read balances from B20 addresses, which are Base node
///      precompiles that forge's local simulation cannot execute, so they run through `cast send`
///      afterwards. See script/prove-loop.sh.
contract ProveLoop is Script {
    uint32 constant STALENESS = 93_600; // 26h, past the feeds' 24h heartbeat

    function run() external returns (uint256 id) {
        Gameweek gameweek = Gameweek(vm.envAddress("GAMEWEEK"));
        IERC20 usdc = IERC20(vm.envAddress("USDC"));

        uint64 start = uint64(vm.envUint("START"));
        uint64 end = uint64(vm.envUint("END"));
        uint128 pot = uint128(vm.envOr("POT", uint256(0)));

        require(start > block.timestamp, "start must be in the future");
        require(end > start, "end must follow start");

        vm.startBroadcast();

        id = gameweek.createLeague("Proof Round", start, end, 0, STALENESS, 20);
        gameweek.join(id);

        if (pot > 0) {
            usdc.approve(address(gameweek), pot);
            gameweek.sponsor(id, pot);
        }

        vm.stopBroadcast();

        console.log("LEAGUE_ID", id);
        console.log("START    ", start);
        console.log("END      ", end);
        console.log("POT      ", pot);
    }
}
