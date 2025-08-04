/**
 * Handles the accumulation queue (ω), including topological sorting (Q function)
 * and orchestrating the Ψ_A PVM execution and state integration.
 */
import { simulatePsiAPVM } from './pvmSimulator.js';
import { applyDelta } from './stateIntegrator.js';
import { WorkDigest } from '../../models/WorkDigest.js';

/**
 * Performs a topological sort on the accumulation queue (ω) to resolve dependencies.
 * This is the Q function.
 * @param {Map<string, {report: import('../../models/WorkReport').WorkReport, status: string}>} accumulationQueue - The ω map.
 * @returns {string[]} An array of WorkDigest hashes in topological order.
 */
export const topologicalSort = (accumulationQueue) => {
    console.log("[Q] Performing topological sort on accumulation queue...");
    const graph = new Map(); // Map: digestHash -> Set<dependentDigestHashes>
    const inDegree = new Map(); // Map: digestHash -> count of incoming dependencies
    const reportsMap = new Map(); // Map: digestHash -> report object

    // Initialize graph and in-degrees
    for (const [digestHash, entry] of accumulationQueue.entries()) {
        reportsMap.set(digestHash, entry.report);
        graph.set(digestHash, new Set());
        inDegree.set(digestHash, 0);
    }

    // Build graph and calculate in-degrees
    for (const [digestHash, entry] of accumulationQueue.entries()) {
        for (const depHash of entry.report.dependencies) {
            // Only consider dependencies that are also in the current queue
            if (accumulationQueue.has(depHash)) {
                graph.get(depHash).add(digestHash);
                inDegree.set(digestHash, inDegree.get(digestHash) + 1);
            }
        }
    }

    // Find all nodes with in-degree 0 (no dependencies within the queue)
    const queue = [];
    for (const [digestHash, degree] of inDegree.entries()) {
        if (degree === 0) {
            queue.push(digestHash);
        }
    }

    const sortedOrder = [];
    let head = 0;
    while (head < queue.length) {
        const currentDigest = queue[head++];
        sortedOrder.push(currentDigest);

        // For each neighbor (report that depends on currentDigest)
        for (const neighborDigest of graph.get(currentDigest)) {
            inDegree.set(neighborDigest, inDegree.get(neighborDigest) - 1);
            if (inDegree.get(neighborDigest) === 0) {
                queue.push(neighborDigest);
            }
        }
    }

    if (sortedOrder.length !== accumulationQueue.size) {
        console.warn("[Q] Cyclic dependency detected or some reports cannot be accumulated due to unresolved dependencies within the queue.");
        // In a real system, this might lead to some reports being rejected or put into a 'stuck' state.
        // For this simulation, we'll return what we could sort.
    }

    console.log("[Q] Topological sort completed. Order:", sortedOrder);
    return sortedOrder;
};

/**
 * Processes the accumulation queue, executing Work-Items and updating global state.
 * @param {import('../state').OnchainState} onchainState - The current on-chain state.
 * @param {number} currentSlot - The current block slot.
 */
export const processAccumulationQueue = (onchainState, currentSlot) => {
    console.log(`[Accumulation] Processing accumulation queue (ω) at slot ${currentSlot}...`);

    // Get reports ready for accumulation in topological order
    const reportsToAccumulateDigests = topologicalSort(onchainState.ω);

    for (const digestHash of reportsToAccumulateDigests) {
        const entry = onchainState.ω.get(digestHash);
        if (!entry || entry.status !== 'ready') {
            // This can happen if topologicalSort returned a report that wasn't 'ready'
            // or if it was removed by a dispute during the same block processing.
            continue;
        }

        const report = entry.report;
        console.log(`[Accumulation] Accumulating report ${digestHash} (Core: ${report.coreIndex})...`);

        // Update status to processing
        entry.status = 'processing';
        onchainState.ω.set(digestHash, entry);

        // Simulate Ψ_A PVM invocation for each Work-Item in the report
        try {
            for (const workItem of report.workPackage.workItems) {
                const stateDelta = simulatePsiAPVM(workItem, onchainState.globalState);
                // Apply Δ, Δ+ functions for optimized state integration
                onchainState.globalState = applyDelta(onchainState.globalState, stateDelta);
            }

            // Move report from ω to ξ (history)
            onchainState.ω.delete(digestHash);
            onchainState.ξ.set(digestHash, report);
            console.log(`[Accumulation] Report ${digestHash} successfully accumulated and moved to history (ξ).`);

        } catch (error) {
            console.error(`[Accumulation] Failed to accumulate report ${digestHash}: ${error.message}`);
            // If accumulation fails (e.g., PVM error), move to bad reports (ψ_B)
            onchainState.ω.delete(digestHash);
            onchainState.ψ_B.set(digestHash, { reason: `accumulation_failed: ${error.message}`, disputedBy: new Set(['system_accumulation']) });
            // Penalize guarantor
            const guarantorPublicKey = report.guarantorPublicKey;
            const offenderRecord = onchainState.ψ_O.get(guarantorPublicKey);
            if (offenderRecord) {
                offenderRecord.disputeCount++;
                offenderRecord.lastDisputeSlot = currentSlot;
            } else {
                onchainState.ψ_O.set(guarantorPublicKey, { disputeCount: 1, lastDisputeSlot: currentSlot });
            }
        }
    }
    console.log("[Accumulation] Accumulation queue processing finished.");
};