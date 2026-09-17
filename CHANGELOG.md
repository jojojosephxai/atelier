# Changelog

## 2026-09-14 — Engine + site polish

### Summary
Outfit suggestions stay clothes-only (Grooming stays separate), the look engine works for imported closets, and a few everyday UI rough edges are cleaned up.

### Look engine
- Fix rain looks preferring an umbrella when you own one
- Fix palette score being counted twice
- Keep fragrance / skincare off Today, Looks, Stylist saves, and the look builder — those live under Grooming only
- Sample looks no longer ship with grooming product IDs attached
- Add unit tests for school, gym, rain, and “no extras on outfits”

### Site polish
- Closet / look tiles no longer start fully invisible (`opacity-0`) while photos load
- “Clear everything” asks for confirmation before wiping the device closet
- Removing a saved look asks for confirmation
- Style analyzer copy states clearly that nothing leaves this device
- Closet empty state points to Today (not a vague “stylist”)

### For you
Import your pack as usual. Today and Looks only compose clothes. Open **Grooming** for fragrance and skincare.
