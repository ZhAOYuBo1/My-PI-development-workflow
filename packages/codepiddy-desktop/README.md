# @codepiddy/desktop

CodePIddy Windows desktop client prototype.

## First-time setup

Run from the repository root:

```powershell
npm ci --ignore-scripts
npm run install:electron
```

## Build

```powershell
npm run build:codepiddy
```

## Run

```powershell
npm start --workspace=@codepiddy/desktop
```

## Development renderer preview

```powershell
cd packages/codepiddy-desktop
npm exec vite -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/?demo=1` for the browser-only visual demo. The real desktop client uses the Electron preload bridge.

## Current vertical slice

- Open and initialize a project;
- Create feature and bug work items under `.codepiddy/`;
- Archive/restore work items;
- Create one persistent Agent Instance per slot;
- Start Pi in RPC mode and stream events to the React transcript.
