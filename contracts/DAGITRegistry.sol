// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title DAGITRegistry
/// @notice Immutable first-registration registry for SHA-256 file digests.
/// @dev No owner, proxy, token, custody balance, external call, or file data exists in this contract.
contract DAGITRegistry {
    error ZeroDigest();
    error ProofAlreadyRegistered(bytes32 digest);

    struct Proof {
        address registrant;
        uint64 registeredAt;
        bytes32 manifestDigest;
    }

    mapping(bytes32 digest => Proof proof) private _proofs;

    event ProofRegistered(
        bytes32 indexed digest,
        address indexed registrant,
        bytes32 indexed manifestDigest,
        uint16 schemaVersion
    );

    /// @notice Registers the first observed digest and binds it to a privacy-safe receipt-manifest digest.
    /// @param digest SHA-256 digest of the original, exact file bytes.
    /// @param manifestDigest Keccak-256 digest of the canonical DAGIT receipt manifest; no file name or contents.
    function register(bytes32 digest, bytes32 manifestDigest) external {
        if (digest == bytes32(0)) revert ZeroDigest();
        if (_proofs[digest].registrant != address(0)) revert ProofAlreadyRegistered(digest);

        _proofs[digest] = Proof({
            registrant: msg.sender,
            registeredAt: uint64(block.timestamp),
            manifestDigest: manifestDigest
        });

        emit ProofRegistered(digest, msg.sender, manifestDigest, 1);
    }

    function proofOf(bytes32 digest) external view returns (Proof memory) {
        return _proofs[digest];
    }
}
