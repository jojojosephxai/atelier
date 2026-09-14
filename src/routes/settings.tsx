import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BoardEditor } from "@/components/board-editor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { mergeBoard } from "@/lib/board";
import { applyPersistPack, persistPack } from "@/lib/persist-pack";
import { rebindPhotoUrls, referencedPhotoIds } from "@/lib/photo-db";
import { useWardrobe } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const PACK_FILE = "atelier-pack-v3.json";
const PACK_HOLD_MS = 60_000;

function SettingsPage() {
  const boardSlots = useWardrobe((s) => s.profile.boardSlots);
  const setProfile = useWardrobe((s) => s.setProfile);
  const replaceAll = useWardrobe((s) => s.replaceAll);
  const slots = mergeBoard(boardSlots);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLAnchorElement>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");

  async function packJson() {
    const pack = await persistPack(useWardrobe.getState());
    return JSON.stringify(pack);
  }

  async function applyJson(text: string) {
    const raw = JSON.parse(text) as unknown;
    const next = await applyPersistPack(raw);
    replaceAll({
      garments: next.garments,
      extras: next.extras,
      looks: next.looks,
      profile: next.profile,
    });
    await rebindPhotoUrls(referencedPhotoIds(useWardrobe.getState()));
  }

  async function onExport() {
    setBusy(true);
    try {
      const json = await packJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = exportRef.current;
      if (!a) throw new Error("No export link");
      a.href = url;
      a.download = PACK_FILE;
      a.type = "application/json";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), PACK_HOLD_MS);
      toast("Pack downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not export pack");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    setBusy(true);
    try {
      const json = await packJson();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
        toast("Pack copied");
      } else {
        setPaste(json);
        toast("Pack is in the paste box — copy it from there");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not copy pack");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await applyJson(await file.text());
      toast("Pack imported");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not import pack";
      toast.error(msg);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onImportPaste() {
    if (!paste.trim()) {
      toast.error("Paste a pack first");
      return;
    }
    setBusy(true);
    try {
      await applyJson(paste);
      toast("Pack imported");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not import pack";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Studio</p>
        <h1 className="font-display text-4xl leading-none text-fg md:text-5xl">
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Category boxes for the closet — one tile each, never stacked. Rename
          or hide a box. Looks still use the same framed tiles.
        </p>
      </header>
      <BoardEditor
        slots={slots}
        onChange={(next) => setProfile({ boardSlots: next })}
      />
      <section className="space-y-3">
        <h2 className="font-display text-3xl leading-none text-fg italic">
          Pack
        </h2>
        <p className="max-w-xl text-sm text-muted">
          Download or restore this closet on this device. Photos stay in the
          pack — not a store, no account. Export before “Clear everything” if
          you want a backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void onExport()}>
            Export pack
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onCopy()}
          >
            Copy pack
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Import pack
          </Button>
          <a
            ref={exportRef}
            download="atelier-pack-v3.json"
            type="application/json"
            className="sr-only"
            aria-hidden
          >
            atelier-pack-v3.json
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,.atelier.json"
            className="sr-only"
            onChange={(e) => {
              void onImportFile(e.target.files?.[0]);
            }}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted">
            Paste pack
          </p>
          <Textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder='{"version":3,"wardrobe":…,"blobs":…}'
            spellCheck={false}
            rows={6}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onImportPaste()}
          >
            Import paste
          </Button>
        </div>
      </section>
    </div>
  );
}
