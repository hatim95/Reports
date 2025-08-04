/**
 * Mocks the Ψ_A PVM invocation for state mutation.
 * This PVM takes a Work-Item and applies its logic to a conceptual global state.
 */
import { WorkItem } from '../../models/WorkItem.js';
import { PVMExecutionError } from '../../utils/errors.js';

/**
 * Simulates the Ψ_A PVM execution for a single Work-Item.
 * @param {WorkItem} workItem - The Work-Item to execute.
 * @param {object} currentGlobalState - The current conceptual global state.
 * @returns {object} A state delta representing changes to the global state.
 */
export const simulatePsiAPVM = (workItem, currentGlobalState) => {
    console.log(`[Ψ_A PVM] Executing Work-Item: ${workItem.id} (Program: ${workItem.programHash})`);
    // This is a highly simplified mock.
    // In a real system, this would involve a WASM runtime,
    // executing the program, and returning precise state diffs.

    const stateDelta = {};
    let gasConsumed = 0;

    try {
        // Example: Simulate a simple account transfer or data update
        if (workItem.programHash === "0xtransfer") {
            const { from, to, amount } = JSON.parse(workItem.inputData);
            if (currentGlobalState.accounts[from] && currentGlobalState.accounts[from].balance >= amount) {
                stateDelta.accounts = {
                    ...currentGlobalState.accounts,
                    [from]: { ...currentGlobalState.accounts[from], balance: currentGlobalState.accounts[from].balance - amount },
                    [to]: { ...currentGlobalState.accounts[to] || { balance: 0 }, balance: (currentGlobalState.accounts[to]?.balance || 0) + amount }
                };
                gasConsumed = 50;
            } else {
                throw new Error("Insufficient balance or invalid accounts for transfer.");
            }
        } else if (workItem.programHash === "0xupdateData") {
            const { key, value } = JSON.parse(workItem.inputData);
            stateDelta.data = { ...currentGlobalState.data, [key]: value }; // Assuming a 'data' field in globalState
            gasConsumed = 20;
        } else {
            // Default behavior for unknown programs
            stateDelta.log = (currentGlobalState.log || "") + `Executed ${workItem.programHash} with input ${workItem.inputData}.`;
            gasConsumed = 10;
        }

        if (gasConsumed > workItem.gasLimit) {
            throw new Error(`Gas limit exceeded for Work-Item ${workItem.id}. Consumed: ${gasConsumed}, Limit: ${workItem.gasLimit}`);
        }

        console.log(`[Ψ_A PVM] Work-Item ${workItem.id} executed successfully. Gas consumed: ${gasConsumed}`);
        return stateDelta;

    } catch (error) {
        console.error(`[Ψ_A PVM] Error executing Work-Item ${workItem.id}: ${error.message}`);
        throw new PVMExecutionError(`Ψ_A PVM execution failed for Work-Item ${workItem.id}: ${error.message}`);
    }
};