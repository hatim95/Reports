/**
 * Represents a Work-Item (W) within a Work-Package.
 * Formally defined in Section 14.3 of the graypaper.
 */
import { validateRequired, validateType } from '../utils/validator.ts';

export class WorkItem {
    public id: string;
    public programHash: string;
    public inputData: string;
    public gasLimit: number;

    /**
     * @param {string} id - The ID of the Work-Item.
     * @param {string} programHash - The program hash of the Work-Item.
     * @param {string} inputData - The input data of the Work-Item.
     * @param {number} gasLimit - The gas limit of the Work-Item.
     */
    constructor(id: string, programHash: string, inputData: string, gasLimit: number) {
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
    toObject(): { id: string, programHash: string, inputData: string, gasLimit: number } {
        return {
            id: this.id,
            programHash: this.programHash,
            inputData: this.inputData,
            gasLimit: this.gasLimit,
        };
    }
}