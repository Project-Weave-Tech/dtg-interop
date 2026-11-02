# Working on this repository as an agent

This board records how the implementations of the decentralized trust graph fit together: what each project runs, on what, and what has been shown to work between two of them. Most rows are kept by the projects themselves, often through their AI agents. This file is for those agents.

## What belongs here

- Facts about **your own project**, as of today. Change only `projects/<slug>/project.json` (and its README) of your own project; for another project's row, open an issue or tell that project. A run is entered by one of the two sides.
- No ratings, rankings or comparisons in prose. The board compares by putting the same fields side by side.
- Nothing guessed as running. `runs` means it runs in code someone can look at, and it needs `evidence`.
- Notes in your own words, one or two sentences, no marketing language.

## Files

| File | Holds |
|---|---|
| `projects/<slug>/project.json` | One project's row. Your file. |
| `projects/<slug>/README.md` | One paragraph: what it is, who works on it, what others can try against it today. |
| `projects/<slug>/trust-tasks.json` | Optional: a long list of Trust Task types, extracted from the source. |
| `scenarios.json` | The scenarios: what two projects should manage together. Id, layer, what each asks, what each side brings to take part (`requires`) and how you know it works between two projects (`done`). Shared. |
| `credential-profiles.json` | The credential profiles (VRC, VMC, …) and their families. Shared. |
| `procedures/<slug>/procedure.json` | How to run one or more scenarios between two projects (steps, vectors), with the `results` of every run. |
| `threads.json` | Links to discussions elsewhere that matter for interop. Shared. |
| `schema/*.schema.json` | The schemas. The closed vocabularies are the `enum` lists in `schema/project.schema.json`. |

## Fields of `project.json`

Required: `slug` (the folder name), `name`, `repositories`, `stack`, `scenarios`, `provenance`, `updated`.

| Field | Content |
|---|---|
| `name`, `shortName` | Full name; `shortName` only if the project itself uses a short form and the name is long (max 16). |
| `purpose` | One sentence, from your own sources, on what the project sets out to do (max 160). |
| `website`, `docs`, `logo`, `licence`, `repositories`, `apps` | Where to find it. `logo` is a URL you publish or a file `site/logo-<slug>.png`. |
| `stack` | Short free text per topic (DID methods, credentials, transport, groups, devices …). |
| `facets` | Short filterable values per topic (`didMethods`, `keys`, `groupAuthority`, `groupKeys`, `offline`, `language`, …). |
| `credentials` | One entry per credential form: `model`, `profiles`, `proof`, `status`. |
| `messaging` | Messages between parties: `protocol`, `via`, `viaName`, `status`. |
| `replication` | Shared state between parties or devices: `protocol`, `via`, `viaName`, `status`. |
| `trustTaskUse` | `status`, `namespaces`, `types` (or `typesFile`), `count`, `mapsTo`, `documentProof`. |
| `requiredParty` | The party without which it does not work. |
| `scenarios` | What you bring to each scenario: `{ status, note, evidence }`. |
| `provenance` | `kind`: `project` (written or confirmed by you) or `public` (compiled by someone else); `date`; `sources`. |

## Rules for values

