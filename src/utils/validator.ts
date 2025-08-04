// --- src/utils/validation.ts ---
import { ValidationError } from './errors.ts';

/**
 * Validates that a required value is present.
 * @param value - The value to validate.
 * @param fieldName - The name of the field being validated.
 */
export const validateRequired = (value: unknown, fieldName: string): void => {
    if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
    ) {
        throw new ValidationError(`${fieldName} is required.`);
    }
};

/**
 * Validates that a value matches the expected primitive type.
 * @param value - The value to validate.
 * @param fieldName - The field name for error messages.
 * @param expectedType - The expected type as a string (e.g., 'string', 'number').
 */
export const validateType = (
    value: unknown,
    fieldName: string,
    expectedType: string
): void => {
    if (typeof value !== expectedType) {
        throw new ValidationError(`${fieldName} must be a ${expectedType}.`);
    }
};

/**
 * Validates that all items in an array are of the expected type.
 * @param arr - The array to validate.
 * @param fieldName - The field name for error messages.
 * @param expectedType - The expected type of items.
 */
export const validateArrayOfType = (
    arr: unknown,
    fieldName: string,
    expectedType: string
): void => {
    if (!Array.isArray(arr)) {
        throw new ValidationError(`${fieldName} must be an array.`);
    }
    for (const item of arr) {
        if (typeof item !== expectedType) {
            throw new ValidationError(`All items in ${fieldName} must be a ${expectedType}.`);
        }
    }
};

/**
 * Validates that a value is an instance of a given class.
 * @param value - The value to check.
 * @param fieldName - The name of the field.
 * @param ExpectedClass - The expected constructor/class.
 */
export const validateInstanceOf = (
    value: unknown,
    fieldName: string,
    ExpectedClass: new (...args: any[]) => any
): void => {
    if (!(value instanceof ExpectedClass)) {
        throw new ValidationError(`${fieldName} must be an instance of ${ExpectedClass.name}.`);
    }
};
