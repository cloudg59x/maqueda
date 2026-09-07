// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PaymentEnforcement {
    address public owner;
    uint256 public constant TOTAL_AMOUNT_USD = 1000 * 100; // $1000 in cents
    uint256 public constant DOWN_PAYMENT_USD = 10 * 100;   // $10 in cents
    uint256 public exchangeRate; // USD cents per ETH (e.g., 300000 for $3000/ETH)
    
    mapping(address => uint256) public payments; // Amount paid in wei
    mapping(address => bool) public termsAccepted;
    mapping(address => bool) public penalized;
    mapping(address => string) public penaltyReasons;
    
    event DownPaymentMade(address indexed client, uint256 amount);
    event TermsAccepted(address indexed client);
    event PenaltyEnforced(address indexed client, uint256 amount, string reason);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event ExchangeRateUpdated(uint256 newRate);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier notPenalized(address client) {
        require(!penalized[client], "Client already penalized");
        _;
    }
    
    constructor(uint256 _exchangeRate) {
        owner = msg.sender;
        exchangeRate = _exchangeRate; // Set initial exchange rate
    }
    
    // Update exchange rate (USD cents per ETH)
    function updateExchangeRate(uint256 _exchangeRate) public onlyOwner {
        exchangeRate = _exchangeRate;
        emit ExchangeRateUpdated(_exchangeRate);
    }
    
    // Get equivalent amount in ETH wei for USD amount in cents
    function getEquivalentAmount(uint256 usdCents) public view returns (uint256) {
        require(exchangeRate > 0, "Exchange rate not set");
        // usdCents * 10^18 / exchangeRate
        return (usdCents * 1e18) / exchangeRate;
    }
    
    // Client makes down payment
    function makeDownPayment() public payable {
        uint256 requiredAmount = getEquivalentAmount(DOWN_PAYMENT_USD);
        require(msg.value >= requiredAmount, "Insufficient payment");
        
        payments[msg.sender] += msg.value;
        emit DownPaymentMade(msg.sender, msg.value);
    }
    
    // Client accepts terms
    function acceptTerms() public {
        termsAccepted[msg.sender] = true;
        emit TermsAccepted(msg.sender);
    }
    
    // Owner enforces penalty to collect remaining amount
    function enforcePenalty(address client, string memory reason) public 
        onlyOwner 
        notPenalized(client) 
        returns (uint256) {
        
        require(termsAccepted[client], "Client must accept terms first");
        require(payments[client] > 0, "Client must have made payment");
        
        // Calculate remaining amount (total - already paid)
        uint256 totalRequired = getEquivalentAmount(TOTAL_AMOUNT_USD);
        uint256 remainingAmount = totalRequired - payments[client];
        
        // Transfer remaining amount from client to contract
        // Note: This requires client to have approved this contract to transfer funds
        // For ETH, we'll use a different approach - this is a simplified version
        penalized[client] = true;
        penaltyReasons[client] = reason;
        
        emit PenaltyEnforced(client, remainingAmount, reason);
        return remainingAmount;
    }
    
    // For ERC20 tokens, you would need to implement token transfer
    // This version works with ETH/native token
    
    // Owner withdraws funds
    function withdrawFunds() public onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");
        
        payable(owner).transfer(amount);
        emit FundsWithdrawn(owner, amount);
    }
    
    // Check if payment is complete
    function isPaymentComplete(address client) public view returns (bool) {
        uint256 totalRequired = getEquivalentAmount(TOTAL_AMOUNT_USD);
        return payments[client] >= totalRequired;
    }
    
    // Get client balance in contract
    function getClientBalance(address client) public view returns (uint256) {
        return payments[client];
    }
    
    // Get total required amount in ETH wei
    function getTotalRequiredAmount() public view returns (uint256) {
        return getEquivalentAmount(TOTAL_AMOUNT_USD);
    }
    
    // Get down payment required amount in ETH wei
    function getDownPaymentAmount() public view returns (uint256) {
        return getEquivalentAmount(DOWN_PAYMENT_USD);
    }
    
    // Fallback function to receive ETH
    receive() external payable {
        // Accept ETH payments
        payments[msg.sender] += msg.value;
    }
}