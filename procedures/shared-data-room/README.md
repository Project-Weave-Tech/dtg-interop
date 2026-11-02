# Two apps read and write the same encrypted data room

**Level:** 2a · **Status:** proposed · **Participants:** rltp (the room host is another implementation; its row is its own to add)

## What is exchanged

A client of implementation B joins a data room hosted by implementation A (invitation, welcome, epoch chain), reads the records already in the room, writes one record, and A's own tooling reads that record back. The room's host sees ciphertext only.

## Pass criterion

- B's client joins with an identifier of its own (no account at A's trust agent) and obtains the room's key material through the room's own welcome.
- B reads every record of the current epoch and at least one earlier epoch.
- B writes one record; A reads it with its own tooling.
- A removes B; B can no longer read records written after the removal.
- The host never holds a key: stated by A, checked by B where the protocol allows.

## Out of scope

Merging concurrent writes, offline writes, the room's ownership model (who may invite, who may remove) beyond what the test needs, bringing B's own group model into the room.

## Vectors

None yet; the first run will produce the protocol that later runs compare against.

## Results

None yet. RLTP has run this once internally against an OpenVTC Data Room (browser tab without a trust agent joins, reads epochs 1 and 4, writes a record, `pnm` reads it). That run counts once its protocol is published and OpenVTC confirms it from its side.
