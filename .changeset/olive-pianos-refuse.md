---
"@colibri-social/client": patch
---

Stops the unread-status seeding loop from endlessly re-requesting communities the AppView refuses, and stops reporting that refusal as a crash. A community that answers "not a member" is now parked for the session, logged with its URI as a breadcrumb, and picked up again as soon as a join event for it arrives.
