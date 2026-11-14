---
"@colibri-social/app": minor
"@colibri-social/lib": minor
"@colibri-social/website": patch
---

Channel and category permissions now use per-role and per-member overrides. The permissions page lists the Members role, every role and every member with an override, and each one opens an editor where every channel permission is set to Allow, Inherit or Deny. Changing overrides needs the Manage roles permission, and you can only change permissions you hold yourself.

Making a channel or category private at creation denies View channels to the Members role and allows it for the roles and members you pick. The Owner-only toggle is gone.

Thread creation, moving messages and applying labels follow the viewer's permissions in that channel. When a live update takes posting away, the composer locks right away and keeps what you'd typed.

`@colibri-social/lib` exports `PermissionOverride` and no longer exports `RoleChannelOverride`. The website lexicon export is updated to `@colibri-social/lexicons` 2.39.0.
