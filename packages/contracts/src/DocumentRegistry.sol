// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  Iloja Document Registry
 * @notice Append-only ledger of (hash, type, uri) tuples for documents
 *         Iloja has certified — tenancy agreements, inspection reports,
 *         escrow receipts, dispute outcomes, credibility snapshots.
 *
 *         Only Iloja's relayer wallet can write. Anyone can read.
 *         Documents themselves are NEVER on-chain — just SHA-256 hashes,
 *         so anybody can independently prove a document hasn't been
 *         altered since the moment Iloja certified it.
 *
 * @dev    Per the product doc §2.10:
 *         "The on-chain layer makes one specific promise: nothing Iloja
 *         has certified can be quietly altered later. Not by a disputed
 *         agent, not by a renter claiming different terms were agreed,
 *         and not by Iloja itself."
 */
contract DocumentRegistry {
    /// @notice Address authorised to anchor documents. Owned by Iloja.
    address public anchor;

    /// @notice Pending owner for two-step transfers.
    address public pendingAnchor;

    struct Record {
        bytes32 docType; // keccak256-encoded document type tag
        string uri; // off-chain pointer (iloja://documents/...)
        uint256 anchoredAt; // block.timestamp at write
    }

    /// @notice hash → record. A given hash can only be anchored once.
    mapping(bytes32 => Record) public records;

    event Anchored(bytes32 indexed hash, bytes32 indexed docType, string uri, uint256 anchoredAt);
    event AnchorTransferStarted(address indexed previous, address indexed pending);
    event AnchorTransferred(address indexed previous, address indexed next);

    error NotAnchor();
    error AlreadyAnchored();
    error ZeroHash();
    error EmptyUri();
    error NotPendingAnchor();

    constructor(address _anchor) {
        anchor = _anchor;
        emit AnchorTransferred(address(0), _anchor);
    }

    modifier onlyAnchor() {
        if (msg.sender != anchor) revert NotAnchor();
        _;
    }

    /**
     * @notice Anchor a document hash. Idempotent — a re-submission of the
     *         same hash reverts.
     */
    function anchorDocument(bytes32 hash, bytes32 docType, string calldata uri)
        external
        onlyAnchor
    {
        if (hash == bytes32(0)) revert ZeroHash();
        if (bytes(uri).length == 0) revert EmptyUri();
        if (records[hash].anchoredAt != 0) revert AlreadyAnchored();
        records[hash] = Record({docType: docType, uri: uri, anchoredAt: block.timestamp});
        emit Anchored(hash, docType, uri, block.timestamp);
    }

    /// @notice Convenience read — true iff this hash has ever been anchored.
    function isAnchored(bytes32 hash) external view returns (bool) {
        return records[hash].anchoredAt != 0;
    }

    /// @notice Two-step ownership transfer; safer than single-step against
    ///         fat-finger of the relayer key.
    function startAnchorTransfer(address next) external onlyAnchor {
        pendingAnchor = next;
        emit AnchorTransferStarted(anchor, next);
    }

    function acceptAnchor() external {
        if (msg.sender != pendingAnchor) revert NotPendingAnchor();
        address previous = anchor;
        anchor = pendingAnchor;
        pendingAnchor = address(0);
        emit AnchorTransferred(previous, anchor);
    }
}
