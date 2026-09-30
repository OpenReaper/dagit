// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title DAGITRegistry
/// @notice Upgradeable first-registration registry for SHA-256 file digests.
/// @dev Users interact through an ERC-1967 proxy. No file data, token, NFT, payment flow, or external call exists.
contract DAGITRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes proxy storage and assigns the sole upgrade authority.
    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
    }

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

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
