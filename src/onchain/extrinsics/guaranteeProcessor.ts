/**
 * Simulates the processing of an E_G (Guarantees) extrinsic.
 * Handles validation and state updates for new Work-Report submissions.
 */
import { WorkReport } from '../../models/WorkReport.ts';
import { WorkDigest } from '../../models/WorkDigest.ts';
import { verifySignature, base64ToPublicKey } from '../../offchain/signature.ts';
import { generateWorkDigest } from '../../offchain/encoder.ts';
import { ONCHAIN_CONSTANTS } from '../constants.ts';
import { ProtocolError } from '../../utils/errors.ts';
import type { OnchainState } from '../state.ts';

interface ReportEntry {
  report: WorkReport;
  receivedSignatures: Set<string>;
  submissionSlot: number;
}

interface BadReportEntry {
  reason: string;
  disputedBy: Set<string>;
}

interface OffenderRecord {
  disputeCount: number;
  lastDisputeSlot: number;
}

const validateWorkReport = (
  report: WorkReport,
  onchainState: OnchainState,
  currentSlot: number,
  currentBlockDigests: WorkDigest[]
): void => {
  const publicKeyBytes = base64ToPublicKey(report.guarantorPublicKey);
  if (!verifySignature(report.toSignableObject(), report.guarantorSignature, publicKeyBytes)) {
    throw new ProtocolError('bad_signature: Work-Report signature is invalid.');
  }

  const context = report.refinementContext;
  if (currentSlot - context.anchorBlockNumber > ONCHAIN_CONSTANTS.ANCHOR_MAX_AGE_SLOTS) {
    throw new ProtocolError('anchor_not_recent: Context anchor block is too old.');
  }

  const serviceId = report.workPackage.authorizationServiceDetails.u;
  if (!onchainState.globalState.serviceRegistry.has(serviceId)) {
    // throw new ProtocolError("bad_service_id: Work result service identifier has no associated account in state.");
  }

  const expectedCodeHash = onchainState.globalState.serviceRegistry.get(serviceId)?.codeHash;
if (
  expectedCodeHash &&
  report.workPackage?.workItems?.[0]?.programHash !== expectedCodeHash
) {
  throw new ProtocolError("bad_code_hash: Work result code hash doesn't match expected for service.");
}



  const currentGuarantors = context.currentGuarantors;
  const previousGuarantors = context.previousGuarantors;
  const reportSlot = report.slot;
  const currentEpoch = context.currentEpoch;
  const reportEpoch = Math.floor(
    reportSlot / ONCHAIN_CONSTANTS.REPORT_TIMEOUT_SLOTS
  );

  let isGuarantorAssigned = false;
  if (reportEpoch === currentEpoch && currentGuarantors.includes(report.guarantorPublicKey)) {
    isGuarantorAssigned = true;
  }
  if (
    !isGuarantorAssigned &&
    reportEpoch === currentEpoch - 1 &&
    previousGuarantors.includes(report.guarantorPublicKey)
  ) {
    isGuarantorAssigned = true;
  }

  if (!isGuarantorAssigned) {
    throw new ProtocolError(
      'wrong_assignment / not_authorized: Unexpected guarantor for work report core or not authorized.'
    );
  }

  if (onchainState.globalState.coreStatus.get(report.coreIndex) === 'engaged') {
    throw new ProtocolError(`core_engaged: Core ${report.coreIndex} is not available.`);
  }

  if (report.slot > currentSlot) {
    throw new ProtocolError('future_report_slot: Report refers to a slot in the future.');
  }
  if (currentSlot - report.slot > ONCHAIN_CONSTANTS.REPORT_TIMEOUT_SLOTS) {
    throw new ProtocolError('report_before_last_rotation: Report guarantee slot is too old.');
  }

  if (report.dependencies.length > ONCHAIN_CONSTANTS.MAX_DEPENDENCIES) {
    throw new ProtocolError('too_many_dependencies: Work report has too many dependencies.');
  }
  for (const depHash of report.dependencies) {
    const isDependencyMet =
      onchainState.ξ.has(depHash) ||
      onchainState.ρ.has(depHash) ||
      currentBlockDigests.some((d) => d.hash === depHash);
    if (!isDependencyMet) {
      throw new ProtocolError(
        `dependency_missing / segment_root_lookup_invalid: Dependency ${depHash} not found.`
      );
    }
  }

  if (report.gasUsed > ONCHAIN_CONSTANTS.MAX_WORK_REPORT_GAS) {
    throw new ProtocolError('too_high_work_report_gas: Work report per core gas is too high.');
  }
  if (
    report.workPackage.workItems.some(
      (item) => item.gasLimit < ONCHAIN_CONSTANTS.MIN_SERVICE_ITEM_GAS
    )
  ) {
    throw new ProtocolError('service_item_gas_too_low: Accumulate gas is below the service minimum.');
  }

  const reportDigest = generateWorkDigest(report);
  if (onchainState.ξ.has(reportDigest.hash)) {
    throw new ProtocolError('duplicate_package_in_recent_history: Package was already finalized.');
  }
};

