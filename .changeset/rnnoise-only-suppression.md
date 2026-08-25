---
"@colibri-social/client": minor
"@colibri-social/wrapper": patch
"@colibri-social/website": patch
---

Replaces the seven noise-suppression presets with a single RNNoise engine and an independent voice gate. DeepFilterNet and the experimental DTLN, GTCRN and UL-UNAS backends are gone, along with the strength slider, the suppression hints and the model download pipeline. RNNoise now runs in a worklet Colibri owns, so its speech probability drives the speaking indicator instead of a second AudioContext polling the raw track. Capture asks for a mono track and leaves gain control to Colibri, which makes the microphone volume slider affect real calls for the first time.

<!-- whatsnew
title: Noise, be suppressed!
icon: waveform-fill
body: Noise suppression is now a single switch instead of seven presets, with a separate Voice Gate switch that mutes you between sentences. This concludes the previous experiment.
platforms: all
kind: feature
-->
