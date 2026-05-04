---
id: TASK-6
title: Support Unity AppId live-update handshake
status: Done
assignee: []
created_date: '2026-05-04 09:33'
updated_date: '2026-05-04 09:35'
labels:
  - server
  - protocol
  - unity-sdk
dependencies: []
references:
  - >-
    /Users/pmelchart@funstage.com/development/projects/git/buzzinga/Assets/AltTester/Runtime/UI/AltDialog.cs
  - >-
    /Users/pmelchart@funstage.com/development/projects/git/buzzinga/Assets/AltTester/Runtime/Communication/LiveUpdateCommunicationHandler.cs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the minimal Desktop-compatible AppId and live-update app websocket handshake so AltDialog marks the server connection as established before driver lifecycle messages update the dialog text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unity app receives an AppId command after connecting on /altws/app
- [x] #2 Server accepts the Unity live-update websocket path /altws/live-update/app using the AppId
- [x] #3 Driver lifecycle notification behavior remains covered and passing
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the minimal Unity AppId/live-update handshake. The server now sends an AppId command to the app on /altws/app, accepts /altws/live-update/app so AltDialog can set wasConnected, and keeps driver lifecycle notifications covered. Updated protocol docs and BDD coverage.
<!-- SECTION:FINAL_SUMMARY:END -->
