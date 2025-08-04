
// Import necessary modules
import { WorkPackage, WorkItem, RefinementContext } from '../src/models/index.js';
import { refineWorkPackage } from '../src/offchain/guarantor.js';
import { generateKeyPair, publicKeyToBase64, verifySignature, base64ToPublicKey } from '../src/offchain/signature.js';
import { generateWorkDigest } from '../src/offchain/encoder.js';

// Self-executing async function to demonstrate
(async () => {
    console.log("\n--- Demonstrating Phase 1 Implementation ---");

    // 1. Generate a guarantor key pair
    const guarantorKeyPair = generateKeyPair();
    const guarantorPublicKeyBase64 = publicKeyToBase64(guarantorKeyPair.publicKey);
    console.log(`Guarantor Public Key: ${guarantorPublicKeyBase64}`);

    // 2. Create a Work-Item
    const workItem1 = new WorkItem(
        "wi-001",
        "0xprogramhash123",
        "input_data_for_program_1",
        50000
    );

    // 3. Create a Work-Package
    const workPackage = new WorkPackage(
        "auth-token-xyz-123",
        { h: "auth.service.com", u: "/verify", f: "checkAuth" },
        "context_string_abc",
        [workItem1]
    );
    console.log("\nWork-Package created:", workPackage.toObject());

    // 4. Create a Refinement Context
    const refinementContext = new RefinementContext(
        "0xanchorblockroot456",
        100,
        "0xbeefymmrroot789",
        101,
        1,
        ["guarantor1_pk", guarantorPublicKeyBase64, "guarantor3_pk"], // Include our guarantor
        ["prev_guarantorA_pk", "prev_guarantorB_pk"]
    );
    console.log("\nRefinement Context created:", refinementContext.toObject());

    // 5. Refine the Work-Package to generate a Work-Report
    try {
        console.log("Work package: ", workPackage);
        console.log("Refinement context: ", refinementContext);
        console.log("Guarantor private key (for signing):", guarantorKeyPair);
        const generatedReport = await refineWorkPackage(
            workPackage,
            refinementContext,
            guarantorKeyPair.secretKey, // Use the private key for signing
            0, // coreIndex
            101, // slot
            [] // No dependencies for this example
        );
        console.log("\nGenerated Work-Report:", generatedReport.toObject());

        // 6. Verify the signature of the generated report
        const isSignatureValid = verifySignature(
            generatedReport.toSignableObject(),
            generatedReport.guarantorSignature,
            base64ToPublicKey(generatedReport.guarantorPublicKey)
        );
        console.log(`\nWork-Report signature valid: ${isSignatureValid}`);

        // 7. Generate WorkDigest for the report
        const reportDigest = generateWorkDigest(generatedReport);
        console.log("Generated Work-Digest:", reportDigest.toObject());

    } catch (error) {
        console.error("\nError during refinement process:", error.message);
        if (error.name === "ValidationError") {
            console.error("Validation details:", error.message);
        }
    }

    // Example of a failing validation (uncomment to test)
    // try {
    //     new WorkItem("wi-002", "prog", "input", -100); // Invalid gasLimit
    // } catch (error) {
    //     console.error("\nExpected Validation Error:", error.message);
    // }

    // Example of a simulated PVM execution error (uncomment to test, adjust random chance in simulateVRPVM)
    // try {
    //     // To force PVM error, you might temporarily modify simulateVRPVM to always throw
    //     await refineWorkPackage(
    //         workPackage,
    //         refinementContext,
    //         guarantorKeyPair.secretKey,
    //         0,
    //         101,
    //         []
    //     );
    // } catch (error) {
    //     console.error("\nExpected PVM Execution Error:", error.message);
    // }

})();
