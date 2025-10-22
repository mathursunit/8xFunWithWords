# 8× Fun With Words — v1.7.1 (Sequence Edition)

**Fixes for local file usage**  
- Bundles `js/valid_words.js` so validation works without fetching (avoids `file://` restrictions).  
- Still tries to *extend* from `assets/valid_words.txt` when served over HTTP(S).  
- Adds a min-height for the boards area so it always shows.
- Keeps: 4 per row, 15 tries, sticky keyboard, scroll, sequence replay, red invalid row.

Replace `assets/valid_words.txt` with a bigger list anytime.
