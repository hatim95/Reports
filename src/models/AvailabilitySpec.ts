/**
 * Represents the Availability Specification (Y) for a Work-Report.
 * Defines how the report data is packaged for availability.
 */
import { validateRequired, validateType } from '../utils/validator.ts';

export class AvailabilitySpec {
    totalFragments: number;
    dataFragments: number;
    fragmentHashes: string[];

    constructor(
        totalFragments: number,
        dataFragments: number,
        fragmentHashes: string[]
    ) {
        validateRequired(totalFragments, 'Total Fragments');
        validateType(totalFragments, 'Total Fragments', 'number');
        if (totalFragments <= 0) throw new Error('Total fragments must be positive.');

        validateRequired(dataFragments, 'Data Fragments');
        validateType(dataFragments, 'Data Fragments', 'number');
        if (dataFragments <= 0 || dataFragments > totalFragments) throw new Error('Data fragments must be positive and less than or equal to total fragments.');

        validateRequired(fragmentHashes, 'Fragment Hashes');
        if (!Array.isArray(fragmentHashes) || fragmentHashes.length !== totalFragments || !fragmentHashes.every(h => typeof h === 'string')) {
            throw new Error('Fragment Hashes must be an array of strings matching totalFragments length.');
        }

        this.totalFragments = totalFragments;
        this.dataFragments = dataFragments;
        this.fragmentHashes = fragmentHashes;
    }

    /**
     * Converts the AvailabilitySpec to a plain object for serialization.
     * @returns {object}
     */
    toObject(): object {
        return {
            totalFragments: this.totalFragments,
            dataFragments: this.dataFragments,
            fragmentHashes: this.fragmentHashes,
        };
    }
}