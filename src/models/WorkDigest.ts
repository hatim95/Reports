/**
 * Represents a Work-Digest (D), a cryptographic digest of the Work-Report.
 * Used for uniqueness and efficient lookup.
 */
import { validateRequired, validateType } from '../utils/validator.ts';

export class WorkDigest {
    public hash: string;

    /**
     * @param {string} hash - The cryptographic hash of the Work-Report.
     */
    constructor(hash: string) {
        validateRequired(hash, 'WorkDigest Hash');
        validateType(hash, 'WorkDigest Hash', 'string');
        // Basic hash format validation (e.g., hex string, specific length) could be added here
        if (!/^[0-9a-fA-F]{64}$/.test(hash)) { // Example: SHA256 hex string
            // console.warn('WorkDigest hash format may be invalid. Expected 64-char hex string.');
        }

        this.hash = hash;
    }

    /**
     * Converts the WorkDigest to a plain object for serialization.
     * @returns {object}
     */
    toObject(): { hash: string } {
        return {
            hash: this.hash,
        };
    }
}