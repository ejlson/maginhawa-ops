# Power Automate flows

The Power Automate side of Maginhawa Ops, kept in git like the rest of the code. The folder is an **unpacked solution** (`MaginhawaOps`): edit the files here, then pack and import. Don't edit the live flow in the designer. If you do, export it back over these files straight away, or the next import will undo your change.

## How it fits

```
Manager submits ──► submit-eod (Netlify Function)
                     ├─ works out the figures (packages/core), saves the report
                     ├─ adds one row to the FlowOutbox list  ◄── the flow's only input
                     └─ emails finance (Graph), as before
                                  │
                FlowOutbox row (Status = Queued)
                                  ▼
             "EOD submitted" flow (this folder)
                     ├─ posts the summary to the ops Teams channel
                     ├─ emails the ops manager if wages are red or there's something to look at
                     └─ sets the row to Done (or Failed, with the reason)
```

- **No trigger URL and no Premium licence.** The app never calls the flow. The flow starts from a SharePoint list using the standard SharePoint connector.
- **Figures are worked out once, in the app.** The flow only shows what the message says. It never calculates.
- **Finance choose the figures.** In the report builder, open **Send to Power Automate** (in *Checks & actions*) and tick figures. The editor shows the message the flow will get. Net, covers, wages and target are always sent.
- **Nothing is lost.** If SharePoint is down at submit, the `email-retry` job adds the row within 15 minutes. If the flow is off, rows wait as *Queued*. If a run fails, the row says why: fix the problem, then set its Status back to **Queued** to run it again.
- **Handover notes are not sent** (they can name staff).

## What's in the folder

| Path | What it is |
|---|---|
| `MaginhawaOps/Workflows/EODsubmitted-….json` | The flow: trigger, steps and expressions |
| `MaginhawaOps/Other/Solution.xml` | Solution name, version, publisher (prefix `mgn`) |
| `MaginhawaOps/Other/Customizations.xml` | The flow's entry and the three connection references (SharePoint, Teams, Outlook) |
| `MaginhawaOps/environmentvariabledefinitions/` | Settings that differ per environment: site URL, list, Teams team and channel, ops manager's email |
| `MaginhawaOps/deployment-settings.example.json` | Copy to `deployment-settings.json` (git-ignored) and fill in for each environment |

The message format is `FLOW_SCHEMA` in `packages/core/src/flow.ts` (currently `maginhawa.eod.submitted/1`). `packages/core/test/flow-solution.test.ts` checks that the flow reads what the app writes, that it only touches FlowOutbox columns that exist, and that every setting and connection is declared. If you change one side, `npm test` tells you to change the other.

## Before the first import

These files were written by hand in the unpacked-solution format. They have **not been imported into a Power Platform environment yet**. The first time:

1. Provision the **FlowOutbox** list (`docs/tech-plan/sharepoint/sharepoint-lists.json`).
2. In a **dev** environment with Dataverse, pack and import (commands below). If the import complains about the format, open the flow in the designer, fix it there, export the solution and unpack it over this folder. From then on, the exported files are the source.
3. Create the three connections under a **service account**, not a person, so the flow survives staff leaving. Put their ids and the settings in `deployment-settings.json`.
4. Turn the flow on, set `FLOW_OUTBOX=1` on the Netlify site, submit a test EOD and check the Teams post and the row's Status.

## Commands

You need the Power Platform CLI (`pac`), signed in to the target environment.

Pack the folder into a solution file:

```bash
pac solution pack --zipfile flows/MaginhawaOps.zip --folder flows/MaginhawaOps --packagetype Unmanaged
```

Import it with this environment's settings:

```bash
pac solution import --path flows/MaginhawaOps.zip --settings-file flows/MaginhawaOps/deployment-settings.json
```

After a change made in the designer, export and unpack it back over the folder:

```bash
pac solution export --name MaginhawaOps --path flows/MaginhawaOps.zip --overwrite
```

```bash
pac solution unpack --zipfile flows/MaginhawaOps.zip --folder flows/MaginhawaOps --allowDelete
```

## Changing the message

1. Change `flowMessage` and bump `FLOW_SCHEMA` in `packages/core/src/flow.ts` if a field changes meaning.
2. Update the flow's *Read the message* schema and the *Known format* check to match.
3. Run `npm test`, then import into dev before live. Until the new flow is live, messages in the new format are marked **Failed: unknown format**. Nothing is lost: set them back to Queued once the flow is updated.
