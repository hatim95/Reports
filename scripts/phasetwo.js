import { WorkPackage, WorkItem, RefinementContext } from '../src/models/index.js';
import { refineWorkPackage } from '../src/offchain/guarantor.js';
import { generateKeyPair, publicKeyToBase64, verifySignature, base64ToPublicKey } from '../src/offchain/signature.js';
import { generateWorkDigest } from '../src/offchain/encoder.js';
import { OnchainState, processGuaranteeExtrinsic, processAssuranceExtrinsic, processDisputeExtrinsic, processAccumulationQueue } from '../src/onchain/index.js';
import { ProtocolError } from '../src/utils/errors.js';

// Self-executing async function to demonstrate
(async () => {
    console.log("\n--- Demonstrating Phase 2 Implementation ---");

    const onchainState = new OnchainState();
    // Initialize some mock global state for PVM simulation
    onchainState.globalState.accounts = {
        '0xAlice': { balance: 1000 },
        '0xBob': { balance: 500 },
    };
    onchainState.globalState.coreStatus.set(0, 'available'); // Core 0 is available
    onchainState.globalState.coreStatus.set(1, 'engaged'); // Core 1 is engaged (for testing 'core_engaged')
    onchainState.globalState.serviceRegistry.set('service.jam', { codeHash: '0xprogramhash123', owner: '0xServiceOwner' });

    console.log("Initial Global State:", JSON.stringify(onchainState.globalState.accounts));

    // 1. Generate guarantor key pairs
    const guarantorKeyPair1 = generateKeyPair();
    const guarantorPublicKey1 = publicKeyToBase64(guarantorKeyPair1.publicKey);
    const guarantorKeyPair2 = generateKeyPair();
    const guarantorPublicKey2 = publicKeyToBase64(guarantorKeyPair2.publicKey);
    const guarantorKeyPair3 = generateKeyPair();
    const guarantorPublicKey3 = publicKeyToBase64(guarantorKeyPair3.publicKey);

    console.log(`\nGuarantor 1 Public Key: ${guarantorPublicKey1}`);
    console.log(`Guarantor 2 Public Key: ${guarantorPublicKey2}`);
    console.log(`Guarantor 3 Public Key: ${guarantorPublicKey3}`);

    // 2. Create Work-Items and Work-Packages
    const workItem1 = new WorkItem("wi-001", "0xprogramhash123", JSON.stringify({ key: "data1", value: "valueA" }), 50000);
    const workItem2 = new WorkItem("wi-002", "0xprogramhash123", JSON.stringify({ key: "data2", value: "valueB" }), 60000);
    const workItemTransfer = new WorkItem("wi-003", "0xtransfer", JSON.stringify({ from: "0xAlice", to: "0xBob", amount: 100 }), 70); // Low gas limit to test error
    const workItemTransfer2 = new WorkItem("wi-004", "0xtransfer", JSON.stringify({ from: "0xBob", to: "0xAlice", amount: 50 }), 70);

    const workPackage1 = new WorkPackage("auth-token-wp1", { h: "auth.service.com", u: "service.jam", f: "checkAuth" }, "context_wp1", [workItem1]);
    const workPackage2 = new WorkPackage("auth-token-wp2", { h: "auth.service.com", u: "service.jam", f: "checkAuth" }, "context_wp2", [workItem2]);
    const workPackageTransfer = new WorkPackage("auth-token-wptransfer", { h: "auth.service.com", u: "service.jam", f: "checkAuth" }, "context_wptransfer", [workItemTransfer]);
    const workPackageTransfer2 = new WorkPackage("auth-token-wptransfer2", { h: "auth.service.com", u: "service.jam", f: "checkAuth" }, "context_wptransfer2", [workItemTransfer2]);


    // 3. Create Refinement Context
    const currentSlot = 100;
    const refinementContext = new RefinementContext(
        `0xanchorblockroot_valid_${currentSlot - 1}`, // Mock valid anchor
        currentSlot - 1,
        `0xbeefymmrroot_valid_${currentSlot - 1}`, // Mock valid MMR
        currentSlot,
        1,
        [guarantorPublicKey1, guarantorPublicKey2, guarantorPublicKey3], // All guarantors in current rotation
        []
    );

    // --- Scenario 1: Successful Report Submission & Accumulation ---
    console.log("\n--- Scenario 1: Successful Report Submission & Accumulation ---");

    // 1. Simulate PVM output and gas ONCE for workPackage1
    const { sha256 } = await import('js-sha256');
    const combinedInput = JSON.stringify({
        workPackageId: workPackage1.authorizationToken,
        contextAnchor: refinementContext.anchorBlockRoot,
        firstWorkItemProgram: workPackage1.workItems[0].programHash,
        firstWorkItemInput: workPackage1.workItems[0].inputData,
    });
    const pvmOutput = `PVM_OUTPUT_${sha256(combinedInput)}`;
    const gasUsed = 500; // Fixed for determinism

    // 2. Generate AvailabilitySpec ONCE
    const { WorkReport } = await import('../src/models/WorkReport.js');
    const tempReport = new WorkReport(
        workPackage1,
        refinementContext,
        pvmOutput,
        gasUsed,
        null,
        '',
        '',
        0,
        currentSlot,
        []
    );
    const { encodeForAvailability } = await import('../src/offchain/encoder.js');
    const availabilitySpec = encodeForAvailability(tempReport, 4, 2);

    // 3. Helper to create a signed WorkReport for a given guarantor
    function makeReport(guarantorPublicKey, signature) {
        return new WorkReport(
            workPackage1,
            refinementContext,
            pvmOutput,
            gasUsed,
            availabilitySpec,
            signature,
            guarantorPublicKey,
            0,
            currentSlot,
            []
        );
    }

    // 4. Guarantor 1 signs
    const { signMessage } = await import('../src/offchain/signature.js');
    const preliminaryReport1 = makeReport(guarantorPublicKey1, '');
    const signature1 = signMessage(preliminaryReport1.toSignableObject(), guarantorKeyPair1.secretKey);
    const report1 = makeReport(guarantorPublicKey1, signature1);
    processGuaranteeExtrinsic(report1, onchainState, currentSlot);

    // 5. Guarantor 2 signs
    const preliminaryReport2 = makeReport(guarantorPublicKey2, '');
    const signature2 = signMessage(preliminaryReport2.toSignableObject(), guarantorKeyPair2.secretKey);
    const report2 = makeReport(guarantorPublicKey2, signature2);
    processGuaranteeExtrinsic(report2, onchainState, currentSlot);

    console.log("\n--- After initial E_G processing ---");
    console.log("Pending Reports (ρ):", onchainState.ρ.size);
    console.log("Accumulation Queue (ω):", onchainState.ω.size);
    console.log("History (ξ):", onchainState.ξ.size);

    // Process accumulation queue
    processAccumulationQueue(onchainState, currentSlot + 1);

    console.log("\n--- After Accumulation Queue Processing ---");
    console.log("Pending Reports (ρ):", onchainState.ρ.size);
    console.log("Accumulation Queue (ω):", onchainState.ω.size);
    console.log("History (ξ):", onchainState.ξ.size);
    console.log("Final Global State Accounts:", JSON.stringify(onchainState.globalState.accounts));

    // --- Scenario 2: Failed Report Submission (Validation Errors) ---
    console.log("\n--- Scenario 2: Failed Report Submission (Validation Errors) ---");
    const currentSlot_fail = 200;
    const guarantorFailKeyPair = generateKeyPair();
    const guarantorFailPublicKey = publicKeyToBase64(guarantorFailKeyPair.publicKey);

    // Mock a context where guarantorFailPublicKey is NOT a valid guarantor
    const refinementContextFail = new RefinementContext(
        `0xanchorblockroot_valid_${currentSlot_fail - 1}`,
        currentSlot_fail - 1,
        `0xbeefymmrroot_valid_${currentSlot_fail - 1}`,
        currentSlot_fail,
        2,
        [guarantorPublicKey1, guarantorPublicKey2], // Exclude guarantorFailPublicKey
        []
    );

    try {
        console.log("\nAttempting to submit report with wrong_assignment...");
        const badReport = await refineWorkPackage(workPackage1, refinementContextFail, guarantorFailKeyPair.secretKey, 0, currentSlot_fail, [], onchainState);
        processGuaranteeExtrinsic(badReport, onchainState, currentSlot_fail);
    } catch (error) {
        console.error("Caught expected error for wrong_assignment:", error.message);
    }

    try {
        console.log("\nAttempting to submit report with anchor_not_recent...");
        const oldContext = new RefinementContext(
            `0xanchorblockroot_valid_1`, 1, `0xbeefymmrroot_valid_1`, currentSlot_fail, 2,
            [guarantorPublicKey1], []
        );
        const oldReport = await refineWorkPackage(workPackage1, oldContext, guarantorKeyPair1.secretKey, 0, currentSlot_fail, [], onchainState);
        processGuaranteeExtrinsic(oldReport, onchainState, currentSlot_fail);
    } catch (error) {
        console.error("Caught expected error for anchor_not_recent:", error.message);
    }

    try {
        console.log("\nAttempting to submit report with too_high_work_report_gas...");
        const highGasWorkItem = new WorkItem("wi-high-gas", "0xprogram", "{}", 300000); // Exceeds MAX_WORK_REPORT_GAS
        const highGasPackage = new WorkPackage("auth-token-highgas", { h: "auth.service.com", u: "service.jam", f: "checkAuth" }, "context_highgas", [highGasWorkItem]);
        const highGasReport = await refineWorkPackage(highGasPackage, refinementContext, guarantorKeyPair1.secretKey, 0, currentSlot_fail, [], onchainState);
        // Manually set gasUsed higher than allowed for testing
        highGasReport.gasUsed = 250000; // Force it to be too high
        processGuaranteeExtrinsic(highGasReport, onchainState, currentSlot_fail);
    } catch (error) {
        console.error("Caught expected error for too_high_work_report_gas:", error.message);
    }

    try {
        console.log("\nAttempting to submit report with dependency_missing...");
        const missingDepReport = await refineWorkPackage(
            workPackage1, refinementContext, guarantorKeyPair1.secretKey, 0, currentSlot_fail,
            ["0xnonexistentdependencyhash"], // This dependency does not exist
            onchainState
        );
        processGuaranteeExtrinsic(missingDepReport, onchainState, currentSlot_fail);
    } catch (error) {
        console.error("Caught expected error for dependency_missing:", error.message);
    }

    console.log("\nBad Reports (ψ_B):", onchainState.ψ_B.size);
    onchainState.ψ_B.forEach((val, key) => console.log(`  - ${key}: ${val.reason}`));
    console.log("Offenders (ψ_O):", onchainState.ψ_O.size);
    onchainState.ψ_O.forEach((val, key) => console.log(`  - ${key}: Disputes: ${val.disputeCount}`));


    // --- Scenario 3: Dispute Processing ---
    console.log("\n--- Scenario 3: Dispute Processing ---");
    const currentSlot_dispute = 300;

    // First, submit a report and get it into ρ
    const reportToDispute = await refineWorkPackage(workPackageTransfer2, refinementContext, guarantorKeyPair1.secretKey, 0, currentSlot_dispute, [], onchainState);
    processGuaranteeExtrinsic(reportToDispute, onchainState, currentSlot_dispute);
    const digestToDispute = generateWorkDigest(reportToDispute).hash;

    console.log(`\nReport ${digestToDispute} is now in ρ.`);
    console.log("Pending Reports (ρ) before dispute:", onchainState.ρ.size);
    console.log("Offenders (ψ_O) before dispute:", onchainState.ψ_O.size);

    // Now, dispute it
    try {
        processDisputeExtrinsic(
            { disputedDigestHash: digestToDispute, disputerPublicKey: guarantorPublicKey2, reason: "Invalid PVM output" },
            onchainState,
            currentSlot_dispute + 1 // Dispute in a later slot
        );
        console.log(`Successfully disputed report ${digestToDispute}.`);
    } catch (error) {
        console.error("Error during dispute processing:", error.message);
    }

    console.log("\n--- After Dispute Processing ---");
    console.log("Pending Reports (ρ):", onchainState.ρ.size);
    console.log("Bad Reports (ψ_B):", onchainState.ψ_B.size);
    onchainState.ψ_B.forEach((val, key) => console.log(`  - ${key}: ${val.reason}`));
    console.log("Offenders (ψ_O):", onchainState.ψ_O.size);
    onchainState.ψ_O.forEach((val, key) => console.log(`  - ${key}: Disputes: ${val.disputeCount}`));

    // --- Scenario 4: Assurance Processing (Conceptual) ---
    console.log("\n--- Scenario 4: Assurance Processing (Conceptual) ---");
    processAssuranceExtrinsic({ assuredDigestHash: "0xsomevalidhash", assuringPublicKey: guarantorPublicKey1 }, onchainState, currentSlot_dispute + 2);

    console.log("\nDemonstration complete. Review console logs for state changes and error handling.");

})();