- **Status** in `credentials`, `messaging`, `replication`, `trustTaskUse` and facet values: `runs` (in running code) | `building` (code exists, not complete) | `committed` (announced or agreed, nothing running yet). `trustTaskUse` also has `none`.
- **Status at a scenario** (`scenarios.<id>.status`) says how far you meet the scenario's `requires`: `runs` (in code another project can exercise today) | `vectors` (test vectors exist) | `spec` (specified, not built) | `open` (known gap or open question) | `stated` (said in the project's public texts, no code checked) | `n/a` (does not apply). `runs` does not mean the scenario was run with another project; that is a run.
- **Derived statuses**: four scenarios (`vrc-verify`, `same-carrier`, `shared-room`, `document-framework`) carry `derivedFrom` in `scenarios.json`. Where you said no more than `stated` there, the build fills in `runs` from a matching `credentials`, `messaging`, `replication` or `trustTaskUse` entry with status `runs`, marked derived and with that entry's evidence. Say `spec`, `open` or `n/a` yourself and the build leaves it alone.
- **Run between two projects**: a scenario's `done` is met only through a run. A `pass` runs every scenario the procedure lists; a `partial` runs the scenarios named in `results[].scenarios`; a `fail` fails all of them. The board derives the pairs from this and from nothing else.
- **Evidence**: every `runs`, `vectors` and `stated` at a scenario (and every `runs` elsewhere) needs `evidence: [{ "label", "url" }]`, pointing at code, a release or a test. The validation rejects it otherwise.
- **Closed vocabularies**: `credentials.model`, `credentials.proof`, `messaging.protocol`, `replication.protocol`, `via`, `trustTaskUse.documentProof` accept only the values in `schema/project.schema.json`. Credential profiles must be keys of `credential-profiles.json`. If your value is missing, add it to the schema in the same commit and say why in the commit message.
- **Facets**: a value is a short string, or `{ "value", "status", "note"?, "evidence"? }` when it is not simply in use (an experiment branch is `building`). Brackets describe, they never carry a status.
- **Empty and missing**: an empty array means "none"; a missing field means "not known". Do not write `[]` when you only do not know.
- **Confirming**: when your project has checked its row, set `provenance.kind` to `project`, `provenance.date` and `updated` to today, and remove the line saying the row was compiled from public sources in your `README.md`.

## Publishing a change

With write access, push straight to `main`:

```bash
npm install
# edit projects/<slug>/project.json
npm run validate          # must print "valid: …"
git add projects/<slug>/
git commit -m "<slug>: <what changed>"
git pull --rebase
git push
```

One project per commit; add only your own folder. If you ran `npm run build` to look at the board, reset what it changed before pulling (`git checkout -- site/github-snapshot.json`), otherwise the rebase stops on unstaged changes. A rebase conflict means someone else changed the same file in the meantime: keep both changes where they do not contradict, and ask the other side where they do.

The deploy runs `npm run validate` before every publication. An invalid push is not published; the live board stays on the last good state. Whoever sees a failed run fixes it with a new commit.

Without write access (new to the board, or no access to the repository yet): fork, make the same change and open a pull request with the same title.

## Recipes

**1. Say what you bring to a scenario.** Find the scenario id in `scenarios.json`. In your `project.json`:

```json
"scenarios": {
  "vrc-verify": {
    "status": "runs",
    "note": "Issues and verifies VRCs with eddsa-jcs-2022.",
    "evidence": [{ "label": "vrc module", "url": "https://github.com/your-org/your-repo/tree/main/src/vrc" }]
  }
}
```

Only ids from `scenarios.json`. A missing scenario is added to `scenarios.json` with `origin`, `requires` and `done`, in its own commit; whoever adds it decides that it belongs. A scenario without a `done` a run could check does not belong here.

**2. Record a run between two projects.** In `procedures/<slug>/procedure.json`, append to `results`:

```json
{
  "date": "2026-11-14",
  "sides": [
    { "project": "your-slug", "version": "1.4.0" },
    { "project": "other-slug", "version": "0.9.2" }
  ],
  "outcome": "pass",
  "note": "What was exchanged and what was checked."
}
```

`outcome` is `pass`, `fail` or `partial`; a `partial` also names the scenarios it did show in `scenarios`. `source` is `manual` (a person entered it after a run; the default) or `ci` (written by an automated interop job). A result you compile from public sources about two other projects carries `reportedBy: { project, sources }`; the board shows it as reported until one of the sides confirms it by editing the result and removing the field. Both projects must exist under `projects/`. No procedure for the scenario yet: copy `procedures/_template/` (status `proposed`), or open an issue with the label `run`. A procedure lists only the scenarios whose `done` the run exercises; its README states the pass criterion in terms of those `done` sentences.

**3. Add a new project.** Copy `projects/_template/` to `projects/<slug>/` (lowercase, hyphens), set `slug` to the folder name, fill in what you know and leave out what you do not. Set `provenance.kind` to `project`. Write the `README.md` paragraph. Validate, then push (or open a pull request if you have no write access yet).
