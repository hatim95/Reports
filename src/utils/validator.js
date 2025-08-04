/**
 * General utility functions for data validation.
 */
import { ValidationError } from './errors.js';

export const validateRequired = (value, fieldName) => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        throw new ValidationError(`${fieldName} is required.`);
    }
};

export const validateType = (value, fieldName, expectedType) => {
    if (typeof value !== expectedType) {
        throw new ValidationError(`${fieldName} must be a ${expectedType}.`);
    }
};

export const validateArrayOfType = (arr, fieldName, expectedType) => {
    if (!Array.isArray(arr)) {
        throw new ValidationError(`${fieldName} must be an array.`);
    }
    for (const item of arr) {
        if (typeof item !== expectedType) {
            throw new ValidationError(`All items in ${fieldName} must be a ${expectedType}.`);
        }
    }
};

export const validateInstanceOf = (value, fieldName, ExpectedClass) => {
    if (!(value instanceof ExpectedClass)) {
        throw new ValidationError(`${fieldName} must be an instance of ${ExpectedClass.name}.`);
    }
};