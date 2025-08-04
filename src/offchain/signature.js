/**
 * Handles cryptographic signing and verification using tweetnacl.
 * Assumes Ed25519 keys.
 *
 * To use:
 * npm install tweetnacl
 * or via CDN: <script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl.min.js"></script>
 */
import nacl from 'tweetnacl';

// Helper to convert string to Uint8Array
const encodeText = (text) => new TextEncoder().encode(text);
// const decodeText = (bytes) => new TextDecoder().decode(bytes); // Not used in this context

/**
 * Signs a message using a private key.
 * @param {object} messageObject - The object to be signed. It will be stringified.
 * @param {Uint8Array} privateKey - The Ed25519 private key.
 * @returns {string} The base64 encoded signature.
 */
export const signMessage = (messageObject, privateKey) => {
    try {
        const messageString = JSON.stringify(messageObject);
        const messageBytes = encodeText(messageString);
        const signature = nacl.sign.detached(messageBytes, privateKey);
        return btoa(String.fromCharCode(...signature)); // Base64 encode
    } catch (error) {
        console.error("Error signing message:", error);
        throw new Error("Failed to sign message.");
    }
};

/**
 * Verifies a signature against a message and public key.
 * @param {object} messageObject - The original message object that was signed.
 * @param {string} signatureBase64 - The base64 encoded signature.
 * @param {Uint8Array} publicKey - The Ed25519 public key.
 * @returns {boolean} True if the signature is valid, false otherwise.
 */
export const verifySignature = (messageObject, signatureBase64, publicKey) => {
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
 * @returns {{publicKey: Uint8Array, privateKey: Uint8Array}}
 */
export const generateKeyPair = () => {
    return nacl.sign.keyPair();
};

/**
 * Converts a Uint8Array public key to a base64 string.
 * @param {Uint8Array} publicKeyBytes
 * @returns {string}
 */
export const publicKeyToBase64 = (publicKeyBytes) => {
    return btoa(String.fromCharCode(...publicKeyBytes));
};

/**
 * Converts a base64 string public key to a Uint8Array.
 * @param {string} publicKeyBase64
 * @returns {Uint8Array}
 */
export const base64ToPublicKey = (publicKeyBase64) => {
    return Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
};