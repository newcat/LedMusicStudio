# Verification notes (feature 003)

Headless smoke test (Chrome + SwiftShader WebGL2, scene built through the pinia stores). Not a replacement for T083.

**Verified**: no console errors or shader compile errors in editor and show window; auto-mapping (Q1) for MH-X50+, BeamZ PLS25, COLORband PiX (12 cells), flame/CO2/spark/hazer; beam colour wheel + gobo; par floor spot; beam cut off at a box (Q10 centre ray); per-cell pixel bar (Q19); all five effects render (Q20); hazer coupling rises/decays (Q20); FPS HUD and `?forceFallback` notices (Q22); show window receives scene + values (Q13); hidden tab stops rendering (Q15, partly).

**Bugs found and fixed**: LED strip pixel colour attribute was a copy (pixels black); flame trigger was on at DMX 0 (EffectParameter levels).

**Not verified**: strobe timing/flash limit (Q4), movement timing (Q8), zoom/16-bit (Q7), wheel splits/prism (Q6), shadow shape, performance (Q11/Q12, SC-002/003), resize (Q14), latency (Q16), strip drawing UI (Q17/Q18), old project load (Q21), hardware (Q23), Electron build. T079 (reference scene), T080 (performance pass), T083 and T084 are open.

**Observations**: flame light is very strong and the flame column looks sparse; new spots/moving heads emit upward until rotated; Galaxian 3D laser colour channels, PSYCO2JET "Safety" mode and Stinger II 2ch map nothing.
