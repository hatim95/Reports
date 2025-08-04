import { ProtocolError } from '../../utils/errors.ts';
import { OnchainState } from '../state.ts';
import { WorkReport } from '../../models/WorkReport.ts';

interface DisputeExtrinsic {
  disputedDigestHash: string;
  disputerPublicKey: string;
  reason: string;
}

interface OffenderRecord {
  disputeCount: number;
  lastDisputeSlot: number;
}

interface BadReportRecord {
  reason: string;
  disputedBy: Set<string>;
}

/**
 * Processes a dispute extrinsic.
 * @param dispute - The dispute data.
 * @param onchainState - The current on-chain state.
 * @param currentSlot - The current block slot.
 */
export const processDisputeExtrinsic = (
  dispute: DisputeExtrinsic,
  onchainState: OnchainState,
  currentSlot: number
): void => {
  const { disputedDigestHash, disputerPublicKey, reason } = dispute;
  console.log(`[E_D] Processing dispute for digest: ${disputedDigestHash} by ${disputerPublicKey} at slot ${currentSlot}. Reason: ${reason}`);

  if (!onchainState.getReportByDigest(disputedDigestHash)) {
    console.warn(`[E_D] Attempted to dispute non-existent or already finalized/disputed report: ${disputedDigestHash}`);
    return;
  }

  let disputedReport: WorkReport | null = null;

  // Remove from pending reports (ρ)
  if (onchainState.ρ.has(disputedDigestHash)) {
    disputedReport = onchainState.ρ.get(disputedDigestHash)!.report;
    onchainState.ρ.delete(disputedDigestHash);
    console.log(`[E_D] Removed report ${disputedDigestHash} from pending (ρ).`);
  }

  // Remove from accumulation queue (ω)
  if (onchainState.ω.has(disputedDigestHash)) {
    disputedReport = onchainState.ω.get(disputedDigestHash)!.report;
    onchainState.ω.delete(disputedDigestHash);
    console.log(`[E_D] Removed report ${disputedDigestHash} from accumulation queue (ω).`);
  }

  // Handle late dispute from history (ξ)
  if (onchainState.ξ.has(disputedDigestHash) && !disputedReport) {
    disputedReport = onchainState.ξ.get(disputedDigestHash)!;
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
    const newBadReport: BadReportRecord = {
      reason,
      disputedBy: new Set([disputerPublicKey]),
    };
    onchainState.ψ_B.set(disputedDigestHash, newBadReport);
  }
  console.log(`[E_D] Recorded report ${disputedDigestHash} in bad reports (ψ_B).`);

  // Update ψ_O (offenders)
  const guarantorPublicKey = disputedReport.guarantorPublicKey;
  const offenderRecord = onchainState.ψ_O.get(guarantorPublicKey);
  if (offenderRecord) {
    offenderRecord.disputeCount++;
    offenderRecord.lastDisputeSlot = currentSlot;
  } else {
    const newOffender: OffenderRecord = {
      disputeCount: 1,
      lastDisputeSlot: currentSlot,
    };
    onchainState.ψ_O.set(guarantorPublicKey, newOffender);
  }
  console.log(`[E_D] Updated offender record for guarantor ${guarantorPublicKey}.`);
};
