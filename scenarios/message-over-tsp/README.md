# Two connected people on two different apps exchange a message each way

**Level:** 0d (proposed) · **Status:** proposed · **Participants:** rltp (waiting for a counterpart)

## Why this scenario exists

The DTG document catalogue has no type for a message from one person to another (October 2026). `chat/message` is agent-to-platform with an evidentiary hash chain; `messaging/*` administers a mediator. Every implementation fills the gap on its own, so no two of them can exchange a message. This scenario is the test for a shared type; the type itself is proposed in the Discussion linked from the dashboard.

## What is exchanged

Two people already connected (scenario `shared-ceremony` or any ceremony both apps accept) each send one message to the other. The message is a Trust Task document inside a TSP envelope, delivered through one mediator both apps reach. Minimal body: text, sent-at, message id, optional reply-to.

## Pass criterion

- The receiving app places the message in the conversation with the sender it already knows and shows text and time.
- The receiving app can answer, and the answer arrives the same way.
- A third party holding the envelope cannot prove who wrote it: the document carries no transferable proof (a pairwise MAC or an equivalent construction), only the sender and the recipient can verify it.
- Both sides reject a document whose MAC or binding does not verify.

## Out of scope

Forward secrecy and post-compromise security of the content (an MLS-based pair ratchet is a possible second step, not this scenario), read receipts, attachments, group messages.

## Vectors

- RLTP: `vectors/message.json` (`message@1`: directional key from the pair keys, MAC preimage, negatives).
- A shared vector for the proposed common type: to be written with the first counterpart.

## Results

None yet.
