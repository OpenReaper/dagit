# DAGIT Design System

## Direction

DAGIT is a credibility-first proof product. It earns trust through visible, verifiable boundaries: device-local hashing, user-approved wallet actions, a live public registry, and a portable receipt. It does not imitate an exchange, a dark crypto dashboard, or an enterprise compliance product.

## Visual language

- Surfaces: white and pale blue, with deep navy text.
- Action: `#0957D6` trust blue. Reserve `#147A64` for confirmed success only.
- Geometry: 10–16px rounded panels, fine blue-grey rules, restrained soft elevation on focal cards.
- Typography: compact, high-weight sans display and readable system sans body; monospace appears only for addresses, hashes, and other data.
- Icons: the single inline, 1.8px-stroke SVG family used in `src/main.tsx`.

## Component rules

- Lead public pages with a plain promise and one clear next action.
- Place the four product truths immediately after the hero: local file, self-custody, on-chain proof, portable receipt.
- Render live registry values only from configuration or chain reads; never use fictional counters, partner marks, certifications, or claims.
- Keep the proof workspace operationally simple: choose file, create fingerprint, add optional version context, connect wallet, approve proof, and retain a Proof Pack receipt.
- Make the shared-version outcome explicit: create a Proof Pack, share its private QR or link, then let the recipient verify their own file before choosing a wallet acknowledgement.
- `/admin` inherits the blue system but remains operational and Cloudflare Access protected.

## Responsive and accessibility

- At narrow widths, the hero and workspaces stack; navigation links collapse before the wallet action.
- Interactive controls retain visible focus states supplied by the browser and meet a minimum 44px control height.
- Loading, pending wallet, receipt, and verification feedback remain textual and do not depend on colour alone.
