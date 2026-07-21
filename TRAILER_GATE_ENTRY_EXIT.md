# Trailer gate flow — entry to exit

Simplified visit flow: **gate entry → yard/dock operations → gate exit**. No device assignment or mapping steps.

Assumes the trailer is registered and **Off site**. For device mapping and full automation detail, see [TRAILER_CHECKIN_TO_CHECKOUT.md](./TRAILER_CHECKIN_TO_CHECKOUT.md).

Related: [USER_FLOWS.md](./USER_FLOWS.md) · [TRAILER_LIFECYCLE_FLOWCHART.md](./TRAILER_LIFECYCLE_FLOWCHART.md)

---

## Main flowchart

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'padding': 18, 'nodeSpacing': 42, 'rankSpacing': 52}, 'theme': 'base', 'themeVariables': {'fontFamily': 'Georgia, Times New Roman, serif', 'fontSize': '13px', 'lineColor': '#4A154B', 'primaryTextColor': '#1B1B1B'}}}%%
flowchart TD
  startNode([START]) --> arrive[Trailer arrives at gate — Off site]
  arrive --> gateEntry[Gate entry — check in at inbound lane]
  gateEntry --> gateInEvent[Automatically record gate-in event]
  gateInEvent --> slotChoice{Assign parking slot now?}

  slotChoice -->|Yes| assignSlot[Assign parking slot]
  slotChoice -->|No| waitGate[Status: Gate arrived — awaiting slot]
  waitGate --> slotLater[Assign parking slot later]
  slotLater --> assignSlot
  assignSlot --> inYard[Status: In yard]

  gateInEvent --> autoMonitor[Automation Engine — background monitoring]
  autoMonitor --> monitorRules[Evaluate temperature, fuel, dwell and yard rules]
  monitorRules --> issueDecision{Exception detected?}
  issueDecision -->|Yes| exceptionQueue[Create exception and notify]
  exceptionQueue --> assignOwner[Assign owner and inspect]
  assignOwner --> holdDecision{Hold required?}
  holdDecision -->|Yes| applyHold[Apply QA or Yard hold overlay]
  applyHold --> resolve[Resolve and clear hold]
  holdDecision -->|No| resolve
  resolve --> resumeOps[Resume operations]
  issueDecision -->|No| autoMonitor

  inYard --> dockDecision{Dock required?}
  resumeOps --> dockDecision
  dockDecision -->|Yes| readyDock[Status: Ready to dock]
  readyDock --> blocked{Active hold or open exception?}
  blocked -->|Yes| assignOwner
  blocked -->|No| assignDoor[Assign dock door]
  assignDoor --> atDock[Status: At dock]
  atDock --> dockWork[Loading or unloading]
  dockWork --> qaVerify[QA verification]
  qaVerify --> dockDone[Dock work completed]
  dockDone --> unlock[Unlock dock]
  unlock --> staged[Status: Outbound staged]

  dockDecision -->|No| stageDirect[Stage for departure from yard]
  stageDirect --> staged

  staged --> exitValidation[Validate holds cleared, dock complete if required, exceptions resolved]
  exitValidation --> exitReady{Gate exit validation passed?}
  exitReady -->|No| resolveBlockers[Resolve departure blockers]
  resolveBlockers --> exitValidation
  exitReady -->|Yes| gateExit[Gate exit — outbound lane]
  gateExit --> gateOutEvent[Automatically record gate-out event]
  gateOutEvent --> offSite[Status: Off site]
  offSite --> finishNode([END])

  classDef startPill fill:#B8E6B8,stroke:#2E7D32,stroke-width:2px,color:#1B1B1B,font-weight:bold
  classDef endPill fill:#D4B8F0,stroke:#7B1FA2,stroke-width:2px,color:#1B1B1B,font-weight:bold
  classDef action fill:#C8E6C9,stroke:#43A047,stroke-width:1.5px,color:#1B1B1B
  classDef decision fill:#E8B4F0,stroke:#9C27B0,stroke-width:1.5px,color:#1B1B1B
  classDef alert fill:#4A154B,stroke:#2D0A2E,stroke-width:2px,color:#FFFFFF

  class startNode startPill
  class finishNode endPill

  class arrive,gateEntry,gateInEvent,assignSlot,waitGate,slotLater,inYard,autoMonitor,monitorRules,assignOwner,resolve,resumeOps,readyDock,assignDoor,atDock,dockWork,qaVerify,dockDone,unlock,staged,stageDirect,exitValidation,gateExit,gateOutEvent,offSite action

  class slotChoice,issueDecision,holdDecision,dockDecision,blocked,exitReady decision

  class exceptionQueue,applyHold,resolveBlockers alert
```

### Design legend

| Style | Shape | Color | Used for |
|-------|-------|-------|----------|
| **Start / End** | Pill | Mint green / Lavender | Gate entry and exit |
| **Action** | Rectangle | Light green | Process steps |
| **Decision** | Diamond | Light purple | Yes / No branches |
| **Alert** | Rectangle | Dark purple | Exceptions, holds, blockers |

---

## At a glance

```mermaid
flowchart LR
  IN[Gate entry] --> YARD[In yard]
  YARD --> OPS[Dock or stage]
  OPS --> ST[Outbound staged]
  ST --> OUT[Gate exit]
  OUT --> OFF[Off site]
```

---

## Gate flow summary

| Step | Status | Where |
|------|--------|-------|
| 1. **Gate entry** | Gate arrived | **Gates** — inbound lane, seal/temp |
| 2. **Park** | In yard | **Gates** / **Yards** — assign slot now or later |
| 3. **Operate** | In yard → At dock | **Yards** / **Docks** (if dock required) |
| 4. **Stage** | Outbound staged | **Docks** / **Yards** |
| 5. **Gate exit** | Off site | **Gates** — outbound lane |

---

## Automation (gate-focused)

| Type | What happens |
|------|----------------|
| **Operator** | Check in, assign slot, dock work, resolve exceptions, gate exit |
| **Assisted** | System may recommend a parking slot — operator confirms |
| **Automatic** | Gate-in/out events, background monitoring, exception alerts, dwell/temp/fuel rules, exit validation checks |

### Background monitoring (parallel)

While on site, the Automation Engine evaluates:

- Temperature and cold-chain rules  
- Low fuel  
- Long dwell  
- Open exceptions  

When triggered: **notify → assign owner → inspect → resolve** (hold overlay if needed).

### Dock path

| dockRequired | Flow |
|--------------|------|
| **Yes** | Ready to dock → Assign door → Load/unload → QA → Unlock → Outbound staged |
| **No** | In yard → Stage for departure → Outbound staged |

### Gate exit validation

Before outbound lane exit:

- Holds cleared  
- Dock complete (if required)  
- Exceptions resolved  

Then: **gate exit** → auto gate-out event → **Off site**.

---

## Where in the app

| Action | Screen |
|--------|--------|
| Gate entry | **Gates** → Check in trailer |
| Assign slot | **Gates** / **Yards** |
| Dock work | **Docks** |
| Exceptions | **Exceptions** |
| Gate exit | **Gates** → Gate exit |
