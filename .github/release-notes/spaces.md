A preview build of Colibri with spaces support and the new UI!

> [!CAUTION]
> Expect rough edges and data that may be reset between previews. Your data _will_ be wiped once the full release happens, Dec. 1.

## iOS and iPadOS

Join the TestFlight beta at https://testflight.apple.com/join/wayMH5BR. Install TestFlight from the App Store first if you don't have it.

## Android

Join the testing program at https://play.google.com/apps/testing/social.colibri.app, then install or update Colibri Social from Google Play. The build arrives through the Spaces testing track.

To sideload, download `Colibri.Social_{{ANDROID_VERSION}}_universal.apk` below.

## macOS

TestFlight builds for Mac are available through the same link as iOS: https://testflight.apple.com/join/wayMH5BR.

If you prefer Homebrew:

```sh
brew install --cask colibri-social/tap/colibri-social-beta
```

The beta cask conflicts with `colibri-social`. Uninstall the stable cask first.

To install manually, download `Colibri.Social_{{VERSION}}_universal.dmg` below.

## Windows

If you're in the Spaces Testers group, the Microsoft Store installs this build automatically from https://apps.microsoft.com/detail/9P8Q77FCCSWR. If you'd like to join, send an email to `pds@colibri.social`.

With Scoop:

```sh
scoop bucket add colibri-social https://github.com/colibri-social/scoop-bucket
scoop install colibri-social/colibri-social-beta
```

To install manually, download `Colibri.Social_{{VERSION}}_x64-setup.exe` below.

## Linux

Download the package for your distribution and architecture below:

| Format | x86_64 | arm64 |
| --- | --- | --- |
| AppImage | `Colibri.Social_{{VERSION}}_amd64.AppImage` | `Colibri.Social_{{VERSION}}_aarch64.AppImage` |
| Debian and Ubuntu | `Colibri.Social_{{VERSION}}_amd64.deb` | `Colibri.Social_{{VERSION}}_arm64.deb` |
| Fedora and openSUSE | `Colibri.Social-{{VERSION}}-1.x86_64.rpm` | `Colibri.Social-{{VERSION}}-1.aarch64.rpm` |

The desktop builds update themselves from the beta feed. The spaces build uses the same app identifier as the stable app, so installing it replaces your stable install on that device. If you face issues, send a DM to @colibri.social on Bluesky.
