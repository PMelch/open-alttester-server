---
id: TASK-5
title: Send Unity driver lifecycle notifications
status: Done
assignee: []
created_date: '2026-05-04 09:28'
updated_date: '2026-05-04 09:31'
labels:
  - server
  - protocol
  - unity-sdk
dependencies: []
references:
  - >-
    /Users/pmelchart@funstage.com/development/projects/git/buzzinga/Assets/AltTester/Runtime/Commands/CommandHandler.cs
  - >-
    /Users/pmelchart@funstage.com/development/projects/git/buzzinga/Assets/AltTester/Runtime/UI/AltDialog.cs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix open-alttester-server so the Unity app receives the app-side DriverConnectedNotification and DriverDisconnectedNotification messages expected by AltDialog/CommandHandler when a test driver connects or disconnects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unity app websocket receives DriverConnectedNotification with driverId when a driver pairs
- [x] #2 Unity app websocket receives DriverDisconnectedNotification with the same driverId when the driver disconnects
- [x] #3 Driver-side driverRegistered notification behavior is preserved
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented app-side Unity driver lifecycle notifications. The server now sends DriverConnectedNotification to the Unity app when a driver pairs and DriverDisconnectedNotification with the same driverId when the driver disconnects, while preserving driver-side driverRegistered behavior. Added BDD coverage and updated protocol docs.
<!-- SECTION:FINAL_SUMMARY:END -->
