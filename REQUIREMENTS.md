# Requirements

## Landing Page: Gesture-Interactive 3D Selection

### Goal
Transform the landing page into a gesture-interactive 3D selection space. The default state is a 3D harp-shaped composition. When the user opens their hand, the harp disperses into particles mixed with spherical elements and artwork cards. The user rotates the particle field by moving their hand left/right. A fist gesture selects the nearest artwork and enters its experience.

### Visual Direction
- Theme: starry-night atmosphere (deep blue to black gradient, star dust, subtle glow).
- Default object: a harp-shaped 3D form made of light points and strings.
- Dispersal: controlled particle burst (not fully random), preserving visual order.
- Artwork cards: semi-transparent glass-like panels with soft glowing edges.
- Particles: small glowing points with a mix of glass-like spheres.

### Interaction Flow / State Machine
1. Idle (Harp state)
   - Harp slowly rotates with gentle pulse in strings.
2. Open-hand gesture
   - Harp breaks apart into particles and orbits over ~1.5–2 seconds.
3. Orbit (Selection state)
   - Hand left/right movement rotates the particle field.
   - Artwork cards billboard toward the camera.
4. Fist gesture
   - Nearest artwork highlights and scales in, then transitions into the experience.

### Expansion Considerations
- Shape presets should be configurable (harp first, future instruments later).
- Artwork cards should support multiple items with auto-distribution into orbits.
- Visual theme should be adjustable via palette/material changes.

### Implementation Notes (High-Level)
- R3F + Three.js for 3D scene and particles.
- Use instanced meshes for particle performance.
- Avoid heavy 3D modeling; generate harp shape procedurally.
- Selection logic should prioritize distance + camera center weighting.
