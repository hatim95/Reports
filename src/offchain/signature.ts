/**
 * Handles cryptographic signing and verification using tweetnacl.
 * Assumes Ed25519 keys.
 *
 * To use:
 * npm install tweetnacl
 */

import nacl from 'tweetnacl';

/**
 * Helper to convert a string to a Uint8Array using UTF-8 encoding.
 */
const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * Signs a message using a private key.
 * @param messageObject - The object to be signed. It will be stringified.
 * @param privateKey - The Ed25519 private key (64-byte Uint8Array).
 * @returns The base64 encoded signature.
 */
export const signMessage = (messageObject: Record<string, unknown>, privateKey: Uint8Array): string => {
    try {
        const messageString = JSON.stringify(messageObject);
        const messageBytes = encodeText(messageString);
        const signature = nacl.sign.detached(messageBytes, privateKey);
        return btoa(String.fromCharCode(...signature)); // Convert to base64 string
    } catch (error) {
        console.error("Error signing message:", error);
        throw new Error("Failed to sign message.");
    }
};

/**
 * Verifies a signature against a message and public key.
 * @param messageObject - The original message object that was signed.
 * @param signatureBase64 - The base64 encoded signature.
 * @param publicKey - The Ed25519 public key (32-byte Uint8Array).
 * @returns True if the signature is valid, false otherwise.
 */
export const verifySignature = (
    messageObject: Record<string, unknown>,
    signatureBase64: string,
    publicKey: Uint8Array
): boolean => {
    try {
        const messageString = JSON.stringify(messageObject);
        const messageBytes = encodeText(messageString);
        const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
    } catch (error) {
        console.error("Error verifying signature:", error);
        return false;
    }
};

/**
 * Generates a new Ed25519 key pair.
 * @returns An object containing publicKey and privateKey as Uint8Arrays.
 */
export const generateKeyPair = (): nacl.SignKeyPair => {
    return nacl.sign.keyPair();
};

/**
 * Converts a Uint8Array public key to a base64 string.
 * @param publicKeyBytes - The Ed25519 public key.
 * @returns The base64 encoded public key.
 */
export const publicKeyToBase64 = (publicKeyBytes: Uint8Array): string => {
    return btoa(String.fromCharCode(...publicKeyBytes));
};

/**
 * Converts a base64 string public key to a Uint8Array.
 * @param publicKeyBase64 - The base64 encoded public key.
 * @returns The decoded Ed25519 public key.
 */
export const base64ToPublicKey = (publicKeyBase64: string): Uint8Array => {
    return Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
};
