# Real Life Trust Protocol

A local-first implementation of the decentralized trust graph on the ToIP stack. Trust is relational: it starts when two people meet and stays with the two of them. Keys live on people's devices, servers only relay encrypted data, everything keeps working offline. Groups exist without a party above them: no owner, no host epoch, no admin role; authority is a signed log every member holds.

**People:** Anton Tranelis (author, [@antontranelis](https://github.com/antontranelis)).

**Try it:** the browser simulators at https://trust-protocol.real-life.org/ (the app on three devices, one ceremony under the microscope, the graph); the Web of Trust app (Android alpha, web); our TSP mediator at `mediator.web-of-trust.de`.

**What we can show at a table:** two phones connect through the encounter ceremony and the credential is a DTG VRC; delivery over TSP through a VTI mediator; the group test bench (20 scenarios, no owner, concurrent removals, PCS after a captured device, BeeKEM and MLS through the same key port); a browser tab writing into an OpenVTC Data Room.

**What we cannot show yet:** groups in the shipped app; a message read by another implementation; a membership statement read outside the group; two parties at two different mediators.

**Where we stand on the common stack.** Wire and carrier: aligned (TSP 1.0, VTI mediator). Documents: aligned framework (Trust Tasks), with one gap in the catalogue, a person-to-person message type, which we propose to fill together. Group keys: alignable toward MLS where implementations meet (experiment E13). Who decides what the group is: here we differ by design and offer it as a profile, not as the model others should adopt. Ceremonies and conformance: aligned, with vectors to contribute.

Specifications, schemas, vectors and conformance runner: https://github.com/real-life-org/trust-protocol. Test bench: https://github.com/real-life-org/port-experimente.
