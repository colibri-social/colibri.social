---
"@colibri-social/app": minor
---

Move calls between Colibri nodes without dropping them.

- Calls connect to the fastest voice node. When a call already runs on another node, the app follows it there.
- When the node hosting a call is about to go offline, the app measures the round trip to every candidate node and reports it, so the call moves to the node that suits everyone best. A notice says the call is about to move, with a "Move now" button that moves it right away.
- When the call moves, the app opens the new node's connection while the call keeps playing, and switches over once the new node has the call. A running screen share stops on the move, and a notice asks to share again.
- A new experiment, "Route calls through the relay", sends call audio and video through the relay to test calls on strict networks.
