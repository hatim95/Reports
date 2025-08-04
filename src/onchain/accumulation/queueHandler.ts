/**
 * Handles the accumulation queue (ω), including topological sorting (Q function)
 * and orchestrating the Ψ_A PVM execution and state integration.
 */

import { simulatePsiAPVM } from './pvmSimulator.ts';
import { applyDelta } from './stateIntegrator.ts';
import { WorkDigest } from '../../models/WorkDigest.ts';
import { WorkReport } from '../../models/WorkReport.ts';
import type { OnchainState, GlobalState } from '../state.ts';

// Types for the accumulation queue
interface AccumulationQueueEntry {
  report: WorkReport;
  status: 'pending' | 'ready' | 'processing';
}

type AccumulationQueue = Map<string, AccumulationQueueEntry>;

/**
 * Performs a topological sort on the accumulation queue (ω) to resolve dependencies.
 * This is the Q function.
 * @param accumulationQueue - The ω map.
 * @returns An array of WorkDigest hashes in topological order.
 */
export const topologicalSort = (accumulationQueue: AccumulationQueue): string[] => {
  console.log("[Q] Performing topological sort on accumulation queue...");

  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const reportsMap = new Map<string, WorkReport>();

  for (const [digestHash, entry] of accumulationQueue.entries()) {
    reportsMap.set(digestHash, entry.report);
    graph.set(digestHash, new Set());
    inDegree.set(digestHash, 0);
  }

  for (const [digestHash, entry] of accumulationQueue.entries()) {
    for (const depHash of entry.report.dependencies) {
      if (accumulationQueue.has(depHash)) {
        graph.get(depHash)?.add(digestHash);
        inDegree.set(digestHash, (inDegree.get(digestHash) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [digestHash, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(digestHash);
    }
  }

  const sortedOrder: string[] = [];
  let head = 0;
  while (head < queue.length) {
    const currentDigest = queue[head++]!;
    sortedOrder.push(currentDigest);

    const neighbors = graph.get(currentDigest) || new Set();
    for (const neighborDigest of neighbors) {
      const updatedDegree = (inDegree.get(neighborDigest) ?? 0) - 1;
      inDegree.set(neighborDigest, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(neighborDigest);
      }
    }
  }

  if (sortedOrder.length !== accumulationQueue.size) {
    console.warn("[Q] Cyclic dependency detected or unresolved dependencies.");
  }

  console.log("[Q] Topological sort completed. Order:", sortedOrder);
  return sortedOrder;
};

/**
 * Processes the accumulation queue, executing Work-Items and updating global state.
 * @param onchainState - The current on-chain state.
 * @param currentSlot - The current block slot.
 */
export const processAccumulationQueue = (onchainState: OnchainState, currentSlot: number): void => {
  console.log(`[Accumulation] Processing accumulation queue (ω) at slot ${currentSlot}...`);

  const reportsToAccumulateDigests = topologicalSort(onchainState.ω);

  for (const digestHash of reportsToAccumulateDigests) {
    const entry = onchainState.ω.get(digestHash);

    if (!entry || entry.status !== 'ready') continue;

    const report = entry.report;
    console.log(`[Accumulation] Accumulating report ${digestHash} (Core: ${report.coreIndex})...`);

    // Update status
    entry.status = 'processing';
    onchainState.ω.set(digestHash, entry);

    try {
      for (const workItem of report.workPackage.workItems) {
        const stateDelta = simulatePsiAPVM(workItem, onchainState.globalState);

        // ✅ Ensure applyDelta returns a valid GlobalState
        const updatedState = applyDelta(onchainState.globalState, stateDelta) as GlobalState;
        onchainState.globalState = {
          accounts: updatedState.accounts || {},
          coreStatus: updatedState.coreStatus || new Map(),
          serviceRegistry: updatedState.serviceRegistry || new Map(),
        };
      }

      // Move report to ξ
      onchainState.ω.delete(digestHash);
      onchainState.ξ.set(digestHash, report);
      console.log(`[Accumulation] Report ${digestHash} accumulated and moved to ξ.`);

    } catch (error: any) {
      console.error(`[Accumulation] Failed to accumulate report ${digestHash}: ${error.message}`);

      onchainState.ω.delete(digestHash);
      onchainState.ψ_B.set(digestHash, {
        reason: `accumulation_failed: ${error.message}`,
        disputedBy: new Set(['system_accumulation']),
      });

      const key = report.guarantorPublicKey;
      const offender = onchainState.ψ_O.get(key);
      if (offender) {
        offender.disputeCount++;
        offender.lastDisputeSlot = currentSlot;
      } else {
        onchainState.ψ_O.set(key, {
          disputeCount: 1,
          lastDisputeSlot: currentSlot,
        });
      }
    }
  }

  console.log("[Accumulation] Accumulation queue processing finished.");
};
