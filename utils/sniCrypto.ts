// utils/sniCrypto.ts
// Field-level encryption for SNI's PII fields (alter name, Facebook URL, phone
// number) — the platform's only point of personally identifiable information
// capture about non-consenting third parties (design brief §9). No reversible
// field-level encryption utility existed anywhere in this codebase before
// this — existing crypto usage elsewhere (auth.controller.ts, user.controller.ts)
// is all one-way (random tokens, SHA-256 hashes). This is new infrastructure,
// built once and used everywhere SNI touches an alter's identifying fields.
//
// Callers only ever use encryptField/decryptField — never the key directly —
// so moving the key source to a KMS later changes nothing at the call sites.
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // NIST-recommended for GCM

function getKey(): Buffer {
    const raw = process.env.SNI_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('SNI_ENCRYPTION_KEY is not set — required to encrypt/decrypt SNI PII fields');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
        throw new Error('SNI_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key)');
    }
    return key;
}

// Returns "iv.authTag.ciphertext" (each base64) — a single string safe to
// store in a Mongoose String field.
export function encryptField(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptField(stored: string): string {
    const key = getKey();
    const [ivB64, authTagB64, dataB64] = stored.split('.');
    if (!ivB64 || !authTagB64 || !dataB64) {
        throw new Error('Malformed encrypted field value');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
}

// Convenience wrappers for optional fields (facebookUrl, phoneNumber) —
// null/undefined passes through instead of throwing.
export function encryptOptionalField(plaintext?: string | null): string | null {
    if (!plaintext) return null;
    return encryptField(plaintext);
}

export function decryptOptionalField(stored?: string | null): string | null {
    if (!stored) return null;
    return decryptField(stored);
}
