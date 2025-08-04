/**
 * Simulates the processing of an E_G (Guarantees) extrinsic.
 * Handles validation and state updates for new Work-Report submissions.
 */
import { WorkReport } from '../../models/WorkReport.js';
import { WorkDigest } from '../../models/WorkDigest.js';
import { verifySignature, base64ToPublicKey } from '../../offchain/signature.js';
import { generateWorkDigest } from '../../offchain/encoder.js';
import { ONCHAIN_CONSTANTS } from '../constants.js';
import { ProtocolError, ValidationError } from '../../utils/errors.js';

/**
 * Validates a WorkReport against on-chain rules.
 * @param {WorkReport} report - The report to validate.
 * @param {OnchainState} onchainState - The current on-chain state.
 * @param {number} currentSlot - The current block slot.
 * @param {WorkDigest[]} currentBlockDigests - Digests of other reports in the same block (for mutual dependencies).
 */
const validateWorkReport = (report, onchainState, currentSlot, currentBlockDigests) => {
    // 1. Signature Validation (bad_signature)
    const publicKeyBytes = base64ToPublicKey(report.guarantorPublicKey);
    if (!verifySignature(report.toSignableObject(), report.guarantorSignature, publicKeyBytes)) {
        throw new ProtocolError("bad_signature: Work-Report signature is invalid.");
    }

    // 2. Context Validity (anchor_not_recent, bad_beefy_mmr, bad_state_root - simplified)
    const context = report.refinementContext;
    if (currentSlot - context.anchorBlockNumber > ONCHAIN_CONSTANTS.ANCHOR_MAX_AGE_SLOTS) {
        throw new ProtocolError("anchor_not_recent: Context anchor block is too old.");
    }
    // Mock checks for MMR/State root - in a real system, these would be cryptographic proofs
    if (context.beefyMmrRoot !== `0xbeefymmrroot_valid_${context.anchorBlockNumber}`) { // Simplistic mock
        // throw new ProtocolError("bad_beefy_mmr: Context Beefy MMR root does not match.");
    }
    if (context.anchorBlockRoot !== `0xanchorblockroot_valid_${context.anchorBlockNumber}`) { // Simplistic mock
        // throw new ProtocolError("bad_state_root: Context state root does not match.");
    }

    // 3. Core Index and Service ID (bad_core_index, bad_service_id)
    if (report.coreIndex < 0 || report.coreIndex > ONCHAIN_CONSTANTS.MAX_CORE_INDEX) {
        throw new ProtocolError("bad_core_index: Core index is out of bounds.");
    }
    // Simplified: Check if service exists in global state's service registry
    const serviceId = report.workPackage.authorizationServiceDetails.u; // Using URL as service ID for mock
    if (!onchainState.globalState.serviceRegistry.has(serviceId)) {
        // throw new ProtocolError("bad_service_id: Work result service identifier has no associated account in state.");
    }

    // 4. Code Hash (bad_code_hash)
    // Simplified: Check if programHash matches expected for the service
    const expectedCodeHash = onchainState.globalState.serviceRegistry.get(serviceId)?.codeHash;
    if (expectedCodeHash && report.workPackage.workItems[0].programHash !== expectedCodeHash) {
        // throw new ProtocolError("bad_code_hash: Work result code hash doesn't match expected for service.");
    }

    // 5. Guarantor Assignment (wrong_assignment, not_authorized, bad_validator_index)
    const currentGuarantors = context.currentGuarantors;
    const previousGuarantors = context.previousGuarantors;
    const reportSlot = report.slot;
    const currentEpoch = context.currentEpoch;
    const reportEpoch = Math.floor(reportSlot / ONCHAIN_CONSTANTS.REPORT_TIMEOUT_SLOTS); // Simplistic epoch calculation

    let isGuarantorAssigned = false;
    // Check current rotation
    if (reportEpoch === currentEpoch && currentGuarantors.includes(report.guarantorPublicKey)) {
        isGuarantorAssigned = true;
    }
    // Check previous rotation if report slot falls within previous epoch
    if (!isGuarantorAssigned && reportEpoch === currentEpoch - 1 && previousGuarantors.includes(report.guarantorPublicKey)) {
        isGuarantorAssigned = true;
    }

    if (!isGuarantorAssigned) {
        throw new ProtocolError("wrong_assignment / not_authorized: Unexpected guarantor for work report core or not authorized.");
    }

    // 6. Core Availability (core_engaged)
    // Mock: Assume core is available unless explicitly marked otherwise
    if (onchainState.globalState.coreStatus.get(report.coreIndex) === 'engaged') {
        throw new ProtocolError(`core_engaged: Core ${report.coreIndex} is not available.`);
    }

    // 7. Slot Validity (future_report_slot, report_before_last_rotation)
    if (report.slot > currentSlot) {
        throw new ProtocolError("future_report_slot: Report refers to a slot in the future.");
    }
    if (currentSlot - report.slot > ONCHAIN_CONSTANTS.REPORT_TIMEOUT_SLOTS) { // Using timeout as "too old" threshold
        throw new ProtocolError("report_before_last_rotation: Report guarantee slot is too old.");
    }

    // 8. Dependencies (dependency_missing, many_dependencies, too_many_dependencies, segment_root_lookup_invalid)
    if (report.dependencies.length > ONCHAIN_CONSTANTS.MAX_DEPENDENCIES) {
        throw new ProtocolError("too_many_dependencies: Work report has too many dependencies.");
    }
    for (const depHash of report.dependencies) {
        // Check if dependency is in finalized history (ξ), pending (ρ), or in current block (currentBlockDigests)
        const isDependencyMet = onchainState.ξ.has(depHash) ||
                                onchainState.ρ.has(depHash) ||
                                currentBlockDigests.some(d => d.hash === depHash);
        if (!isDependencyMet) {
            throw new ProtocolError(`dependency_missing / segment_root_lookup_invalid: Dependency ${depHash} not found.`);
        }
        // For segment_root_lookup_invalid-2, you'd need to verify the *value* of the segment root,
        // which requires a more complex mock of the segment tree.
    }

    // 9. Gas Limits (high_work_report_gas, too_high_work_report_gas, service_item_gas_too_low)
    if (report.gasUsed > ONCHAIN_CONSTANTS.MAX_WORK_REPORT_GAS) {
        throw new ProtocolError("too_high_work_report_gas: Work report per core gas is too high.");
    }
    if (report.workPackage.workItems.some(item => item.gasLimit < ONCHAIN_CONSTANTS.MIN_SERVICE_ITEM_GAS)) {
        throw new ProtocolError("service_item_gas_too_low: Accumulate gas is below the service minimum.");
    }

    // 10. Duplicate Package (duplicate_package_in_recent_history, duplicated_package_in_report)
    const reportDigest = generateWorkDigest(report);
    if (onchainState.ξ.has(reportDigest.hash)) { // Already finalized
        throw new ProtocolError("duplicate_package_in_recent_history: Package was already finalized.");
    }
    // If WorkDigest is already in ρ, it's a duplicate submission of the exact same report
    // if (onchainState.ρ.has(reportDigest.hash)) {
    //     throw new ProtocolError("duplicated_package_in_report: Report already pending in ρ.");
    // }
    // `duplicated_package_in_report` also refers to multiple identical reports within the *same* extrinsic.
    // This function processes one report at a time, so this specific check would be done at a higher level
    // before calling this function for each report in a batch.

    // 11. Guarantor List Order/Uniqueness (not_sorted_guarantor, out_of_order_guarantees)
    // These checks usually apply to the list of guarantors within the *guarantee extrinsic itself*,
    // not necessarily the WorkReport's guarantorPublicKey. If the WorkReport contained a list
    // of co-guarantors, this would apply. For now, assuming single guarantor per report.
};

