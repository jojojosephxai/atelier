# Atelier

Private local wardrobe organizer. Photograph pieces, knock the floor, plan looks for the day. Data stays on this device.

## School computer (no project folder, no `.exe` installs)

You can use Atelier in **your** browser without copying the repo or installing Node:

1. Open your Cloud Agent run on [cursor.com/agents](https://cursor.com/agents).
2. Wait until the dev server is running (port **8080**).
3. Use **Preview** on that run, **or** **Desktop** → open the browser there → `http://localhost:8080`.

The app runs in Chrome/Edge on your laptop; the code lives in the cloud. School blocks on `.exe` installers do not matter for this path.

**Preview vs typing localhost:** On [cursor.com/agents](https://cursor.com/agents), use **Preview** or **Desktop**. A random `localhost:8080` tab only works when the Cursor **desktop** app is forwarding that port.

**Save your closet:** **Settings → Export pack** before you leave; **Import pack** next time.

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
