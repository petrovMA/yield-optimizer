// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAavePool {
    // --- Данные для эмуляции Aave ---
    struct ReserveConfigurationMap {
        uint256 data;
    }

    struct ReserveData {
        ReserveConfigurationMap configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate; // APR в Ray (1e27)
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 __deprecatedStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
    }

    mapping(address => ReserveData) public reserves;
    mapping(address => mapping(address => uint256)) public userBalances;

    // --- События (для красоты в эксплорере) ---
    event Supply(address indexed reserve, address user, uint256 amount, uint16 referralCode);
    event Withdraw(address indexed reserve, address user, address to, uint256 amount);
    event RateChanged(address indexed reserve, uint128 newRateRay);

    // --- Реализация интерфейса Aave V3 ---

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        // Забираем токены у юзера
        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        // Обновляем баланс
        userBalances[asset][onBehalfOf] += amount;
        emit Supply(asset, onBehalfOf, amount, referralCode);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(userBalances[asset][msg.sender] >= amount, "Not enough balance");

        // Обновляем баланс
        userBalances[asset][msg.sender] -= amount;

        // Отдаем токены
        bool success = IERC20(asset).transfer(to, amount);
        require(success, "Transfer failed");

        emit Withdraw(asset, msg.sender, to, amount);
        return amount;
    }

    // Aave возвращает сложную структуру, нам важно только поле currentLiquidityRate
    function getReserveData(address asset) external view returns (ReserveData memory) {
        return reserves[asset];
    }

    // --- Admin Функции для теста (Управление ставкой) ---

    // rateInRay: Например, 5% = 0.05 * 1e27 = 50000000000000000000000000
    function setLiquidityRate(address asset, uint256 rateInRay) external {
        reserves[asset].currentLiquidityRate = uint128(rateInRay);
        // Для реализма ставим индекс 1
        if (reserves[asset].liquidityIndex == 0) {
            reserves[asset].liquidityIndex = uint128(1e27);
        }
        emit RateChanged(asset, uint128(rateInRay));
    }
}