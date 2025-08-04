/**
 * Represents the Refinement Context (C) provided to the PVM.
 * Contains information about the current state of the blockchain.
 */
import { validateRequired, validateType } from '../utils/validator.ts';

export class RefinementContext {
    anchorBlockRoot: string;
    anchorBlockNumber: number;
    beefyMmrRoot: string;
    currentSlot: number;
    currentEpoch: number;
    currentGuarantors: string[];
    previousGuarantors: string[];

    constructor(
        anchorBlockRoot: string,
        anchorBlockNumber: number,
        beefyMmrRoot: string,
        currentSlot: number,
        currentEpoch: number,
        currentGuarantors: string[],
        previousGuarantors: string[]
    ) {
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
    toObject(): object {
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