export const processGuaranteeExtrinsic = (
  report: WorkReport,
  onchainState: OnchainState,
  currentSlot: number,
  currentBlockDigests: WorkDigest[] = []
): boolean => {
  console.log(
    `[E_G] Processing Work-Report from ${report.guarantorPublicKey} for core ${report.coreIndex} at slot ${report.slot}`
  );

  try {
    validateWorkReport(report, onchainState, currentSlot, currentBlockDigests);
  } catch (error) {
    console.error(`[E_G] Report validation failed: ${(error as Error).message}`);
    const reportDigest = generateWorkDigest(report);
    onchainState.ψ_B.set(reportDigest.hash, {
      reason: (error as Error).message,
      disputedBy: new Set(['system_validation'])
    });
    const offenderRecord = onchainState.ψ_O.get(report.guarantorPublicKey);
    if (offenderRecord) {
      offenderRecord.disputeCount++;
      offenderRecord.lastDisputeSlot = currentSlot;
    } else {
      onchainState.ψ_O.set(report.guarantorPublicKey, {
        disputeCount: 1,
        lastDisputeSlot: currentSlot
      });
    }
    return false;
  }

  const reportDigest = generateWorkDigest(report);
  const digestHash = reportDigest.hash;
  let reportEntry = onchainState.ρ.get(digestHash);

  if (!reportEntry) {
    reportEntry = {
      report,
      receivedSignatures: new Set([report.guarantorPublicKey]),
      submissionSlot: currentSlot
    };
    onchainState.ρ.set(digestHash, reportEntry);
    console.log(`[E_G] New report ${digestHash} added to pending (ρ).`);
  } else {
    if (reportEntry.receivedSignatures.has(report.guarantorPublicKey)) {
      console.log(
        `[E_G] Duplicate signature from ${report.guarantorPublicKey} for report ${digestHash}. Ignoring.`
      );
      return false;
    }
    reportEntry.receivedSignatures.add(report.guarantorPublicKey);
    console.log(
      `[E_G] Added signature from ${report.guarantorPublicKey} for report ${digestHash}. Total signatures: ${reportEntry.receivedSignatures.size}`
    );
  }

  const totalGuarantors =
    report.refinementContext.currentGuarantors.length +
    report.refinementContext.previousGuarantors.length;
  const requiredSignatures = Math.ceil(
    (totalGuarantors * ONCHAIN_CONSTANTS.SUPER_MAJORITY_THRESHOLD_NUMERATOR) /
      ONCHAIN_CONSTANTS.SUPER_MAJORITY_THRESHOLD_DENOMINATOR
  );

  if (reportEntry.receivedSignatures.size >= requiredSignatures) {
    console.log(
      `[E_G] Report ${digestHash} reached 2/3 super-majority (${reportEntry.receivedSignatures.size}/${totalGuarantors}). Moving to accumulation queue (ω).`
    );
    onchainState.ρ.delete(digestHash);
    onchainState.ω.set(digestHash, { report, status: 'ready' });
    return true;
  } else {
    console.log(
      `[E_G] Report ${digestHash} needs more signatures (${reportEntry.receivedSignatures.size}/${requiredSignatures}).`
    );
  }

  if (currentSlot - reportEntry.submissionSlot > ONCHAIN_CONSTANTS.REPORT_TIMEOUT_SLOTS) {
    console.log(`[E_G] Report ${digestHash} timed out. Removing from pending (ρ).`);
    onchainState.ρ.delete(digestHash);
    onchainState.ψ_B.set(digestHash, {
      reason: 'timed_out',
      disputedBy: new Set(['system_timeout'])
    });
    return false;
  }

  return true;
};
