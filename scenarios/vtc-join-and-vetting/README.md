# A wallet joins a verifiable trust community, is vetted and holds its credentials

**Status:** passing (reported) · **Participants:** keyring, openvtc

## What is exchanged

A wallet of one implementation joins a trust community (VTC) hosted by another. Under the community's policy a vetter is appointed and approved, the vetter vets a new member, and the community issues the membership and vetting credentials, which the wallet holds and the host verifies again.

## Pass criterion

- The wallet joins the community and receives a membership credential issued under the community's identifier (point `membership-statement`).
- The vetting is recorded as a credential the host's tooling verifies (the community acts as the registry of who belongs: point `registry-lookup`).
- Appointment, vetting and issuance follow the community's stated policy, not a manual step on the host.

## Out of scope

Relationship credentials between two members (scenario `vrc-cross-verification`), delivery over TSP between the wallet and the host (point `same-carrier`), data rooms.

## Results

- **2026-10-15, pass (reported), Keyring × OpenVTC.** Shown in Prague at Open Source Summit Europe, 7 to 9 October 2026, as the first verifiable trust community for an open source project; the Keyring app appointed and approved a vetter and the vetter vetted a new contributor ([LFDT blog, 15 Oct 2026](https://www.lfdecentralizedtrust.org/blog/lf-decentralized-trust-demonstrates-the-first-open-source-verifiable-trust-community-in-prague)). Keyring's release harness checks its vetting card with the upstream tool ([keyring-wallet #732](https://github.com/berkmancenter/keyring-wallet/issues/732)); the app is pinned to the versions the OpenVTC Farm runs ([PR 168](https://github.com/berkmancenter/keyring-wallet/pull/168)). Compiled from public sources by rltp, not entered by either side; either side can confirm it by editing the result and removing `reportedBy`.
