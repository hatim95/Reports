import { WorkPackage, WorkItem, RefinementContext } from '../src/models/index.js';
import { refineWorkPackage } from '../src/offchain/guarantor.js';
import { generateKeyPair, publicKeyToBase64, signMessage } from '../src/offchain/signature.js';
import { generateWorkDigest, encodeForAvailability } from '../src/offchain/encoder.js';
import { OnchainState, processGuaranteeExtrinsic, processAccumulationQueue } from '../src/onchain/index.js';
import { sha256 } from 'js-sha256';
(async () => {
    console.log("\n--- JAM Reports: Scenario 1 Complete Demo ---");

    // 1. Setup on-chain state
    const onchainState = new OnchainState();
    onchainState.globalState.accounts = { '0xAlice': { balance: 1000 }, '0xBob': { balance: 500 } };
    onchainState.globalState.coreStatus.set(0, 'available');
    onchainState.globalState.serviceRegistry.set('service.jam', { codeHash: '0xprogramhash123', owner: '0xServiceOwner' });

    // 2. Generate two guarantor key pairs
    const guarantorKeyPair1 = generateKeyPair();
    const guarantorKeyPair2 = generateKeyPair();
    const guarantorPublicKey1 = publicKeyToBase64(guarantorKeyPair1.publicKey);
    const guarantorPublicKey2 = publicKeyToBase64(guarantorKeyPair2.publicKey);

    // 3. Create a Work-Item and Work-Package
    const workItem = new WorkItem("wi-001", "0xprogramhash123", JSON.stringify({ key: "data1", value: "valueA" }), 50000);
    const workPackage = new WorkPackage("auth-token-wp1", { h: "auth.service.com", u: "service.jam", f: "checkAuth" }, "context_wp1", [workItem]);

    // 4. Create a Refinement Context with both guarantors in rotation
    const currentSlot = 100;
    const refinementContext = new RefinementContext(
        `0xanchorblockroot_valid_${currentSlot - 1}`,
        currentSlot - 1,
        `0xbeefymmrroot_valid_${currentSlot - 1}`,
        currentSlot,
        1,
        [guarantorPublicKey1, guarantorPublicKey2],
        []
    );

    // 5. Simulate PVM output and gas ONCE
    const { sha256 } = await import('js-sha256');
    const combinedInput = JSON.stringify({
        workPackageId: workPackage.authorizationToken,
        contextAnchor: refinementContext.anchorBlockRoot,
        firstWorkItemProgram: workPackage.workItems[0].programHash,
        firstWorkItemInput: workPackage.workItems[0].inputData,
    });
    const pvmOutput = `PVM_OUTPUT_${sha256(combinedInput)}`;
    const gasUsed = 500; // Use a fixed value for determinism

    // 6. Generate AvailabilitySpec ONCE
    const tempReport = new (await import('../src/models/WorkReport.js')).WorkReport(
        workPackage,
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
    const availabilitySpec = encodeForAvailability(tempReport, 4, 2);

    // 7. Create the signable report object (same for both guarantors)
    const WorkReport = (await import('../src/models/WorkReport.js')).WorkReport;
    function makeReport(guarantorPublicKey, signature) {
        return new WorkReport(
            workPackage,
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

    // 8. Guarantor 1 signs
    const preliminaryReport1 = makeReport(guarantorPublicKey1, '');
    const signature1 = signMessage(preliminaryReport1.toSignableObject(), guarantorKeyPair1.secretKey);
    const report1 = makeReport(guarantorPublicKey1, signature1);
    processGuaranteeExtrinsic(report1, onchainState, currentSlot);

    // 9. Guarantor 2 signs
    const preliminaryReport2 = makeReport(guarantorPublicKey2, '');
    const signature2 = signMessage(preliminaryReport2.toSignableObject(), guarantorKeyPair2.secretKey);
    const report2 = makeReport(guarantorPublicKey2, signature2);
    processGuaranteeExtrinsic(report2, onchainState, currentSlot);

    // 10. Show state after both signatures
    console.log("\n--- After Both Guarantors Submitted ---");
    console.log("Pending Reports (ρ):", onchainState.ρ.size);
    console.log("Accumulation Queue (ω):", onchainState.ω.size);
    console.log("History (ξ):", onchainState.ξ.size);

    // 11. Process accumulation queue (should move to ξ)
    processAccumulationQueue(onchainState, currentSlot + 1);

    // 12. Show final state
    console.log("\n--- After Accumulation ---");
    console.log("Pending Reports (ρ):", onchainState.ρ.size);
    console.log("Accumulation Queue (ω):", onchainState.ω.size);
    console.log("History (ξ):", onchainState.ξ.size);

    // 13. Print digest and check if in history
    const digest = generateWorkDigest(report1).hash;
    if (onchainState.ξ.has(digest)) {
        console.log(`\nSUCCESS: Report ${digest} is now finalized in history (ξ)!`);
    } else {
        console.log(`\nERROR: Report ${digest} did not reach history (ξ).`);
    }
})();