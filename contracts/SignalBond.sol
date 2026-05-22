// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract SignalBond {
    enum Direction {
        Long,
        Short,
        Yes,
        No
    }

    struct Signal {
        uint256 id;
        bytes32 agentId;
        address publisher;
        Direction direction;
        string market;
        uint16 confidenceBps;
        uint64 createdAt;
        uint64 expiresAt;
        uint256 stakeAmount;
        bytes32 sourceDataHash;
        bytes32 explanationHash;
        bool resolved;
        bool correct;
        int256 pnlBps;
    }

    struct AgentScore {
        uint256 resolvedSignals;
        uint256 correctSignals;
        int256 reputation;
        int256 cumulativePnLBps;
        uint64 updatedAt;
    }

    IERC20 public immutable stakeToken;
    address public owner;
    address public resolver;
    address public treasury;
    uint256 public nextSignalId = 1;
    uint256 public slashedStakeBalance;

    mapping(uint256 => Signal) private signals;
    mapping(bytes32 => AgentScore) private scores;

    event SignalCreated(
        uint256 indexed signalId,
        bytes32 indexed agentId,
        address indexed publisher,
        string market,
        Direction direction,
        uint16 confidenceBps,
        uint256 stakeAmount,
        uint64 expiresAt,
        bytes32 sourceDataHash,
        bytes32 explanationHash
    );

    event SignalResolved(
        uint256 indexed signalId,
        bytes32 indexed agentId,
        bool correct,
        int256 pnlBps,
        int256 reputation
    );

    event ResolverUpdated(address indexed resolver);
    event TreasuryUpdated(address indexed treasury);
    event StakeSlashed(uint256 indexed signalId, address indexed publisher, uint256 amount, address indexed treasury);
    event SlashedStakeWithdrawn(address indexed treasury, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyResolver() {
        require(msg.sender == resolver || msg.sender == owner, "ONLY_RESOLVER");
        _;
    }

    constructor(address stakeToken_, address resolver_) {
        require(stakeToken_ != address(0), "BAD_TOKEN");
        stakeToken = IERC20(stakeToken_);
        owner = msg.sender;
        resolver = resolver_ == address(0) ? msg.sender : resolver_;
        treasury = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        emit ResolverUpdated(resolver);
        emit TreasuryUpdated(treasury);
    }

    function createSignal(
        bytes32 agentId,
        string calldata market,
        Direction direction,
        uint16 confidenceBps,
        uint256 stakeAmount,
        uint64 expiresAt,
        bytes32 sourceDataHash,
        bytes32 explanationHash
    ) external returns (uint256 signalId) {
        require(agentId != bytes32(0), "BAD_AGENT");
        require(bytes(market).length > 0, "BAD_MARKET");
        require(confidenceBps > 0 && confidenceBps <= 10_000, "BAD_CONFIDENCE");
        require(stakeAmount > 0, "NO_STAKE");
        require(expiresAt > block.timestamp, "BAD_EXPIRY");

        signalId = nextSignalId++;
        bool pulled = stakeToken.transferFrom(msg.sender, address(this), stakeAmount);
        require(pulled, "STAKE_TRANSFER_FAILED");

        signals[signalId] = Signal({
            id: signalId,
            agentId: agentId,
            publisher: msg.sender,
            direction: direction,
            market: market,
            confidenceBps: confidenceBps,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            stakeAmount: stakeAmount,
            sourceDataHash: sourceDataHash,
            explanationHash: explanationHash,
            resolved: false,
            correct: false,
            pnlBps: 0
        });

        emit SignalCreated(
            signalId,
            agentId,
            msg.sender,
            market,
            direction,
            confidenceBps,
            stakeAmount,
            expiresAt,
            sourceDataHash,
            explanationHash
        );
    }

    function resolveSignal(uint256 signalId, bool correct, int256 pnlBps) external onlyResolver {
        Signal storage signal = signals[signalId];
        require(signal.id != 0, "UNKNOWN_SIGNAL");
        require(!signal.resolved, "ALREADY_RESOLVED");
        require(block.timestamp >= signal.expiresAt, "NOT_EXPIRED");

        signal.resolved = true;
        signal.correct = correct;
        signal.pnlBps = pnlBps;

        AgentScore storage score = scores[signal.agentId];
        score.resolvedSignals += 1;
        if (correct) {
            score.correctSignals += 1;
            require(stakeToken.transfer(signal.publisher, signal.stakeAmount), "STAKE_RETURN_FAILED");
        } else {
            slashedStakeBalance += signal.stakeAmount;
            emit StakeSlashed(signalId, signal.publisher, signal.stakeAmount, treasury);
        }

        score.cumulativePnLBps += pnlBps;
        score.reputation = _calculateReputation(score);
        score.updatedAt = uint64(block.timestamp);

        emit SignalResolved(signalId, signal.agentId, correct, pnlBps, score.reputation);
    }

    function getSignal(uint256 signalId) external view returns (Signal memory) {
        Signal memory signal = signals[signalId];
        require(signal.id != 0, "UNKNOWN_SIGNAL");
        return signal;
    }

    function getScore(bytes32 agentId) external view returns (AgentScore memory) {
        return scores[agentId];
    }

    function setResolver(address resolver_) external onlyOwner {
        require(resolver_ != address(0), "BAD_RESOLVER");
        resolver = resolver_;
        emit ResolverUpdated(resolver_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "BAD_TREASURY");
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function withdrawSlashedStake(uint256 amount) external onlyOwner {
        require(amount > 0, "NO_AMOUNT");
        require(amount <= slashedStakeBalance, "INSUFFICIENT_SLASHED");
        slashedStakeBalance -= amount;
        require(stakeToken.transfer(treasury, amount), "TREASURY_TRANSFER_FAILED");
        emit SlashedStakeWithdrawn(treasury, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "BAD_OWNER");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function _calculateReputation(AgentScore memory score) private pure returns (int256) {
        if (score.resolvedSignals == 0) {
            return 0;
        }

        int256 winRateBps = int256((score.correctSignals * 10_000) / score.resolvedSignals);
        int256 pnlComponent = score.cumulativePnLBps / 4;
        return winRateBps + pnlComponent;
    }
}
