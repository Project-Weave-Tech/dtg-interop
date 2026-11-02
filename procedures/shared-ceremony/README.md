# Two people on two different apps connect through one ceremony

**Level:** 0c (proposed) · **Status:** proposed · **Participants:** rltp (Consensual is co-defining the ceremony; its row is its own to add)

## What is exchanged

Side A displays a VTI trigger link (fragment with `_from`, `_id`, `_exp`, `_type`) as a QR code. Side B scans it and runs the `shared-connect` ceremony: invitation, answer, confirmation, each step a Trust Task document whose `ceremony.enactment` is the inviter's challenge. Both sides end holding a relationship credential issued by the other.

## Pass criterion

- Both apps decode the same QR form (trigger-link hull, deflate with dictionary, Base32) and reject an unknown flow and an expired link.
- Each side verifies the other's step documents against the ceremony binding (`vectors/shared-connect-binding.json`).
- Each side verifies the credential the other issued (scenario `vrc-cross-verification` applies).
- Each side records the channel it observed itself (displayed or scan) and shows the relationship accordingly.

## Out of scope

Delivery of later messages (scenario `message-over-tsp`), group membership, a ceremony entered through a link without a scan (allowed, but it yields a `link` relationship and is not what this scenario tests).

## Vectors

- `shared-connect-binding.json` in trust-protocol (enactment binding for the ceremony URI).
- The ceremony definition for `shared-connect` in the DTGWG format: to be published when v0.3 of the ceremony is agreed.

## Results

None yet.
