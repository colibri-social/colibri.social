---
"@colibri-social/client": patch
---

Adds a way back in when a session ends, and detects that it has ended in the first place. The app used to show a loading screen reading "Not logged in!" with no button on it, paired with an automatic redirect to the sign-in screen that silently stranded anyone whose navigation never landed. There is now a real screen with a sign-in button, and the redirect is gone.
