pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract YEFToken is ERC20 {
    uint256 public constant MAX_SUPPLY = 15000*10**18;

    address public presaleManagementContract;

    constructor(address _presaleManagementContract) ERC20('YouEarn Token', 'YEF') public {
        require(_presaleManagementContract != address(0), 'presale management contract is the zero address');
        presaleManagementContract = _presaleManagementContract;
        _mint(_presaleManagementContract, MAX_SUPPLY);
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) public virtual {
        _burn(_msgSender(), amount);
    }

    /**
     * @dev Returns the cap on the token's total supply.
     */
    function cap() public view returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - minted tokens must not cause the total supply to go over the cap.
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        if (from == address(0)) { // When minting tokens
            require(totalSupply().add(amount) <= MAX_SUPPLY, "ERC20Capped: cap exceeded");
        }
    }
}