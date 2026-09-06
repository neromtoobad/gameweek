// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Stand-in for a B20 tokenized stock. Real B20 tokens use 8 decimals, but the decimals are
///         configurable here so the NAV scale maths is exercised for other shapes too.
contract MockToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @notice Stand-in for a Chainlink aggregator proxy with a settable answer and updatedAt.
contract MockFeed {
    uint8 public decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        answer = answer_;
        updatedAt = block.timestamp;
        roundId = 1;
    }

    /// @notice Publish a new price at the current block timestamp.
    function setAnswer(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
        roundId++;
    }

    /// @notice Publish a price stamped in the past, imitating a frozen or weekend-held feed.
    function setAnswerAt(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        roundId++;
    }

    /// @notice Freeze the feed in place without changing the price, as a corporate action would.
    function freezeAt(uint256 updatedAt_) external {
        updatedAt = updatedAt_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}
