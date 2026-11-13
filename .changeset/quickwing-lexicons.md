---
"@colibri-social/lib": minor
"@colibri-social/app": patch
"@colibri-social/wrapper": patch
"@colibri-social/website": patch
---

Update `@colibri-social/lexicons` to 2.37.0. `@colibri-social/lib` decodes the new `drainNotice` and `writeState` sync frames and the `migrationProposal`, `migrateTo` and `callElsewhere` voice frames, and builds `rttReport` and `moveNow`. The default OAuth scopes and the app's Sentry trace targets follow `DEFAULT_APPVIEW_URL`, and traces also reach `*.nodes.colibri.social`. The website exports the new lexicons.
