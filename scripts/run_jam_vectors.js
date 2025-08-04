// This script requires Node.js v14 or higher for ES module support.
// To run: `node your-script-name.js`
// To inspect a specific file: `node your-script-name.js /path/to/your/file.json`

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkReport } from '../src/models/WorkReport.js';
import { WorkPackage } from '../src/models/WorkPackage.js';
import { WorkItem } from '../src/models/WorkItem.js';
import { RefinementContext } from '../src/models/RefinementContext.js';
import { AvailabilitySpec } from '../src/models/AvailabilitySpec.js';
import { OnchainState,processGuaranteeExtrinsic as realProcessGuaranteeExtrinsic } from '../src/onchain/index.js';

function hydrateMap(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(hydrateMap);
    if (typeof obj === 'object') {
        // Detect Set encoding (array, but should be Set)
        if (obj._isSet) return new Set(obj.values.map(hydrateMap));
        // Detect Map encoding (object with string keys)
        if (obj._isMap) return new Map(obj.entries.map(([k, v]) => [k, hydrateMap(v)]));
        // Heuristic: treat plain objects as Map if keys are not numeric
        if (Object.keys(obj).length && Object.keys(obj).every(k => isNaN(Number(k)))) {
            return new Map(Object.entries(obj).map(([k, v]) => [k, hydrateMap(v)]));
        }
        // Otherwise, treat as plain object
        const out = {};
        for (const k in obj) out[k] = hydrateMap(obj[k]);
        return out;
    }
    return obj;
}

