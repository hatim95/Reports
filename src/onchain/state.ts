import { WorkReport } from '../models/WorkReport.ts';
import { WorkDigest } from '../models/WorkDigest.ts';

type PendingReportEntry = {
    report: WorkReport;
    receivedSignatures: Set<string>;
    submissionSlot: number;
};

type AccumulationEntry = {
    report: WorkReport;
    status: 'pending' | 'ready' | 'processing';
};

type BadReportEntry = {
    reason: string;
    disputedBy: Set<string>;
};

type OffenderEntry = {
    disputeCount: number;
    lastDisputeSlot: number;
};

type AccountState = {
    balance: number;
    [key: string]: any;
};

export type GlobalState = {
    accounts: Record<string, AccountState>;
    coreStatus: Map<number, string>;
    serviceRegistry: Map<string, Record<string, any>>;
};

export class OnchainState {
    ρ: Map<string, PendingReportEntry>;
    ω: Map<string, AccumulationEntry>;
    ξ: Map<string, WorkReport>;
    ψ_B: Map<string, BadReportEntry>;
    ψ_O: Map<string, OffenderEntry>;
    globalState: GlobalState;

    constructor() {
        this.ρ = new Map();
        this.ω = new Map();
        this.ξ = new Map();
        this.ψ_B = new Map();
        this.ψ_O = new Map();
        this.globalState = {
            accounts: {},
            coreStatus: new Map(),
            serviceRegistry: new Map(),
        };
    }

    /**
     * Resets the on-chain state to its initial empty condition.
     */
    reset(): void {
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
     * @param digestHash
     * @returns WorkReport | undefined
     */
    getReportByDigest(digestHash: string): WorkReport | undefined {
        if (this.ξ.has(digestHash)) {
            return this.ξ.get(digestHash);
        }
        if (this.ρ.has(digestHash)) {
            return this.ρ.get(digestHash)?.report;
        }
        if (this.ω.has(digestHash)) {
            return this.ω.get(digestHash)?.report;
        }
        return undefined;
    }

    /**
     * Converts the OnchainState to a plain object for deep comparison with test vectors.
     * @returns A plain JavaScript object representation of the state
     */
    toPlainObject(): object {
        const mapToObj = (map: Map<any, any>): Record<string, any> => {
            const obj: Record<string, any> = {};
            for (const [k, v] of map.entries()) {
                if (v instanceof Map) {
                    obj[k] = mapToObj(v);
                } else if (v instanceof Set) {
                    obj[k] = Array.from(v);
                } else if (typeof v === 'object' && v !== null && typeof v.toObject === 'function') {
                    obj[k] = v.toObject();
                } else if (typeof v === 'object' && v !== null) {
                    const nested: Record<string, any> = {};
                    for (const key in v) {
                        if (v[key] instanceof Set) {
                            nested[key] = Array.from(v[key]);
                        } else if (v[key] instanceof Map) {
                            nested[key] = mapToObj(v[key]);
                        } else if (typeof v[key] === 'object' && v[key] !== null && typeof v[key].toObject === 'function') {
                            nested[key] = v[key].toObject();
                        } else {
                            nested[key] = v[key];
                        }
                    }
                    obj[k] = nested;
                } else {
                    obj[k] = v;
                }
            }
            return obj;
        };

        // Fallbacks to ensure TS is satisfied and runtime is safe
        const globalState = this.globalState ?? {
            accounts: {},
            coreStatus: new Map(),
            serviceRegistry: new Map(),
        };

        return {
            ρ: mapToObj(this.ρ),
            ω: mapToObj(this.ω),
            ξ: mapToObj(this.ξ),
            ψ_B: mapToObj(this.ψ_B),
            ψ_O: mapToObj(this.ψ_O),
            globalState: {
                accounts: { ...(globalState.accounts ?? {}) },
                coreStatus: mapToObj(globalState.coreStatus ?? new Map()),
                serviceRegistry: mapToObj(globalState.serviceRegistry ?? new Map()),
            }
        };
    }
}
