/**
 * Represents the in-memory on-chain state for the JAM Reports Component.
 */
import { WorkReport } from '../models/WorkReport.js';
import { WorkDigest } from '../models/WorkDigest.js';

export class OnchainState {
    constructor() {
        /**
         * @property {Map<string, {report: WorkReport, receivedSignatures: Set<string>, submissionSlot: number}>} ρ - Pending reports.
         * Key: WorkDigest hash. Value: Object containing the report, unique guarantor public keys that signed it, and submission slot.
         */
        this.ρ = new Map();

        /**
         * @property {Map<string, {report: WorkReport, status: 'pending' | 'ready' | 'processing'}>} ω - Accumulation queue.
         * Key: WorkDigest hash. Value: Object containing the report and its accumulation status.
         */
        this.ω = new Map();

        /**
         * @property {Map<string, WorkReport>} ξ - History of finalized (accumulated) reports.
         * Key: WorkDigest hash. Value: The finalized WorkReport.
         */
        this.ξ = new Map();

        /**
         * @property {Map<string, {reason: string, disputedBy: Set<string>}>} ψ_B - Bad reports.
         * Key: WorkDigest hash. Value: Reason for being bad and set of disputer public keys.
         */
        this.ψ_B = new Map();

        /**
         * @property {Map<string, {disputeCount: number, lastDisputeSlot: number}>} ψ_O - Offenders (guarantors who submitted bad reports).
         * Key: Guarantor public key (base64). Value: Dispute count and last dispute slot.
         */
        this.ψ_O = new Map();

        /**
         * @property {object} globalState - A conceptual representation of the global blockchain state.
         * This would be mutated by accumulated Work-Items.
         */
        this.globalState = {
            accounts: {}, // Example: { '0xabc': { balance: 100, data: '...' } }
            coreStatus: new Map(), // Example: { 0: 'available', 1: 'engaged' }
            serviceRegistry: new Map(), // Example: { 'serviceId1': { codeHash: '0xcode', owner: '0xowner' } }
            // Add other relevant global state components as needed for PVM simulation
        };
    }

    /**
     * Resets the on-chain state to its initial empty condition.
     */
    reset() {
        this.ρ.clear();
        this.ω.clear();
        this.ξ.clear();
        this.ψ_B.clear();
        this.ψ_O.clear();
        this.globalState = {
            accounts: {},
            coreStatus: new Map(),
            serviceRegistry: new Map(),
        };
    }

    /**
     * Helper to get a report from any relevant state map for dependency checking.
     * @param {string} digestHash
     * @returns {WorkReport|undefined}
     */
    getReportByDigest(digestHash) {
        if (this.ξ.has(digestHash)) {
            return this.ξ.get(digestHash);
        }
        if (this.ρ.has(digestHash)) {
            return this.ρ.get(digestHash).report;
        }
        if (this.ω.has(digestHash)) {
            return this.ω.get(digestHash).report;
        }
        return undefined;
    }
    /**
    * Converts the OnchainState to a plain object for deep comparison with test vectors.
    * @returns {object}
    */
    toPlainObject() {
        // Helper to convert Map to object recursively
        const mapToObj = (map) => {
            const obj = {};
            for (const [k, v] of map.entries()) {
                if (v instanceof Map) {
                    obj[k] = mapToObj(v);
                } else if (v instanceof Set) {
                    obj[k] = Array.from(v);
                } else if (typeof v === 'object' && v !== null && typeof v.toObject === 'function') {
                    obj[k] = v.toObject();
                } else if (typeof v === 'object' && v !== null) {
                    // Recursively handle nested objects
                    obj[k] = {};
                    for (const key in v) {
                        if (v[key] instanceof Set) {
                            obj[k][key] = Array.from(v[key]);
                        } else if (v[key] instanceof Map) {
                            obj[k][key] = mapToObj(v[key]);
                        } else if (typeof v[key] === 'object' && v[key] !== null && typeof v[key].toObject === 'function') {
                            obj[k][key] = v[key].toObject();
                        } else {
                            obj[k][key] = v[key];
                        }
                    }
                } else {
                    obj[k] = v;
                }
            }
            return obj;
        };

        return {
            ρ: mapToObj(this.ρ),
            ω: mapToObj(this.ω),
            ξ: mapToObj(this.ξ),
            ψ_B: mapToObj(this.ψ_B),
            ψ_O: mapToObj(this.ψ_O),
            globalState: {
                accounts: { ...this.globalState.accounts },
                coreStatus: mapToObj(this.globalState.coreStatus),
                serviceRegistry: mapToObj(this.globalState.serviceRegistry),
            }
        };
    }
}