# Changelog

All notable changes to this project are documented here.

## 0.3.0 - 2026-04-28

### Added

- Added a dashboard screenshot to the project README.
- Added an object-tree filter to the Inspector workspace, including case-insensitive fuzzy matching for abbreviated node names.
- Added dashboard regression coverage for the redesigned operations layout, dynamic WebSocket endpoint display, Inspector workspace sizing, and object filtering.
- Added this changelog to document npm release changes.

### Changed

- Redesigned the web dashboard into a denser operations workspace with named status, inventory, recent-event, and Inspector regions.
- Reworked the dashboard layout so the Inspector has its own desktop column while the primary workspace keeps an independent height.
- Updated README copy to use the project name "Open AltTester Server" and link to the open-source AltTester Unity SDK.
- Display the dashboard WebSocket endpoint from the served host instead of hard-coding the default localhost port.

### Fixed

- Fixed cross-runtime CI reliability by avoiding platform-specific npm lockfile behavior and caching Node.js installs from `package.json`.
- Fixed Node 20 test runs by polyfilling `globalThis.WebSocket` in Vitest setup.
- Fixed the version CLI output to match the tested plain semver format.
- Tracked the empty `src/inspector` placeholder directory required by bootstrap tests.

## 0.2.0 - 2026-04-14

### Added

- Added first-class Node.js runtime support alongside Bun.
- Added a runtime-neutral server adapter interface with Bun and Node HTTP/WebSocket implementations.
- Added a Node.js CLI wrapper for `npx` and global npm installs.
- Added separate Node and Bun TypeScript configurations and cross-runtime test commands.
- Added a GitHub Actions CI matrix for Node 20, Node 22, and Bun.
- Added CLI version output.

### Changed

- Replaced the Bun-only server startup path with runtime auto-detection.
- Updated npm and project documentation to describe both Node.js and Bun usage.
- Switched the main cross-runtime test path to Vitest while retaining Bun-native test support.

## 0.1.1 - 2026-04-13

### Changed

- Clarified that the package required Bun at this point in the project history.
- Removed Node.js quick-start commands from the README and npm README until Node.js support was added in `0.2.0`.

## 0.1.0 - 2026-04-12

### Added

- Initial npm release of `open-alttester-server`.
- Using the AltTester WebSocket protocol reference documentation.
- Inspector auto-update, configurable depth, scene response normalization, and one-click scene/object refresh.