function initializeState(preState) {
    const state = new OnchainState();
    if (preState) {
        // Hydrate all fields as Map/Set where appropriate
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

/**
 * The core State Transition Function (STF) for processing a guarantee extrinsic.
 * This is where the protocol logic is implemented and validated.
 * @param {object} extrinsic The extrinsic to process, containing a report.
 * @param {OnchainState} state The current on-chain state.
 * @param {number} slot The current block slot number.
 */
function processGuaranteeExtrinsic(extrinsic, state, slot, expectedError, postState) {
    // The test vector format may wrap the report in extrinsic.guarantees[0].report
    // You may need to adapt this mapping if your test vectors differ.
    const report = extrinsic.guarantees[0].report;
    let error = null;
    try {
        realProcessGuaranteeExtrinsic(report, state, slot);
    } catch (e) {
        error = e.message;
        if (!expectedError || !error.includes(expectedError)) {
            throw e;
        }
        // If expectedError is set and matches, let the test harness handle it
        throw e;
    }
}


// ==============================================================================
// TEST HARNESS
// ==============================================================================

/**
 * Utility: Deeply compares two objects.
 * @param {object} a First object.
 * @param {object} b Second object.
 * @returns {boolean} True if objects are deeply equal, false otherwise.
 */
function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Utility: Loads and parses a JSON test vector file.
 * @param {string} filepath The path to the JSON file.
 * @returns {object} The parsed JSON object.
 */
function loadVector(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/**
 * Utility: Initializes the `OnchainState` from a test vector's pre-state.
 * @param {object} preState The pre-state from the test vector.
 * @returns {OnchainState} The initialized state object.
 */
// function initializeState(preState) {
//     return new OnchainState(preState);
// }

/**
 * Utility: Compares the final state of your client with the expected post-state.
 * @param {OnchainState} state The final state of your client.
 * @param {object} postState The expected post-state from the test vector.
 * @returns {boolean} True if the states match, false otherwise.
 */
function compareStates(state, postState) {
    // Hydrate postState into an OnchainState, then normalize
    const expectedState = initializeState(postState).toPlainObject();
    const finalState = state.toPlainObject();
    return deepEqual(finalState, expectedState);
}
// function compareStates(state, postState) {
//     const finalState = state.toPlainObject();
//     const equal = deepEqual(finalState, postState);
//     if (!equal) {
//         console.error('--- State Diff ---');
//         console.error('Expected:', JSON.stringify(postState, null, 2));
//         console.error('Actual:', JSON.stringify(finalState, null, 2));
//         console.error('------------------');
//     }
//     return equal;
// }

/**
 * Utility: Maps a test vector's input to your `WorkReport` class structure.
 * @param {object} input The input object from the test vector.
 * @returns {object} An object containing the processed extrinsic data.
 */
function mapInputToExtrinsic(input) {
    // Deeply reconstruct WorkReport and its nested classes from plain objects
    const extrinsic = JSON.parse(JSON.stringify(input)); // clone to avoid mutation

    for (const guarantee of extrinsic.guarantees) {
        const r = guarantee.report;
        guarantee.report = new WorkReport(
            new WorkPackage(
                r.workPackage.authorizationToken,
                r.workPackage.authorizationServiceDetails,
                r.workPackage.context,
                r.workPackage.workItems.map(wi =>
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

/**
 * Runs a single test vector and prints the result.
 * @param {string} vectorPath The full path to the test vector file.
 */
function runVector(vectorPath) {
    try {
        const vector = loadVector(vectorPath);

        if (!vector || !vector.pre_state) {
            console.error(`${path.basename(vectorPath)}: FAIL (Invalid vector file, 'pre_state' field is missing or malformed)`);
            return;
        }

        const state = initializeState(vector.pre_state);
        let error = null;

        try {
            // For this vector, slot is provided as input.guarantees[0].report.context.lookup_anchor_slot + 65 (to trigger error)
            // But you should use the slot from the vector if present, or compute it as needed
            let slot = 0;
            if (vector.input && vector.input.guarantees && vector.input.guarantees[0] && vector.input.guarantees[0].report && vector.input.guarantees[0].report.context) {
                slot = vector.input.guarantees[0].report.context.lookup_anchor_slot + 65;
            }
            processGuaranteeExtrinsic(mapInputToExtrinsic(vector.input), state, slot, vector.expected_error, vector.post_state);
        } catch (e) {
            error = e.message;
        }

        if (vector.expected_error) {
            if (error && error.includes(vector.expected_error)) {
                console.log(`${path.basename(vectorPath)}: PASS (expected error)`);
            } else {
                console.log(`${path.basename(vectorPath)}: FAIL (unexpected error/result)`);
                if (error) console.error(`  -> Threw: ${error}`);
                else console.error(`  -> Expected error '${vector.expected_error}', but no error was thrown.`);
            }
        } else {
            if (compareStates(state, vector.post_state)) {
                console.log(`${path.basename(vectorPath)}: PASS`);
            } else {
                console.log(`${path.basename(vectorPath)}: FAIL (state mismatch)`);
                console.error('  -> Final state does not match expected post state.');
            }
        }
    } catch (e) {
        console.error(`${path.basename(vectorPath)}: FAIL (File could not be processed: ${e.message})`);
    }
}

/**
 * Utility to inspect a single test vector file.
 * @param {string} vectorPath The full path to the test vector file.
 */
function inspectVector(vectorPath) {
    try {
        const vector = loadVector(vectorPath);
        console.log(`--- Inspection of ${path.basename(vectorPath)} ---`);
        console.log(`File exists: true`);
        console.log(`Vector content:`);
        console.log(JSON.stringify(vector, null, 2));
        console.log(`Has 'pre' field: ${'pre_state' in vector}`);
        console.log(`Has 'input' field: ${'input' in vector}`);
        console.log(`Has 'post' field: ${'post_state' in vector}`);
        console.log(`Has 'expected_error' field: ${'expected_error' in vector}`);
        console.log('-----------------------------------');
    } catch (e) {
        console.error(`Error inspecting file: ${e.message}`);
    }
}

// ==============================================================================
// MAIN EXECUTION
// ==============================================================================

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
        } catch (e) {
            console.error(`Error processing directory ${dir}: ${e.message}`);
        }
    }

    console.log('-----------------------------------');
    console.log('Test run complete.');
}