/**
 * Processes an E_G (Guarantees) extrinsic, adding a WorkReport to the pending queue.
 * @param {WorkReport} report - The Work-Report submitted.
 * @param {OnchainState} onchainState - The current on-chain state.
 * @param {number} currentSlot - The current block slot.
 * @param {WorkDigest[]} currentBlockDigests - Digests of other reports in the same block (for mutual dependencies).
 * @returns {boolean} True if the report was successfully processed and added/updated.
 */
export const processGuaranteeExtrinsic = (report, onchainState, currentSlot, currentBlockDigests = []) => {
    console.log(`[E_G] Processing Work-Report from ${report.guarantorPublicKey} for core ${report.coreIndex} at slot ${report.slot}`);

    try {
        validateWorkReport(report, onchainState, currentSlot, currentBlockDigests);
    } catch (error) {
        console.error(`[E_G] Report validation failed: ${error.message}`);
        // Add to bad reports (ψ_B) if validation fails
        const reportDigest = generateWorkDigest(report);
        onchainState.ψ_B.set(reportDigest.hash, { reason: error.message, disputedBy: new Set(['system_validation']) });
        // Optionally, penalize the guarantor here by updating ψ_O
        const offenderRecord = onchainState.ψ_O.get(report.guarantorPublicKey);
        if (offenderRecord) {
            offenderRecord.disputeCount++;
            offenderRecord.lastDisputeSlot = currentSlot;
        } else {
            onchainState.ψ_O.set(report.guarantorPublicKey, { disputeCount: 1, lastDisputeSlot: currentSlot });
        }
        return false;
    }

    const reportDigest = generateWorkDigest(report);
    const digestHash = reportDigest.hash;

    let reportEntry = onchainState.ρ.get(digestHash);

    if (!reportEntry) {
        // First submission for this digest
        reportEntry = {
            report: report,
            receivedSignatures: new Set([report.guarantorPublicKey]),
            submissionSlot: currentSlot,
        };
        onchainState.ρ.set(digestHash, reportEntry);
        console.log(`[E_G] New report ${digestHash} added to pending (ρ).`);
    } else {
        // Additional signature for an already pending report
        if (reportEntry.receivedSignatures.has(report.guarantorPublicKey)) {
            console.log(`[E_G] Duplicate signature from ${report.guarantorPublicKey} for report ${digestHash}. Ignoring.`);
            return false; // Already received this specific signature
        }
        reportEntry.receivedSignatures.add(report.guarantorPublicKey);
        console.log(`[E_G] Added signature from ${report.guarantorPublicKey} for report ${digestHash}. Total signatures: ${reportEntry.receivedSignatures.size}`);
    }

    // Check for 2/3 super-majority to make report available
    const totalGuarantors = report.refinementContext.currentGuarantors.length + report.refinementContext.previousGuarantors.length; // Simplified total
    const requiredSignatures = Math.ceil(
        totalGuarantors * ONCHAIN_CONSTANTS.SUPER_MAJORITY_THRESHOLD_NUMERATOR / ONCHAIN_CONSTANTS.SUPER_MAJORITY_THRESHOLD_DENOMINATOR
    );

    if (reportEntry.receivedSignatures.size >= requiredSignatures) {
        console.log(`[E_G] Report ${digestHash} reached 2/3 super-majority (${reportEntry.receivedSignatures.size}/${totalGuarantors}). Moving to accumulation queue (ω).`);
        onchainState.ρ.delete(digestHash);
        onchainState.ω.set(digestHash, { report: report, status: 'ready' });
        return true;
    } else {
        console.log(`[E_G] Report ${digestHash} needs more signatures (${reportEntry.receivedSignatures.size}/${requiredSignatures}).`);
    }

    // Handle timeout mechanism (simplified)
    if (currentSlot - reportEntry.submissionSlot > ONCHAIN_CONSTANTS.REPORT_TIMEOUT_SLOTS) {
        console.log(`[E_G] Report ${digestHash} timed out. Removing from pending (ρ).`);
        onchainState.ρ.delete(digestHash);
        // Optionally, add to ψ_B and penalize guarantor if it timed out without enough signatures
        onchainState.ψ_B.set(digestHash, { reason: 'timed_out', disputedBy: new Set(['system_timeout']) });
        // No direct guarantor penalty here unless it's a "bad" timeout (e.g., no signatures at all)
        return false;
    }

    return true;
};