// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCompoundComet {
    address public baseToken;
    uint64 public currentSupplyRate; // Per second rate в Wad (1e18)
    mapping(address => uint256) public userBalances;

    event Supply(address indexed from, address indexed dst, uint256 amount);
    event Withdraw(address indexed src, address indexed to, uint256 amount);
    event RateChanged(uint64 newRateWad);

    constructor(address _baseToken) {
        baseToken = _baseToken;
    }

    // --- Реализация интерфейса Compound V3 (Comet) ---

    function supply(address asset, uint256 amount) external {
        require(asset == baseToken, "Wrong asset for this Comet");

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        userBalances[msg.sender] += amount;
        emit Supply(msg.sender, msg.sender, amount);
    }

    function withdraw(address asset, uint256 amount) external {
        require(asset == baseToken, "Wrong asset");
        require(userBalances[msg.sender] >= amount, "Not enough balance");

        userBalances[msg.sender] -= amount;

        bool success = IERC20(asset).transfer(msg.sender, amount);
        require(success, "Transfer failed");

        emit Withdraw(msg.sender, msg.sender, amount);
    }

    // Compound использует utilization для расчета, но мы просто вернем нашу mock-ставку
    function getUtilization() external view returns (uint256) {
        return 500000000000000000; // 50% mock utilization (1e18)
    }

    function getSupplyRate(uint256 /* utilization */) external view returns (uint64) {
        return currentSupplyRate;
    }

    // --- Admin Функции для теста ---

    // rateInWad: Ставка в секунду!
    // Пример: 5% APY ~ 1585489599 per second (в формате 1e18)
    function setSupplyRate(uint64 _rateWad) external {
        currentSupplyRate = _rateWad;
        emit RateChanged(_rateWad);
    }
}