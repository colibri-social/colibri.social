---
"@colibri-social/app": patch
"@colibri-social/lib": patch
"@colibri-social/client": patch
"@colibri-social/website": patch
---

Update the AT Protocol Spaces libraries to the October 29 alpha so the app keeps working with PDSes running that release. Your preferences space is created with the new member space policy, and the server check during sign-up looks for the new space methods. `@colibri-social/lib` no longer exports `simplespace`.
