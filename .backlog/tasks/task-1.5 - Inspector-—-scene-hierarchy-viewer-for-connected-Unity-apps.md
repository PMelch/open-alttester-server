---
id: TASK-1.5
title: Inspector — scene hierarchy viewer for connected Unity apps
status: To Do
assignee: []
created_date: '2026-04-10 05:32'
updated_date: '2026-04-10 05:32'
labels: []
dependencies:
  - TASK-1.4
references:
  - AltTester-Unity-SDK/Bindings~/python/alttester/commands/UnityCommands/
  - AltTester-Unity-SDK/Bindings~/python/alttester/altdriver.py
parent_task_id: TASK-1
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Inspector feature in the web dashboard. The Inspector allows the user to select a connected Unity app and view its current scene layout. To query the Unity app, the server must act as a synthetic driver: send AltTester commands (GetCurrentScene, GetAllLoadedScenes, and a scene hierarchy/objects command) directly to the selected Unity app and display the response. The server needs an internal 'inspector driver' mode that can send commands to a Unity app without a real test driver being connected, or piggyback on an existing pairing. See Bindings~/python/alttester/commands/UnityCommands/ for command shapes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inspector panel visible in the dashboard, listing connected Unity apps
- [ ] #2 Selecting a Unity app queries it for loaded scenes (GetAllLoadedScenes)
- [ ] #3 Scene hierarchy is displayed as a tree view (game object names, components)
- [ ] #4 Inspector can refresh the scene view on demand
- [ ] #5 Inspector does not interfere with an active driver pairing on the same app
<!-- AC:END -->
