/**
 * Represents a Work-Item (W) within a Work-Package.
 * Formally defined in Section 14.3 of the graypaper.
 */
// Re-using WorkItem from Phase 1
import { validateRequired, validateType } from '../utils/validator.js';

export class WorkItem {
    /**
     * @param {string} id - Unique identifier for the work item.
     * @param {string} programHash - Hash of the program to be executed.
     * @param {string} inputData - Input data for the program.
     * @param {number} gasLimit - Maximum gas allowed for execution.
     */
    constructor(id, programHash, inputData, gasLimit) {
        validateRequired(id, 'WorkItem ID');
        validateType(id, 'WorkItem ID', 'string');
        validateRequired(programHash, 'WorkItem Program Hash');
        validateType(programHash, 'WorkItem Program Hash', 'string');
        validateRequired(inputData, 'WorkItem Input Data');
        validateType(inputData, 'WorkItem Input Data', 'string');
        validateRequired(gasLimit, 'WorkItem Gas Limit');
        validateType(gasLimit, 'WorkItem Gas Limit', 'number');
        if (gasLimit <= 0) {
            throw new Error('Gas limit must be positive.');
        }

        this.id = id;
        this.programHash = programHash;
        this.inputData = inputData;
        this.gasLimit = gasLimit;
    }

    /**
     * Converts the WorkItem to a plain object for serialization.
     * @returns {object}
     */
    toObject() {
        return {
            id: this.id,
            programHash: this.programHash,
            inputData: this.inputData,
            gasLimit: this.gasLimit,
        };
    }
}