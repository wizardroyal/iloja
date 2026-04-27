// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DocumentRegistry} from "../src/DocumentRegistry.sol";

contract DocumentRegistryTest is Test {
    DocumentRegistry registry;
    address anchor = address(0xA1);
    address mallory = address(0xBAD);

    function setUp() public {
        registry = new DocumentRegistry(anchor);
    }

    function test_anchorWritesRecord() public {
        vm.prank(anchor);
        registry.anchorDocument(bytes32(uint256(1)), keccak256("inspection_report"), "iloja://x");
        assertTrue(registry.isAnchored(bytes32(uint256(1))));
    }

    function test_doubleAnchorReverts() public {
        vm.prank(anchor);
        registry.anchorDocument(bytes32(uint256(1)), keccak256("inspection_report"), "iloja://x");
        vm.prank(anchor);
        vm.expectRevert(DocumentRegistry.AlreadyAnchored.selector);
        registry.anchorDocument(bytes32(uint256(1)), keccak256("inspection_report"), "iloja://x");
    }

    function test_nonAnchorReverts() public {
        vm.prank(mallory);
        vm.expectRevert(DocumentRegistry.NotAnchor.selector);
        registry.anchorDocument(bytes32(uint256(1)), keccak256("escrow_receipt"), "iloja://x");
    }

    function test_zeroHashReverts() public {
        vm.prank(anchor);
        vm.expectRevert(DocumentRegistry.ZeroHash.selector);
        registry.anchorDocument(bytes32(0), keccak256("escrow_receipt"), "iloja://x");
    }

    function test_emptyUriReverts() public {
        vm.prank(anchor);
        vm.expectRevert(DocumentRegistry.EmptyUri.selector);
        registry.anchorDocument(bytes32(uint256(1)), keccak256("escrow_receipt"), "");
    }

    function test_twoStepTransfer() public {
        address next = address(0xA2);
        vm.prank(anchor);
        registry.startAnchorTransfer(next);
        vm.prank(next);
        registry.acceptAnchor();
        assertEq(registry.anchor(), next);
    }
}
