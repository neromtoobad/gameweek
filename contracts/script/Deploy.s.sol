// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Gameweek} from "../src/Gameweek.sol";
import {GameweekRouter} from "../src/GameweekRouter.sol";

/// @notice Deploys Gameweek to Base mainnet.
///
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $BASE_RPC_URL --account deployer --broadcast --verify
///
/// @dev THIS SCRIPT DELIBERATELY DOES NOT REGISTER TOKENS.
///      `setToken` reads `decimals()` from a B20 address, and B20 tokens are node precompiles with
///      no bytecode. `forge script` always simulates locally against a fork of the target chain
///      before broadcasting, and that simulation cannot execute a precompile, so any script that
///      touches a B20 address dies with `EvmError: OpcodeNotFound` even when --broadcast is set.
///      Registration therefore runs through `cast send`, which submits straight to the node:
///
///        ./script/register-tokens.sh 0xYourGameweekAddress
contract Deploy is Script {
    using stdJson for string;

    /// @notice Fee taken on each draft pick, in basis points. Funds league pots.
    uint16 constant FEE_BPS = 50;

    function run() external returns (Gameweek gameweek, GameweekRouter router) {
        string memory json = vm.readFile("config/tokens.json");
        address usdc = json.readAddress(".usdc");

        // The treasury collects router fees. Defaults to the deployer so a first deploy needs no
        // extra setup; point it at a dedicated address with TREASURY=0x... once you have one.
        address treasury = vm.envOr("TREASURY", msg.sender);

        vm.startBroadcast();
        gameweek = new Gameweek(usdc, msg.sender);
        router = new GameweekRouter(msg.sender, treasury, FEE_BPS);
        vm.stopBroadcast();

        console.log("GAMEWEEK        ", address(gameweek));
        console.log("ROUTER          ", address(router));
        console.log("OWNER           ", msg.sender);
        console.log("TREASURY        ", treasury);
        console.log("FEE_BPS         ", FEE_BPS);
        console.log("Next: ./script/register-tokens.sh <GAMEWEEK address>");
    }
}

/// @notice Opens a league on an already deployed contract.
///
///   LEAGUE=0x... NAME="Lagos Bulls" START=1788800000 END=1789404800 \
///   BUY_IN=0 TOLERANCE=7200 MAX_MEMBERS=20 \
///   forge script script/Deploy.s.sol:CreateLeague \
///     --rpc-url $BASE_RPC_URL --account deployer --broadcast
///
/// @dev Safe to simulate: it touches no B20 address.
contract CreateLeague is Script {
    function run() external returns (uint256 id) {
        Gameweek league = Gameweek(vm.envAddress("LEAGUE"));

        string memory name = vm.envString("NAME");
        uint64 start = uint64(vm.envUint("START"));
        uint64 end = uint64(vm.envUint("END"));
        uint128 buyIn = uint128(vm.envOr("BUY_IN", uint256(0)));
        uint32 tolerance = uint32(vm.envOr("TOLERANCE", uint256(2 hours)));
        uint16 maxMembers = uint16(vm.envOr("MAX_MEMBERS", uint256(20)));

        require(start > block.timestamp, "start must be in the future");
        require(end > start, "end must follow start");

        vm.startBroadcast();
        id = league.createLeague(name, start, end, buyIn, tolerance, maxMembers);
        vm.stopBroadcast();

        console.log("league id", id);
        console.log("name", name);
        console.log("start", start);
        console.log("end", end);
        console.log("staleness tolerance (s)", tolerance);
    }
}
