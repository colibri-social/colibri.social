# @colibri-social/app

## 0.0.2

### Patch Changes

- afb2445: Show bridged authors by name in Space and thread previews, and drop the gradient banner on invite pages for Spaces without a banner
- 1b63755: Start new roles with the Members role's permissions, place them below every other role and above Members, and always list Members as the bottom role
- 2d51a20: Send people back to sign-in when their sign-in server refuses to renew the session, for example after the app's sign-in details changed
- 569bc0e: Keep you signed in after closing your laptop or leaving the app in the background
- 1b63755: Fix saving a profile picture or banner for accounts on a server without Spaces support, which left new users stuck on a "That file isn't there anymore" screen after sign-up
- 23ffdef: Read space URIs in both the `at://{did}/space/...` and the `at:space/{did}/...` form, and send the legacy form only while the AppView lists the `legacySpaceUris` feature
- 1b63755: Changes the color and size of the Space profile overview indicator
- Updated dependencies [23ffdef]
  - @colibri-social/lib@0.2.1
  - @colibri-social/ui@0.0.2

## 0.0.1

### Patch Changes

- Updated dependencies [b6082ed]
  - @colibri-social/ui@0.0.1
