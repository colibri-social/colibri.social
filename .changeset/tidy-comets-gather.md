---
"@colibri-social/client": patch
---

Fixes a dead session going unnoticed. When a sign-in ends for good, the underlying library reports it with an error that carries no name, so the app read every one of those as an unknown failure and kept trying: requests fired on every resume, each one failed, and nothing ever said why. Those sessions are now recognised, so you get the sign-in screen instead of an app that looks online and quietly does nothing. Sessions are also written to disk more carefully, which should stop some of them from ending early in the first place.
