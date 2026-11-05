# NAOMS-Rust

The NAOMS core, rebuilt in Rust from a written specification as a set of reusable crates (types, crypto, chain, store, graph, net, auth, ceremony, keyholder, mailbox, mls and more). It is a clean-room cutover, not a fork: the aim is to replace the current TypeScript daemon while keeping the same identity, hive and trust-graph model. Spec-first since October 2026. People: Mujo.

The core source is not public yet, so every row here is `spec` (specified, not built) or `committed` (announced, nothing a reader can run). The public record is the devlog: [writing the rewrite down first](https://blog.naoms.dev/posts/2026-10-30-writing-the-rewrite-down-first.html). The shipping product is the separate [`naoms`](../naoms/) row.
