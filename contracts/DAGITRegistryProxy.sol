// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DAGITRegistry} from "./DAGITRegistry.sol";

/// @notice Deploys and initializes the public DAGIT UUPS proxy in one transaction.
contract DAGITRegistryProxy is ERC1967Proxy {
    constructor(address implementation, address initialOwner)
        ERC1967Proxy(implementation, abi.encodeCall(DAGITRegistry.initialize, (initialOwner)))
    {}
}
