// --- src/offchain/guarantor.ts ---
/**
 * Implements the Refine process, taking a Work-Package and Refinement Context
 * to produce a Work-Report. This embodies the Ξ function.
 */

import { WorkPackage, RefinementContext, WorkReport } from '../models/index.ts';
import { PVMExecutionError, AuthorizationError } from '../utils/errors.ts';
import { signMessage, publicKeyToBase64 } from './signature.ts';
import { encodeForAvailability } from './encoder.ts';
import { sha256 } from 'js-sha256';
import { AvailabilitySpec } from '../models/AvailabilitySpec.ts';
import { WorkDigest } from '../models/WorkDigest.ts';

// Type definition for PVM simulation result
interface PVMResult {
  output: string;
  gasUsed: number;
}

// Type definition for OnChain state
interface OnchainState {
  ξ: Set<string>;
  ρ: Set<string>;
}

/**
 * Mocks the V_R PVM execution.
 */
const simulateVRPVM = (
  workPackage: WorkPackage,
  context: RefinementContext,
  forceGasUsed?: number
): PVMResult => {
  try {
    const combinedInput = JSON.stringify({
      workPackageId: workPackage.authorizationToken,
      contextAnchor: context.anchorBlockRoot,
      firstWorkItemProgram: workPackage.workItems[0]?.programHash,
      firstWorkItemInput: workPackage.workItems[0]?.inputData,
    });

    const simulatedOutput = `PVM_OUTPUT_${sha256(combinedInput)}`;
    const simulatedGasUsed = forceGasUsed !== undefined ? forceGasUsed : Math.floor(Math.random() * 1000) + 100;

    if (Math.random() < 0.0) {
      throw new PVMExecutionError('Simulated PVM execution failed.');
    }

    return {
      output: simulatedOutput,
      gasUsed: simulatedGasUsed,
    };
  } catch (error: any) {
    throw new PVMExecutionError(`PVM simulation error: ${error.message}`);
  }
};

/**
 * Mocks historical lookup for dependencies.
 */
const historicalLookup = (
  dependencyHashes: string[],
  onchainState: OnchainState
): boolean => {
  console.log(`Performing historical lookup for dependencies: ${dependencyHashes.join(', ')}`);
  for (const depHash of dependencyHashes) {
    if (!onchainState.ξ.has(depHash) && !onchainState.ρ.has(depHash)) {
      console.warn(`Dependency ${depHash} not found in history or pending reports.`);
      return false;
    }
  }
  return true;
};

/**
 * Mocks authorization pool checks.
 */
const checkAuthorization = (
  authorizationToken: string,
  authServiceDetails: { h: string }
): boolean => {
  console.log(`Checking authorization for token: ${authorizationToken} via service: ${authServiceDetails.h}`);
  return true;
};

/**
 * The core Refine process (Ξ function).
 */
export const refineWorkPackage = async (
  workPackage: WorkPackage,
  refinementContext: RefinementContext,
  guarantorPrivateKey: Uint8Array,
  coreIndex: number,
  slot: number,
  dependencies: string[],
  onchainState: OnchainState,
  forceGasUsed?: number
): Promise<WorkReport> => {
  console.log("Starting refinement process...");

  // 1. Authorization Check
  if (!checkAuthorization(workPackage.authorizationToken, workPackage.authorizationServiceDetails)) {
    throw new AuthorizationError("Work-Package not authorized.");
  }

  // 2. Historical Lookup for Dependencies
  if (dependencies.length > 0 && !historicalLookup(dependencies, onchainState)) {
    throw new Error("One or more dependencies not found in historical state.");
  }

  // 3. Simulate V_R PVM Execution
  let pvmResult: PVMResult;
  try {
    pvmResult = simulateVRPVM(workPackage, refinementContext, forceGasUsed);
    console.log(`PVM executed. Output: ${pvmResult.output}, Gas Used: ${pvmResult.gasUsed}`);
  } catch (error: any) {
    throw new PVMExecutionError(`Failed to execute PVM: ${error.message}`);
  }

  // 4. Generate Availability Specification
  const availabilitySpec = encodeForAvailability(
    new WorkReport(
      workPackage,
      refinementContext,
      pvmResult.output,
      pvmResult.gasUsed,
      null,
      '',
      '',
      coreIndex,
      slot,
      dependencies
    ),
    4,
    2
  );
  console.log("Availability Specification generated.");

  // 5. Construct Work-Report (Preliminary)
  const guarantorPublicKey = publicKeyToBase64(guarantorPrivateKey.subarray(32));
  const preliminaryReport = new WorkReport(
    workPackage,
    refinementContext,
    pvmResult.output,
    pvmResult.gasUsed,
    availabilitySpec,
    '',
    guarantorPublicKey,
    coreIndex,
    slot,
    dependencies
  );

  // 6. Sign the Work-Report
  const signature = signMessage(preliminaryReport.toSignableObject(), guarantorPrivateKey);
  console.log("Work-Report signed.");

  // 7. Finalize Work-Report with Signature
  preliminaryReport.guarantorSignature = signature;

  console.log("Refinement process completed. Work-Report generated.");
  return preliminaryReport;
};
