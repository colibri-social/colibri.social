---
"@colibri-social/wrapper": patch
"@colibri-social/client": patch
---

Recovers from a dropped local database during sign-in on iOS. iOS shuts down the storage the app keeps its session in whenever the app spends time in the background, which is exactly what happens while the sign-in sheet is open. The app now reopens that storage instead of failing every read for the rest of the session, and a slow read while starting up no longer signs you out.

<!-- whatsnew
title: Reliable Sign-In on iOS
icon: key-fill
body: Signing in on iPhone and iPad no longer gets stuck when the app is in the background during the sign-in sheet, and a slow start-up no longer signs you out.
kind: fix
-->
