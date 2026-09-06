// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Gameweek} from "../src/Gameweek.sol";
import {MockToken, MockFeed} from "../test/mocks/Mocks.sol";

/// @notice Stands up a complete Gameweek world on a local anvil node.
///
///   anvil &
///   forge script script/LocalDev.s.sol:LocalDev --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///
/// @dev Why this exists. The real B20 tokens are Base node precompiles, so they cannot be
///      simulated: no fork, no anvil, no local chain can execute them. That would leave the league
///      screens untestable until mainnet money is spent. So local dev uses mock tokens with the
///      same 8 decimals and mock feeds seeded with the real prices read from Base on 2026-09-06.
///      Everything above the token layer, which is all of the league logic, behaves identically.
contract LocalDev is Script {
    struct Seed {
        string ticker;
        string name;
        int256 price; // 8 decimals, real Base prices
    }

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = deployerKey == 0 ? msg.sender : vm.addr(deployerKey);

        Seed[6] memory seeds = [
            Seed("NVDAc", "Nvidia", 229_96000000),
            Seed("AAPLc", "Apple", 320_08000000),
            Seed("METAc", "Meta", 615_23000000),
            Seed("TSLAc", "Tesla", 353_33000000),
            Seed("GOOGLc", "Alphabet", 338_71000000),
            Seed("MSTRc", "Strategy", 142_63000000)
        ];

        vm.startBroadcast();

        MockToken usdc = new MockToken("USD Coin", "USDC", 6);
        Gameweek gameweek = new Gameweek(address(usdc), deployer);

        address[] memory tokenList = new address[](seeds.length);
        address[] memory feedList = new address[](seeds.length);

        for (uint256 i; i < seeds.length; ++i) {
            MockToken token = new MockToken(seeds[i].name, seeds[i].ticker, 8);
            MockFeed feed = new MockFeed(8, seeds[i].price);
            tokenList[i] = address(token);
            feedList[i] = address(feed);
        }
        gameweek.setTokens(tokenList, feedList);

        // Three players holding different portfolios, so the leaderboard has something to rank.
        address alice = vm.addr(uint256(keccak256("gameweek.alice")));
        address bob = vm.addr(uint256(keccak256("gameweek.bob")));
        address carol = vm.addr(uint256(keccak256("gameweek.carol")));

        MockToken(tokenList[0]).mint(alice, 43_478_260); // ~0.43 NVDA
        MockToken(tokenList[1]).mint(alice, 15_620_000);
        usdc.mint(alice, 250_000);

        MockToken(tokenList[2]).mint(bob, 16_254_000);
        usdc.mint(bob, 750_000);

        MockToken(tokenList[3]).mint(carol, 28_302_000);
        MockToken(tokenList[5]).mint(carol, 70_112_000);

        // One league open for drafting, one that opens in a second so the seeding script can
        // join members and lock it. Time travel is driven from the shell, because vm.warp moves
        // the script's own clock and not anvil's.
        uint256 open = gameweek.createLeague(
            "Lagos Bulls", uint64(block.timestamp + 1 days), uint64(block.timestamp + 8 days), 0, 30 days, 20
        );
        uint256 running = gameweek.createLeague(
            "Sunday Public", uint64(block.timestamp + 60), uint64(block.timestamp + 7 days), 0, 30 days, 50
        );

        // Pot money for the seeding script to sponsor with.
        usdc.mint(deployer, 5_000_000);
        usdc.approve(address(gameweek), type(uint256).max);

        vm.stopBroadcast();

        console.log("GAMEWEEK    ", address(gameweek));
        console.log("USDC        ", address(usdc));
        console.log("OPEN_LEAGUE ", open);
        console.log("LIVE_LEAGUE ", running);
        console.log("ALICE       ", alice);
        console.log("BOB         ", bob);
        console.log("CAROL       ", carol);
        for (uint256 i; i < seeds.length; ++i) {
            console.log(seeds[i].ticker, tokenList[i], feedList[i]);
        }
    }
}
