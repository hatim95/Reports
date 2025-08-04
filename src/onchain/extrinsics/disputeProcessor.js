/**
 * Simulates the processing of an E_D (Disputes) extrinsic.
 * Handles removal of disputed reports and updates offender records.
 */
import { ProtocolError } from '../../utils/errors.js';

/**
 * Processes a dispute extrinsic.
 * @param {{disputedDigestHash: string, disputerPublicKey: string, reason: string}} dispute - The dispute data.
 * @param {OnchainState} onchainState - The current on-chain state.
 * @param {number} currentSlot - The current block slot.
 */
export const processDisputeExtrinsic = (dispute, onchainState, currentSlot) => {
    const { disputedDigestHash, disputerPublicKey, reason } = dispute;
    console.log(`[E_D] Processing dispute for digest: ${disputedDigestHash} by ${disputerPublicKey} at slot ${currentSlot}. Reason: ${reason}`);

    if (!onchainState.getReportByDigest(disputedDigestHash)) {
        console.warn(`[E_D] Attempted to dispute non-existent or already finalized/disputed report: ${disputedDigestHash}`);
        // In a real chain, this might be a no-op or a specific error.
        return;
    }

    let disputedReport = null;

    // Remove from pending reports (ρ)
    if (onchainState.ρ.has(disputedDigestHash)) {
        disputedReport = onchainState.ρ.get(disputedDigestHash).report;
        onchainState.ρ.delete(disputedDigestHash);
        console.log(`[E_D] Removed report ${disputedDigestHash} from pending (ρ).`);
    }
    // Remove from accumulation queue (ω)
    if (onchainState.ω.has(disputedDigestHash)) {
        disputedReport = onchainState.ω.get(disputedDigestHash).report;
        onchainState.ω.delete(disputedDigestHash);
        console.log(`[E_D] Removed report ${disputedDigestHash} from accumulation queue (ω).`);
    }
    // Cannot dispute from history (ξ) directly, but might be a "late dispute"
    if (onchainState.ξ.has(disputedDigestHash) && !disputedReport) {
        disputedReport = onchainState.ξ.get(disputedDigestHash);
        console.warn(`[E_D] Late dispute for finalized report ${disputedDigestHash}. It remains in history but guarantor will be penalized.`);
    }

    if (!disputedReport) {
        throw new ProtocolError(`Attempted to dispute a report (${disputedDigestHash}) that was not found in active state or history.`);
    }

    // Record in ψ_B (bad reports)
    const existingBadReport = onchainState.ψ_B.get(disputedDigestHash);
    if (existingBadReport) {
        existingBadReport.disputedBy.add(disputerPublicKey);
    } else {
        onchainState.ψ_B.set(disputedDigestHash, {
            reason: reason,
            disputedBy: new Set([disputerPublicKey]),
        });
    }
    console.log(`[E_D] Recorded report ${disputedDigestHash} in bad reports (ψ_B).`);

    // Update ψ_O (offenders)
    const guarantorPublicKey = disputedReport.guarantorPublicKey;
    const offenderRecord = onchainState.ψ_O.get(guarantorPublicKey);
    if (offenderRecord) {
        offenderRecord.disputeCount++;
        offenderRecord.lastDisputeSlot = currentSlot;
    } else {
        onchainState.ψ_O.set(guarantorPublicKey, {
            disputeCount: 1,
            lastDisputeSlot: currentSlot,
        });
    }
    console.log(`[E_D] Updated offender record for guarantor ${guarantorPublicKey}.`);
};