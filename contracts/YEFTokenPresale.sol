pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20Burnable {
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

contract YEFTokenPresale is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //Maximum supply, fixed hard cap
    uint256 public constant MAX_SUPPLY = 15000 * 10**18;
    
    // Fixed rate price is 3/10 = 0.3
    uint256 public constant RATE_PRICE_NUMERATOR = 3;
    uint256 public constant RATE_PRICE_DENOMINATOR = 10;

    //referral bonus by percent
    uint256 public constant REFERRAL_BONUS = 6;

    uint256 public constant STARTING_TIMESTAMP = 1602028800; //Thursday, October 1, 2020 12:00:00 AM GMT
    uint256 public constant ENDING_TIMESTAMP = 1602115199; //Wednesday, October 7, 2020 11:59:59 PM GMT

    // The token being sold
    IERC20 private _token;

    // Multisig address where funds are collected
    address payable private _multisigWallet;
    
    // Amount of token raised
    uint256 public tokenAmountRaised = 0;

    /**
     * Event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokensPurchased(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    event ReferrerEarned(address indexed purchaser, address indexed referrer, uint256 value);

    /**
     * @param multisigWallet Address where collected funds will be forwarded to
     */
    constructor(address payable multisigWallet) public {
        require(multisigWallet != address(0), "multisig wallet is the zero address");
        _multisigWallet = multisigWallet;
    }

    /**
     * @dev to set the token being sold after YEFToken and YEFTokenPresale are initialized
     *
     * NOTE: After calling this function, the owner permission will be removed
     * That's mean no one is owning this contract
     *
     */
    function setTokenToSale(IERC20 token) public onlyOwner {
        require(address(token) != address(0), "token is the zero address");
        _token = token;
        //Leave the contract without an owner
        //Owner will not to be possible to call any functions are marked as "onlyOwner"
        renounceOwnership();
    }
    /**
     * @dev function to make the purchase
     * This function has a non-reentrancy guard, so it shouldn't be called by
     * another `nonReentrant` function.
     * @param _referrerAddress optional. Is the referrer's address
     * Referrer will earn {REFERRAL_BONUS}% directly
     */
    function purchase(address _referrerAddress) public nonReentrant payable {
        require(block.timestamp >= STARTING_TIMESTAMP, 'the token presale has not started yet');
        require(block.timestamp < ENDING_TIMESTAMP, 'the token presale has ended');
        uint256 _weiAmount = msg.value;
        require(_weiAmount > 0, 'invalid amount');

        // calculate token amount to be created
        uint256 tokens = _getTokenAmount(_weiAmount);
        
        tokenAmountRaised = tokenAmountRaised.add(tokens);

        if(_referrerAddress != address(0)){
            //deliver referral bonus
            _deliverReferralBonusToken(msg.sender, _referrerAddress, tokens);
        }
        require(tokenAmountRaised <= MAX_SUPPLY, 'the token sold out');

        _deliverTokens(msg.sender, tokens);

        emit TokensPurchased(msg.sender, msg.sender, _weiAmount, tokens);

        _forwardFunds();

    }

    /**
     * @dev Destroys the remaining tokens once the token presale is ended
     * 
     * Requirements:
     * 
     * - The token presale must be ended
     * 
     * NOTE: Anyone could call this function to burn the remaining tokens
     */
    function burnRemainingToken() public {
        require(block.timestamp >= ENDING_TIMESTAMP, 'the token presale has not ended yet');
        uint256 balanceOfThisContract = _token.balanceOf(address(this));
        require(balanceOfThisContract > 0, 'nothing to burn');    
        IERC20Burnable(address(_token)).burn(balanceOfThisContract);
    }

    /**
     * @dev The way in which ether is converted to tokens.
     * @param _weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256){
        return _weiAmount.mul(RATE_PRICE_NUMERATOR).div(RATE_PRICE_DENOMINATOR);
    }

    /**
     * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends
     * its tokens.
     * @param beneficiary Address performing the token purchase
     * @param tokenAmount Number of tokens to be emitted
     */
    function _deliverTokens(address beneficiary, uint256 tokenAmount) internal {
        _token.safeTransfer(beneficiary, tokenAmount);
    }

    function _deliverReferralBonusToken(address purchaser, address referrer, uint256 tokenAmount) internal {
        uint256 refAmount = tokenAmount.mul(REFERRAL_BONUS).div(100);
        tokenAmountRaised = tokenAmountRaised.add(refAmount);
        emit ReferrerEarned(purchaser, referrer, refAmount);
        _deliverTokens(referrer, refAmount);
    }

    /**
     * @dev Determines how ETH is stored/forwarded on purchases.
     */
    function _forwardFunds() internal {
        _multisigWallet.transfer(msg.value);
    }
}