# A relationship credential issued in one app verifies in another

**Level:** 0a · **Status:** proposed · **Participants:** rltp (waiting for a counterpart)

## What is exchanged

Side A hands side B one `RelationshipCredential` under the DTG Core Credentials context (WD 0.6.0, context v1), issued by A's own identifier, as a file. Side B does the same toward A. No wire is involved; the file is the exchange.

## Pass criterion

- The receiving side verifies the Data Integrity proof (`eddsa-jcs-2022`) with its own library.
- It resolves the issuer's identifier (`did:key` or `did:peer:2`) and finds the verification method under the proof's purpose.
- It reads `issuerScope`, `validFrom` and `validUntil` and states them.
- It rejects at least two of the other side's negatives (a tampered subject, a wrong context) at the named check.

## Out of scope

Issuing a credential about the other side's person, wallet storage, presentation protocols, registry lookups.

## Vectors

- RLTP: `vectors/encounter-cards.json` (the credential as issued), `vectors/dtg-vrc-foreign.json` (self-made plain DTG VRCs with negatives, standing in for another implementation's vectors until one provides them).
- Counterpart: to be added.

## Results

- **2026-10-11, pass, RLTP × Consensual.** Vectors both ways: Consensual's independent DI-EDDSA verifier confirmed RLTP's encounter credentials (8 Oct); RLTP's reader `conformance/dtg-vrc.mjs` verified 12 of 12 Consensual dyad VRCs under did:peer:2 after six form fixes on their side (11 Oct). The run surfaced a key-purpose check, fixed in [trust-protocol #74](https://github.com/real-life-org/trust-protocol/pull/74). Consensual's vectors are not public yet.

