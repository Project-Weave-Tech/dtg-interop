# Working on this repository as an agent

This board records how the implementations of the decentralized trust graph fit together: what each project runs, on what, and what has been shown to work between two of them. Most rows are kept by the projects themselves, often through their AI agents. This file is for those agents.

## What belongs here

- Facts about **your own project**, as of today. Change only `projects/<slug>/project.json` (and its README) of your own project; for another project's row, open an issue or tell that project. A run is entered by one of the two sides.
- No ratings, rankings or comparisons in prose. The board compares by putting the same fields side by side.
- Nothing guessed as running. `runs` means it runs in code someone can look at, and it needs `evidence`.
- Notes in your own words, one or two sentences, no marketing language.

## How the board is built

Six words carry the board. Use them as defined here, in files, commits and notes.

- **Scenario** (`scenarios.json`): something people on different apps should be able to do together, such as connecting across apps or proving membership to another app. It says what is true at the end (`done`), not how to get there.
- **Need**: what a scenario cannot do without. A need is one item, or a `oneOf` group where any one item is enough. `extras` make a scenario better or more complete but are not needed for a first run. `missing` names a piece that exists nowhere yet, with the thread where it is discussed; while a scenario has a `missing` piece, no pair can play it.
- **Item**: one of four kinds. Each kind has its catalogue, and each project says in its own row which items it brings:

  | `kind` | Catalogue | A project brings it in |
  |---|---|---|
  | `credential` | `credential-profiles.json` (a profile id such as `VRC`) | `credentials[].profiles` |
  | `task` | the Trust Tasks registry (a type URI) | `trustTaskUse` |
  | `ceremony` | `ceremonies.json` | `ceremonies` |
  | `basic` | `basics.json` | `basics` |

  A **basic** is what two implementations need in common that is none of the other three: identifiers, carriers, the document framework, group keys, devices, registries.
- **Run** (`runs.json`): two projects tried one or more items together, on a date, with both versions and an outcome. Only a run makes an item count as working between two projects; the board derives pairs from runs and from nothing else.
- **Journey**: one end-to-end path through a scenario, that is one item for each need (one per `oneOf` group). A run tests items, not scenarios: a pair has played a scenario when its passing runs together cover one journey. (The word comes from the Trust Task conformance draft and means the same there.)
- **Thread** (`threads.json`): a discussion elsewhere that a scenario, basic or ceremony depends on. An issue in this repository with the label `scenario:<id>` is shown as a thread of that scenario.

In one line: a scenario lists its needs, each project says which items it brings, runs between two projects test items, and the board shows per scenario which pairs have covered a journey.

## Files

| File | Holds |
|---|---|
| `projects/<slug>/project.json` | One project's row. Your file. |
| `projects/<slug>/README.md` | One paragraph: what it is, who works on it, what others can try against it today. |
| `projects/<slug>/trust-tasks.json` | Optional: a long list of Trust Task types, extracted from the source. |
| `scenarios.json` | The scenarios, each with its `needs`, `extras` and `missing`. Shared. |
| `basics.json` | The basics. Each says what a project brings (`requires`) and what has to happen between two projects (`done`). Shared. |
| `ceremonies.json` | The ceremonies: multi-step flows composed of Trust Tasks, from the registry or defined by a project, with their tasks and the scenarios whose needs they can fulfil. Shared. |
| `credential-profiles.json` | The credential profiles (VRC, VMC, …) and their families. Shared. |
| `runs.json` | Every run between two projects: what it tested (credential profiles, Trust Task types, ceremonies, basics), both sides with versions, outcome. Appended, never edited. |
| `threads.json` | Links to discussions elsewhere that matter for interop. Shared. |
| `schema/*.schema.json` | The schemas. The closed vocabularies are the `enum` lists in `schema/project.schema.json`. |

## Fields of `project.json`

Required: `slug` (the folder name), `name`, `repositories`, `stack`, `basics`, `provenance`, `updated`.

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
| `basics` | What you bring to each basic: `{ status, note, evidence }`. Credentials, Trust Tasks and ceremonies you bring are in `credentials`, `trustTaskUse` and `ceremonies`. |
| `ceremonies` | The ceremonies you implement: `[{ ceremony, roles, status, note, evidence }]`, ids from `ceremonies.json`; status `runs`, `building`, `committed` or `stated`. |
| `provenance` | `kind`: `project` (written or confirmed by you) or `public` (compiled by someone else); `date`; `sources`. |

