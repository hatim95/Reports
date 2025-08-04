// --- src/utils/errors.ts ---
/**
 * Custom error classes for the JAM Reports Component.
 */

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

export class AuthorizationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthorizationError";
    }
}

export class PVMExecutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PVMExecutionError";
    }
}

export class ProtocolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProtocolError";
    }
}
