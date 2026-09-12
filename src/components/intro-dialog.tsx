import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useWardrobe } from "@/lib/store";

const INTRO_KEY = "atelier-intro-v1";
export const OPEN_ADD_KEY = "atelier-open-add";

export function IntroDialog() {
  const clearAll = useWardrobe((s) => s.clearAll);
  const setProfile = useWardrobe((s) => s.setProfile);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const chosen = useRef(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(INTRO_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, []);

  function remember(choice: "keep" | "wipe") {
    chosen.current = true;
    try {
      localStorage.setItem(INTRO_KEY, choice);
    } catch {
      /* quota */
    }
    setOpen(false);
  }

  function keepDemo() {
    if (chosen.current) return;
    setProfile({ skipDemo: false });
    remember("keep");
  }

  function wipeAndImport() {
    if (chosen.current) return;
    setProfile({ skipDemo: true });
    clearAll();
    try {
      sessionStorage.setItem(OPEN_ADD_KEY, "1");
    } catch {
      /* private */
    }
    remember("wipe");
    void navigate({ to: "/closet" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) keepDemo();
      }}
    >
      <DialogContent
        title="Atelier"
        description="A private closet on this device."
      >
        <p className="text-sm leading-relaxed text-muted">
          Photograph what you own. The cutter knocks the floor so each piece
          sits as an isolated tile. Today builds three looks from that closet —
          school, gym, weekend — without an account or a store.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A demo wardrobe is loaded so you can click around. Keep it, or wipe
          it and import your own from camera or library.
        </p>
        <div className="intro-pill mt-5" role="group" aria-label="Start with">
          <button type="button" onClick={keepDemo}>
            Keep demo
          </button>
          <button type="button" onClick={wipeAndImport}>
            Wipe & import
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
