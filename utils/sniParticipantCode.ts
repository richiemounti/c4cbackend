// utils/sniParticipantCode.ts
// Short, human-transcribable code minted at wave-1 completion so a field
// collector can re-identify the same respondent at wave 2/3 without a
// platform login. The design brief specifies THAT the prior wave's roster
// must be pre-loaded, not HOW the platform recognises the same respondent —
// this is the supplied mechanism (see SNI_BUILD_PLAN.md §7). Deliberately not
// a Mongo ObjectId: short enough to read aloud or write on paper in the field.
import crypto from 'crypto';

// Excludes visually ambiguous characters (0/O, 1/I/L) for reliable hand
// transcription. Not a security boundary — access to a code alone doesn't
// expose PII, it's a lookup key scoped by survey — so a simple modulo-biased
// draw from a 32-character alphabet is an acceptable tradeoff for brevity.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 7;

export function generateParticipantCode(): string {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return code;
}
