// --- src/offchain/guarantor.js ---
/**
 * Implements the Refine process, taking a Work-Package and Refinement Context
 * to produce a Work-Report. This embodies the Ξ function.
 */
import { WorkPackage, RefinementContext, WorkReport } from '../models/index.js';
import { PVMExecutionError, AuthorizationError } from '../utils/errors.js';
import { signMessage, publicKeyToBase64 } from './signature.js';
import { encodeForAvailability } from './encoder.js';
import { sha256 } from 'js-sha256'; // Changed to npm import for Node.js testing

/**
 * Mocks the V_R PVM execution.
 * In a real scenario, this would involve a WebAssembly runtime or similar.
 * @param {WorkPackage} workPackage
 * @param {RefinementContext} context
 * @param {number} [forceGasUsed] - Optional: force a specific gasUsed value for testing.
 * @returns {{output: string, gasUsed: number}}
 */
const simulateVRPVM = (workPackage, context, forceGasUsed) => {
    // This is a highly simplified simulation.
    // A real PVM would execute the programHash from WorkItems with inputData.
    try {
        const combinedInput = JSON.stringify({
            workPackageId: workPackage.authorizationToken, // Using token as a unique ID for simulation
            contextAnchor: context.anchorBlockRoot,
            firstWorkItemProgram: workPackage.workItems.programHash,
            firstWorkItemInput: workPackage.workItems.inputData,
        });

        // Simulate some computational work and gas usage
        const simulatedOutput = `PVM_OUTPUT_${sha256(combinedInput)}`;
        const simulatedGasUsed = forceGasUsed!== undefined? forceGasUsed : (Math.floor(Math.random() * 1000) + 100); // Random gas between 100 and 1100

        // Simulate a potential PVM failure
        if (Math.random() < 0.00) { // 0% chance of failure for deterministic tests
            throw new PVMExecutionError("Simulated PVM execution failed.");
        }

        return {
            output: simulatedOutput,
            gasUsed: simulatedGasUsed,
        };
    } catch (error) {
        throw new PVMExecutionError(`PVM simulation error: ${error.message}`);
    }
};

/**
 * Mocks historical lookup for dependencies.
 * In a real system, this would query a historical state database.
 * @param {string} dependencyHashes - Array of WorkDigest hashes.
 * @param {object} onchainState - Current on-chain state for checking recent history.
 * @returns {boolean} True if all dependencies are found and valid.
 */
const historicalLookup = (dependencyHashes, onchainState) => {
    // For now, assume all dependencies are met in history for simplicity.
    // In a real system, this would involve querying a database or cache
    // to check if these WorkDigests exist and are finalized (in onchainState.ξ)
    // or are pending in the current block (in onchainState.ρ).
    // For testing, we'll ensure the onchainState is passed.
    console.log(`Performing historical lookup for dependencies: ${dependencyHashes.join(', ')}`);
    for (const depHash of dependencyHashes) {
        if (!onchainState.ξ.has(depHash) &&!onchainState.ρ.has(depHash)) {
            console.warn(`Dependency ${depHash} not found in history or pending reports.`);
            return false;
        }
    }
    return true; // Mock: all found
};

/**
 * Mocks authorization pool checks.
 * This subsystem only reads authorization pools.
 * @param {string} authorizationToken
 * @param {object} authServiceDetails
 * @returns {boolean} True if authorized.
 */
const checkAuthorization = (authorizationToken, authServiceDetails) => {
    // In a real system, this would involve querying the authorization pools
    // to verify the token and service details.
    console.log(`Checking authorization for token: ${authorizationToken} via service: ${authServiceDetails.h}`);
    // Mock: always authorized for demonstration
    return true;
};

/**
 * The core Refine process (Ξ function).
 * Takes a Work-Package and Refinement Context, executes PVM, and generates a Work-Report.
 * @param {WorkPackage} workPackage - The Work-Package to refine.
 * @param {RefinementContext} refinementContext - The context for refinement.
 * @param {Uint8Array} guarantorPrivateKey - The private key of the guarantor for signing.
 * @param {number} coreIndex - The index of the core this report is for.
 * @param {number} slot - The slot number at which the report is being generated.
 * @param {string} [dependencies=] - Optional list of WorkDigest hashes this report depends on.
 * @param {object} onchainState - The current on-chain state (for dependency checks).
 * @param {number} [forceGasUsed] - Optional: force a specific gasUsed value for testing.
 * @returns {Promise<WorkReport>} A promise that resolves to the generated WorkReport.
 */
export const refineWorkPackage = async (workPackage, refinementContext, guarantorPrivateKey, coreIndex, slot, dependencies = onchainState, forceGasUsed) => {
    console.log("Starting refinement process...");

    // 1. Authorization Check
    if (!checkAuthorization(workPackage.authorizationToken, workPackage.authorizationServiceDetails)) {
        throw new AuthorizationError("Work-Package not authorized.");
    }

    // 2. Historical Lookup for Dependencies
    if (dependencies.length > 0 &&!historicalLookup(dependencies, onchainState)) {
        throw new Error("One or more dependencies not found in historical state.");
    }

    // 3. Simulate V_R PVM Execution
    let pvmResult;
    try {
        pvmResult = simulateVRPVM(workPackage, refinementContext, forceGasUsed);
        console.log(`PVM executed. Output: ${pvmResult.output}, Gas Used: ${pvmResult.gasUsed}`);
    } catch (error) {
        throw new PVMExecutionError(`Failed to execute PVM: ${error.message}`);
    }

    // 4. Generate Availability Specification (Y)
    const availabilitySpec = encodeForAvailability(
        // We'll create a temporary report object to pass to encoder for hashing,
        // as the full report isn't signed yet.
        new WorkReport(
            workPackage,
            refinementContext,
            pvmResult.output,
            pvmResult.gasUsed,
            null, // AvailabilitySpec not yet known
            '', // Signature not yet known
            '', // Public key not yet known
            coreIndex,
            slot,
            dependencies
        ),
        4, // dataFragments (example)
        2  // parityFragments (example)
    );
    console.log("Availability Specification generated.");

    // 5. Construct Work-Report (R) - preliminary
    const guarantorPublicKey = publicKeyToBase64(guarantorPrivateKey.subarray(32)); // Extract public key from private key
    const preliminaryReport = new WorkReport(
        workPackage,
        refinementContext,
        pvmResult.output,
        pvmResult.gasUsed,
        availabilitySpec,
        '', // Signature will be added next
        guarantorPublicKey,
        coreIndex,
        slot,
        dependencies
    );

    // 6. Sign the Work-Report
    const signature = signMessage(preliminaryReport.toSignableObject(), guarantorPrivateKey);
    console.log("Work-Report signed.");

    // 7. Finalize Work-Report with signature
    preliminaryReport.guarantorSignature = signature;

    console.log("Refinement process completed. Work-Report generated.");
    return preliminaryReport;
};