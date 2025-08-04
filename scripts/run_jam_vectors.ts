// --- scripts/run-vectors.ts ---
// Requires Node.js v14+ with ES module + TS support (e.g., via tsx or ts-node)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkReport } from '../src/models/WorkReport.ts';
import { WorkPackage } from '../src/models/WorkPackage.ts';
import { WorkItem } from '../src/models/WorkItem.ts';
import { RefinementContext } from '../src/models/RefinementContext.ts';
import { AvailabilitySpec } from '../src/models/AvailabilitySpec.ts';
import { OnchainState, processGuaranteeExtrinsic as realProcessGuaranteeExtrinsic } from '../src/onchain/index.ts';

function hydrateMap(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(hydrateMap);
    if (typeof obj === 'object') {
        if (obj._isSet) return new Set(obj.values.map(hydrateMap));
        if (obj._isMap) return new Map(obj.entries.map(([k, v]: [string, any]) => [k, hydrateMap(v)]));
        if (Object.keys(obj).length && Object.keys(obj).every(k => isNaN(Number(k)))) {
            return new Map(Object.entries(obj).map(([k, v]) => [k, hydrateMap(v)]));
        }
        const out: any = {};
        for (const k in obj) out[k] = hydrateMap(obj[k]);
        return out;
    }
    return obj;
}

function initializeState(preState: any): OnchainState {
    const state = new OnchainState();
    if (preState) {
        if (preState.ρ) state.ρ = hydrateMap(preState.ρ);
        if (preState.ω) state.ω = hydrateMap(preState.ω);
        if (preState.ξ) state.ξ = hydrateMap(preState.ξ);
        if (preState.ψ_B) state.ψ_B = hydrateMap(preState.ψ_B);
        if (preState.ψ_O) state.ψ_O = hydrateMap(preState.ψ_O);
        if (preState.globalState) {
            state.globalState = {
                accounts: preState.globalState.accounts || {},
                coreStatus: hydrateMap(preState.globalState.coreStatus || {}),
                serviceRegistry: hydrateMap(preState.globalState.serviceRegistry || {}),
            };
        }
    }
    return state;
}

function processGuaranteeExtrinsic(
    extrinsic: any,
    state: OnchainState,
    slot: number,
    expectedError?: string,
    postState?: any
): void {
    const report = extrinsic.guarantees[0].report;
    let error: string | null = null;
    try {
        realProcessGuaranteeExtrinsic(report, state, slot);
    } catch (e: any) {
        error = e.message;
        if (!expectedError || (error !== null && error.includes(expectedError))) {
            throw e;
        }
        throw e;
    }
}

function deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function loadVector(filepath: string): any {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function compareStates(state: OnchainState, postState: any): boolean {
    const expectedState = initializeState(postState).toPlainObject();
    const finalState = state.toPlainObject();
    return deepEqual(finalState, expectedState);
}

function mapInputToExtrinsic(input: any): any {
    const extrinsic = JSON.parse(JSON.stringify(input));
    for (const guarantee of extrinsic.guarantees) {
        const r = guarantee.report;
        guarantee.report = new WorkReport(
            new WorkPackage(
                r.workPackage.authorizationToken,
                r.workPackage.authorizationServiceDetails,
                r.workPackage.context,
                r.workPackage.workItems.map((wi: any) =>
                    new WorkItem(wi.id, wi.programHash, wi.inputData, wi.gasLimit)
                )
            ),
            new RefinementContext(
                r.refinementContext.anchorBlockRoot,
                r.refinementContext.anchorBlockNumber,
                r.refinementContext.beefyMmrRoot,
                r.refinementContext.currentSlot,
                r.refinementContext.currentEpoch,
                r.refinementContext.currentGuarantors,
                r.refinementContext.previousGuarantors
            ),
            r.pvmOutput,
            r.gasUsed,
            r.availabilitySpec
                ? new AvailabilitySpec(
                    r.availabilitySpec.totalFragments,
                    r.availabilitySpec.dataFragments,
                    r.availabilitySpec.fragmentHashes
                )
                : null,
            r.guarantorSignature,
            r.guarantorPublicKey,
            r.coreIndex,
            r.slot,
            r.dependencies
        );
    }
    return extrinsic;
}

function runVector(vectorPath: string): void {
    try {
        const vector = loadVector(vectorPath);
        if (!vector || !vector.pre_state) {
            console.error(`${path.basename(vectorPath)}: FAIL (Invalid vector, missing 'pre_state')`);
            return;
        }

        const state = initializeState(vector.pre_state);
        let error: string | null = null;


        try {
            let slot = 0;
            if (vector.input?.guarantees?.[0]?.report?.context?.lookup_anchor_slot) {
                slot = vector.input.guarantees[0].report.context.lookup_anchor_slot + 65;
            }
            processGuaranteeExtrinsic(
                mapInputToExtrinsic(vector.input),
                state,
                slot,
                vector.expected_error,
                vector.post_state
            );
        } catch (e: any) {
            error = e.message;
        }

        if (vector.expected_error) {
            if (error && error.includes(vector.expected_error)) {
                console.log(`${path.basename(vectorPath)}: PASS (expected error)`);
            } else {
                console.log(`${path.basename(vectorPath)}: FAIL (unexpected error/result)`);
                if (error) console.error(`  -> Threw: ${error}`);
                else console.error(`  -> Expected error '${vector.expected_error}', but none thrown.`);
            }
        } else {
            if (compareStates(state, vector.post_state)) {
                console.log(`${path.basename(vectorPath)}: PASS`);
            } else {
                console.log(`${path.basename(vectorPath)}: FAIL (state mismatch)`);
                console.error(`  -> Final state does not match expected post-state.`);
            }
        }
    } catch (e: any) {
        console.error(`${path.basename(vectorPath)}: FAIL (Error: ${e.message})`);
    }
}

function inspectVector(vectorPath: string): void {
    try {
        const vector = loadVector(vectorPath);
        console.log(`--- Inspection of ${path.basename(vectorPath)} ---`);
        console.log(`File exists: true`);
        console.log(`Vector content:`);
        console.log(JSON.stringify(vector, null, 2));
        console.log(`Has 'pre_state': ${'pre_state' in vector}`);
        console.log(`Has 'input': ${'input' in vector}`);
        console.log(`Has 'post_state': ${'post_state' in vector}`);
        console.log(`Has 'expected_error': ${'expected_error' in vector}`);
    } catch (e: any) {
        console.error(`Error inspecting file: ${e.message}`);
    }
}

const args = process.argv.slice(2);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (args.length > 0) {
    const filePath = path.resolve(process.cwd(), args[0]);
    inspectVector(filePath);
} else {
    const vectorDirs = [
        path.join(__dirname, '../jam-test-vectors/stf/reports/tiny'),
        path.join(__dirname, '../jam-test-vectors/stf/reports/full')
    ];

    console.log('Running JAM Reports Test Vectors...');
    console.log('-----------------------------------');

    for (const dir of vectorDirs) {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    runVector(path.join(dir, file));
                }
            }
        } catch (e: any) {
            console.error(`Error processing directory ${dir}: ${e.message}`);
        }
    }

    console.log('-----------------------------------');
    console.log('Test run complete.');
}
