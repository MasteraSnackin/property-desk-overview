# Property Desk — Property overview

[Open the standalone Property overview](https://masterasnackin.github.io/property-desk-overview/)

A read-only map and list of 25 synthetic BUILD properties, their 47 recorded items, source evidence and questions that still need checking.

## Independent static site

This repository contains only the files needed to display the overview and its downloads. It has its own GitHub Pages deployment. It does not connect to the Property Desk application, its APIs, databases, policy engine, workflow runtime or credentials. It creates no cases, sends no messages and performs no operational actions. Browser settings and selection live in the page URL; no shared application state is used.

The content security policy blocks fetch/XHR connections, forms, frames, objects and workers. OpenStreetMap is used only for visible street-map image tiles. Source links open the pinned public case records when selected. Leaflet is bundled locally.

## Using the overview

Switch between Map and List, search by case, property or issue, and use the Case type and Evidence gap filters. Select a property to see Summary, Questions and Evidence. For example, case 019 separates reported garden clearance from unconfirmed levelling, gravel and final usability. Download links provide the static inventory, issue list and invented map positions.

## Data boundary

These are complete historical synthetic BUILD records, not a live work queue, current property-condition assessment or evaluation input. The map positions are invented; they do not locate the displayed addresses. A recorded closure is not independent proof of completed repairs. The reserved evaluation partition is not included.

[Original coverage and preparation notes](https://github.com/MasteraSnackin/hackathon-valley/tree/ecafbc51a260166509bbb93b5545e2ade4dce375/docs/property-overview) explain the source-backed evidence states. `SOURCE.json` records the exact source revision and file hashes. The only runtime change for this standalone copy is the restrictive content security policy in `index.html`.

## Hosting and local preview

GitHub Pages serves this repository's `main` branch from the root. `.nojekyll` keeps the deployment static; there is no build, package installation, application server or shared deployment workflow.

```sh
python3 -m http.server 54038 --bind 127.0.0.1
```

Open http://127.0.0.1:54038/ for a local preview. No API keys are needed.

## Attribution

The application presentation code retains the source project's Apache 2.0 licence in `LICENSE`. Third-party case material comes from [DwellyOrg/HackatonPublicCases](https://github.com/DwellyOrg/HackatonPublicCases/tree/9bcdca585955dfb930005ed742572606e68f5688/Property%20Management); the application licence does not relicense that material. Leaflet's licence is retained in `vendor/leaflet/LICENSE`, and OpenStreetMap attribution remains visible on the map.
