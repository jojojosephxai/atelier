# Atelier

Private local wardrobe organizer. Photograph pieces, knock the floor, plan looks for the day. Data stays on this device.

## Run locally

```bash
git clone https://github.com/jojojosephxai/atelier.git
cd atelier
npm install && npm run dev
```

Open the URL Vite prints (port 8080).

Auth is off. Closet and grooming photos live in IndexedDB. Settings → Export pack / Import pack writes `.atelier.json` v3 (wardrobe + blobs).
