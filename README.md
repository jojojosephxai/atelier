# Atelier

Private local wardrobe organizer. Photograph pieces, knock the floor, plan looks for the day. Data stays on this device.

## Run locally

```bash
git clone https://github.com/jojojosephxai/atelier.git
cd atelier
npm install && npm run dev
```

Open the URL Vite prints (port 8080).

### Easier start (if `npm` in the terminal is annoying)

- **Windows:** double-click `start-atelier.cmd` in the `atelier` folder.
- **Mac:** in Terminal, `cd` into the folder, then run `chmod +x start-atelier.sh && ./start-atelier.sh`.

### If `npm` “doesn’t work”

1. **“npm is not recognized”** — Node is missing. Install **Node.js 22 LTS** from [nodejs.org](https://nodejs.org), then open a **new** terminal window.
2. **Wrong folder** — commands must run inside the `atelier` folder (the one that contains `package.json`).
3. **Install errors** — copy the last 10–20 lines of the error and paste them into Cursor; common fixes are old Node (need 20.19+ or 22.12+) or a flaky network during `npm install`.

You need **Node 22 LTS** (or newer). Check with `node -v`.

Auth is off. Closet and grooming photos live in IndexedDB. Settings → Export pack / Import pack writes `.atelier.json` v3 (wardrobe + blobs).
