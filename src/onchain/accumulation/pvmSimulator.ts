/**
 * Mocks the Ψ_A PVM invocation for state mutation.
 * This PVM takes a Work-Item and applies its logic to a conceptual global state.
 */

import { WorkItem } from '../../models/WorkItem.ts';
import { PVMExecutionError } from '../../utils/errors.ts';

// Define types for the expected structure of the global state and state delta

interface Account {
  balance: number;
}

interface GlobalState {
  accounts: Record<string, Account>;
  data?: Record<string, any>;
  log?: string;
}

interface StateDelta {
  accounts?: Record<string, Account>;
  data?: Record<string, any>;
  log?: string;
}

/**
 * Simulates the Ψ_A PVM execution for a single Work-Item.
 * @param workItem - The Work-Item to execute.
 * @param currentGlobalState - The current conceptual global state.
 * @returns A state delta representing changes to the global state.
 */
export const simulatePsiAPVM = (
  workItem: WorkItem,
  currentGlobalState: GlobalState
): StateDelta => {
  console.log(`[Ψ_A PVM] Executing Work-Item: ${workItem.id} (Program: ${workItem.programHash})`);

  const stateDelta: StateDelta = {};
  let gasConsumed = 0;

  try {
    if (workItem.programHash === "0xtransfer") {
      const { from, to, amount }: { from: string; to: string; amount: number } = JSON.parse(workItem.inputData);

      if (
        currentGlobalState.accounts[from] &&
        currentGlobalState.accounts[from].balance >= amount
      ) {
        stateDelta.accounts = {
          ...currentGlobalState.accounts,
          [from]: {
            ...currentGlobalState.accounts[from],
            balance: currentGlobalState.accounts[from].balance - amount,
          },
          [to]: {
            ...currentGlobalState.accounts[to] || { balance: 0 },
            balance: (currentGlobalState.accounts[to]?.balance || 0) + amount,
          },
        };
        gasConsumed = 50;
      } else {
        throw new Error("Insufficient balance or invalid accounts for transfer.");
      }

    } else if (workItem.programHash === "0xupdateData") {
      const { key, value }: { key: string; value: any } = JSON.parse(workItem.inputData);
      stateDelta.data = {
        ...currentGlobalState.data,
        [key]: value,
      };
      gasConsumed = 20;

    } else {
      stateDelta.log =
        (currentGlobalState.log || "") +
        `Executed ${workItem.programHash} with input ${workItem.inputData}.`;
      gasConsumed = 10;
    }

    if (gasConsumed > workItem.gasLimit) {
      throw new Error(
        `Gas limit exceeded for Work-Item ${workItem.id}. Consumed: ${gasConsumed}, Limit: ${workItem.gasLimit}`
      );
    }

    console.log(`[Ψ_A PVM] Work-Item ${workItem.id} executed successfully. Gas consumed: ${gasConsumed}`);
    return stateDelta;

  } catch (error: any) {
    console.error(`[Ψ_A PVM] Error executing Work-Item ${workItem.id}: ${error.message}`);
    throw new PVMExecutionError(
      `Ψ_A PVM execution failed for Work-Item ${workItem.id}: ${error.message}`
    );
  }
};
