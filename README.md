# DTG interop

A status board for interoperability between the implementations of the decentralized trust graph: who builds what, where it could fit together, what has been shown to work between two projects.

Board: https://real-life.org/dtg-interop/ (data: [`site/dist/data.json`](site/) built from this repository and from GitHub).

Most rows were compiled from public sources and say so. **Every project can correct its own row:** open [`projects/<slug>/project.json`](projects/) in the GitHub editor, change what is wrong, send the pull request. Statuses, apps, repositories, anything.

**Record a run** between two projects: add a line to `results` in [`scenarios/<slug>/scenario.json`](scenarios/) (date, two sides with versions, outcome), or open an issue with the label `run` and someone will.

**Threads** that matter for interop live in many repositories; [`threads.json`](threads.json) links them. An issue here is for a thread that has no other home.

Started by the Real Life Trust Protocol team for the Project Weave Interop Builder Weekend, November 2026; meant to be transferred to a shared organisation. Documents and data [CC BY 4.0](LICENSE), scripts [MIT](LICENSE-CODE).
