/**
 * Handles Reed-Solomon erasure coding for data packaging and availability specification.
 * This is a simplified mock/conceptual outline. A full implementation would involve
 * a dedicated Reed-Solomon library.
 */

import { AvailabilitySpec } from '../models/AvailabilitySpec.ts';
import { WorkReport } from '../models/WorkReport.ts';
import { WorkDigest } from '../models/WorkDigest.ts';
import { sha256 } from 'js-sha256';

/**
 * Mocks the Reed-Solomon encoding process.
 * In a real scenario, this would take the report data, split it into
 * data fragments, generate parity fragments, and return hashes of all fragments.
 * @param report - The WorkReport to encode.
 * @param dataFragments - The desired number of data fragments.
 * @param parityFragments - The desired number of parity fragments.
 * @returns AvailabilitySpec
 */
export const encodeForAvailability = (
    report: WorkReport,
    dataFragments: number = 4,
    parityFragments: number = 2
): AvailabilitySpec => {
    const totalFragments = dataFragments + parityFragments;
    const reportString = JSON.stringify(report.toSignableObject());

    const fragmentHashes: string[] = [];
    for (let i = 0; i < totalFragments; i++) {
        const fragmentContent = reportString.substring(i * 10, (i + 1) * 10) + `_fragment_${i}`;
        fragmentHashes.push(sha256(fragmentContent));
    }

    return new AvailabilitySpec(totalFragments, dataFragments, fragmentHashes);
};

/**
 * Generates a WorkDigest for a given WorkReport.
 * @param report - The WorkReport to generate a digest for.
 * @returns WorkDigest
 */
export const generateWorkDigest = (report: WorkReport): WorkDigest => {
    const reportString = JSON.stringify(report.toSignableObject());
    const digestHash = sha256(reportString);
    return new WorkDigest(digestHash);
};