## Rules for values

- **Status** in `credentials`, `messaging`, `replication`, `trustTaskUse` and facet values: `runs` (in running code) | `building` (code exists, not complete) | `committed` (announced or agreed, nothing running yet). `trustTaskUse` also has `none`.
- **Status at a basic** (`basics.<id>.status`) says how far you meet the basic's `requires`: `runs` (in code another project can exercise today) | `vectors` (test vectors exist) | `spec` (specified, not built) | `open` (known gap or open question) | `stated` (said in the project's public texts, no code checked) | `n/a` (does not apply). `runs` does not mean the basic was shown with another project; that is a run.
- **Derived statuses**: three basics (`same-carrier`, `shared-room`, `document-framework`) carry `derivedFrom` in `basics.json`. Where you said no more than `stated` there, the build fills in `runs` from a matching `credentials`, `messaging`, `replication` or `trustTaskUse` entry with status `runs`, marked derived and with that entry's evidence. Say `spec`, `open` or `n/a` yourself and the build leaves it alone.
- **Run between two projects**: a credential, Trust Task, ceremony or basic counts as working between two projects only through a run in `runs.json`. A run's `outcome` applies to every subject it names, unless a subject carries its own `outcome`. The board derives the pairs from runs and from nothing else.
- **Evidence**: every `runs`, `vectors` and `stated` at a basic (and every `runs` elsewhere) needs `evidence: [{ "label", "url" }]`, pointing at code, a release or a test. The validation rejects it otherwise.
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

**1. Say what you bring to a basic.** Find the basic id in `basics.json`. In your `project.json`:

```json
"basics": {
  "did-resolution": {
    "status": "runs",
    "note": "Resolves did:key, did:peer:4 and did:webvh.",
    "evidence": [{ "label": "resolver", "url": "https://github.com/your-org/your-repo/tree/main/src/did" }]
  }
}
```

Only ids from `basics.json`. A missing basic is added to `basics.json` with `origin`, `requires` and `done`, in its own commit. A ceremony you implement goes into `ceremonies` (ids from `ceremonies.json`; a new ceremony is added there with its definition).

**2. Record a run between two projects.** A run names the items it tested, not a scenario; the board works out which scenarios the pair has played. In `runs.json`, append to `runs`:

```json
{
  "subjects": [{ "kind": "ceremony", "id": "shared-connect" }, { "kind": "credential", "id": "VRC" }],
  "date": "2026-11-14",
  "sides": [
    { "project": "your-slug", "version": "1.4.0" },
    { "project": "other-slug", "version": "0.9.2" }
  ],
  "outcome": "pass",
  "note": "What was exchanged and what was checked."
}
```

`subjects` names what the run tested: `kind` is `credential` (a profile id from `credential-profiles.json`), `task` (a Trust Task type URI), `ceremony` (an id from `ceremonies.json`) or `basic` (an id from `basics.json`). `outcome` is `pass`, `fail` or `partial`; when subjects differ, give the differing one its own `outcome`. `source` is `manual` (a person entered it after a run; the default) or `ci` (written by an automated interop job). Add `vectors` and `protocol` links when you have them. A run you compile from public sources about two other projects carries `reportedBy: { project, sources }`; the board shows it as reported until one of the sides confirms it by removing the field. Both projects must exist under `projects/`.

Every run is appended, never edited into an earlier one. **Runs age:** the board fades a mark when its latest run is older than 30 days. A faded mark is an invitation to run it again, typically after a release or a dependency update on either side; append the new run with both versions. A `fail` after an earlier `pass` stays on record; it is the most useful entry the board can show.

**From the table to the file.** "Record a run" on the board opens a prefilled issue with the label `run`. Either of the two projects (or its agent) turns it into an entry in `runs.json`, then closes the issue with a link to the commit.

**3. Add a new project.** Copy `projects/_template/` to `projects/<slug>/` (lowercase, hyphens), set `slug` to the folder name, fill in what you know and leave out what you do not. Set `provenance.kind` to `project`. Write the `README.md` paragraph. Validate, then push (or open a pull request if you have no write access yet).
