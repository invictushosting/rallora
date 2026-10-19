# Keyboard fixture navigation

The club overview metrics are native buttons rather than mouse-only clickable articles. Enter and Space open the corresponding view. Opening a fixture view moves focus to its labelled panel, and Close returns focus to the original overview button. The league count focuses the league section. Active status filters and club-management sections expose pressed state for assistive technology.

The existing card design and responsive layouts are preserved, with visible keyboard focus outlines and reduced-motion support. No league data, results or registration settings change. Verification uses real keyboard input in the deployed test-club administration to check Enter, Space, destination focus, filter state and focus return. Hosted lint, typecheck, build and existing regression checks remain required.
