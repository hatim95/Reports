/**
 * Represents the Refinement Context (C) provided to the PVM.
 * Contains information about the current state of the blockchain.
 */
// Re-using RefinementContext from Phase 1
import { validateRequired, validateType } from '../utils/validator.js';

export class RefinementContext {
    /**
     * @param {string} anchorBlockRoot - The state root of the anchor block.
     * @param {number} anchorBlockNumber - The block number of the anchor block.
     * @param {string} beefyMmrRoot - The Beefy MMR root at the anchor block.
     * @param {number} currentSlot - The current block slot number.
     * @param {number} currentEpoch - The current epoch number.
     * @param {string[]} currentGuarantors - List of current guarantor public keys (base64).
     * @param {string[]} previousGuarantors - List of previous guarantor public keys (base64).
     */
    constructor(anchorBlockRoot, anchorBlockNumber, beefyMmrRoot, currentSlot, currentEpoch, currentGuarantors, previousGuarantors) {
        validateRequired(anchorBlockRoot, 'Anchor Block Root');
        validateType(anchorBlockRoot, 'Anchor Block Root', 'string');
        validateRequired(anchorBlockNumber, 'Anchor Block Number');
        validateType(anchorBlockNumber, 'Anchor Block Number', 'number');
        validateRequired(beefyMmrRoot, 'Beefy MMR Root');
        validateType(beefyMmrRoot, 'Beefy MMR Root', 'string');
        validateRequired(currentSlot, 'Current Slot');
        validateType(currentSlot, 'Current Slot', 'number');
        validateRequired(currentEpoch, 'Current Epoch');
        validateType(currentEpoch, 'Current Epoch', 'number');
        validateRequired(currentGuarantors, 'Current Guarantors');
        if (!Array.isArray(currentGuarantors) || !currentGuarantors.every(g => typeof g === 'string')) {
            throw new Error('Current Guarantors must be an array of strings.');
        }
        validateRequired(previousGuarantors, 'Previous Guarantors');
        if (!Array.isArray(previousGuarantors) || !previousGuarantors.every(g => typeof g === 'string')) {
            throw new Error('Previous Guarantors must be an array of strings.');
        }

        this.anchorBlockRoot = anchorBlockRoot;
        this.anchorBlockNumber = anchorBlockNumber;
        this.beefyMmrRoot = beefyMmrRoot;
        this.currentSlot = currentSlot;
        this.currentEpoch = currentEpoch;
        this.currentGuarantors = currentGuarantors;
        this.previousGuarantors = previousGuarantors;
    }

    /**
     * Converts the RefinementContext to a plain object for serialization.
     * @returns {object}
     */
    toObject() {
        return {
            anchorBlockRoot: this.anchorBlockRoot,
            anchorBlockNumber: this.anchorBlockNumber,
            beefyMmrRoot: this.beefyMmrRoot,
            currentSlot: this.currentSlot,
            currentEpoch: this.currentEpoch,
            currentGuarantors: this.currentGuarantors,
            previousGuarantors: this.previousGuarantors,
        };
    }
}