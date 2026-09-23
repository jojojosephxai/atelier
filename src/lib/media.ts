import { useEffect, useState } from "react";
import { cachedPhotoUrl, photoUrl } from "./photo-db";

export function pieceSrc(item: {
  id?: string;
  imageSrc?: string;
  imageDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
}): string | undefined {
  if (item.id && SAMPLE_IMAGES[item.id]) return SAMPLE_IMAGES[item.id];
  const blobId = item.imageBlobId || item.photoBlobId;
  if (blobId) {
    const cached = cachedPhotoUrl(blobId);
    if (cached) return cached;
  }
  return item.imageSrc || undefined;
}

export function usePieceSrc(item: {
  id?: string;
  imageSrc?: string;
  imageDataUrl?: string;
  imageBlobId?: string;
  photoBlobId?: string;
}): string | undefined {
  const [src, setSrc] = useState(() => pieceSrc(item));
  const blobId = item.imageBlobId || item.photoBlobId;
  useEffect(() => {
    const next = pieceSrc(item);
    if (next) {
      setSrc(next);
      return;
    }
    if (!blobId) {
      setSrc(undefined);
      return;
    }
    let live = true;
    void photoUrl(blobId).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [item.id, blobId, item.imageSrc]);
  return src;
}

const v = "v58";

export const SAMPLE_IMAGES: Record<string, string> = {
  g_navy_coat: `/sample/cut/navy-coat.webp?${v}`,
  g_stone_jacket: `/sample/cut/stone-jacket.webp?${v}`,
  g_olive_overshirt: `/sample/cut/olive-overshirt.webp?${v}`,
  g_navy_harrington: `/sample/cut/navy-harrington.webp?${v}`,
  g_camel_coat: `/sample/cut/camel-coat.webp?${v}`,
  g_navy_blazer: `/sample/cut/navy-blazer.webp?${v}`,
  g_dinner_jacket: `/sample/cut/dinner-jacket.webp?${v}`,
  g_white_oxford: `/sample/cut/white-oxford.webp?${v}`,
  g_ivory_linen: `/sample/cut/ivory-linen.webp?${v}`,
  g_black_merino: `/sample/cut/black-merino.webp?${v}`,
  g_grey_tee: `/sample/cut/grey-tee.webp?${v}`,
  g_navy_knit: `/sample/cut/navy-knit.webp?${v}`,
  g_charcoal_trouser: `/sample/cut/charcoal-trouser.webp?${v}`,
  g_navy_trouser: `/sample/cut/navy-trouser.webp?${v}`,
  g_grey_trouser: `/sample/cut/grey-trouser.webp?${v}`,
  g_black_trouser: `/sample/cut/black-trouser.webp?${v}`,
  g_indigo_jean: `/sample/cut/indigo-jean.webp?${v}`,
  g_olive_chino: `/sample/cut/olive-chino.webp?${v}`,
  g_sand_short: `/sample/cut/sand-short.webp?${v}`,
  g_black_oxford: `/sample/cut/black-oxfords.webp?${v}`,
  g_brown_chelsea: `/sample/cut/brown-chelseas.webp?${v}`,
  g_white_sneaker: `/sample/cut/white-sneakers.webp?${v}`,
  g_suede_loafer: `/sample/cut/suede-loafers.webp?${v}`,
  g_brown_belt: `/sample/cut/brown-belt.webp?${v}`,
  g_steel_watch: `/sample/cut/steel-watch.webp?${v}`,
  g_navy_tie: `/sample/cut/navy-tie.webp?${v}`,
  g_black_bow: `/sample/cut/black-bow.webp?${v}`,
  g_black_tote: `/sample/cut/black-tote.webp?${v}`,
  g_canvas_weekender: `/sample/cut/canvas-weekender.webp?${v}`,
  g_navy_cap: `/sample/cut/navy-cap.webp?${v}`,
  g_crew_pack: `/sample/cut/crew-pack.webp?${v}`,
  g_navy_umbrella: `/sample/cut/navy-umbrella.webp?${v}`,
  g_black_perf_tee: `/sample/cut/black-perf-tee.webp?${v}`,
  g_charcoal_jogger: `/sample/cut/charcoal-jogger.webp?${v}`,
  g_grey_trainer: `/sample/cut/grey-trainer.webp?${v}`,
  g_gym_tee: `/sample/cut/gym-tee.webp?${v}`,
  g_gym_jogger: `/sample/cut/gym-jogger.webp?${v}`,
  g_gym_trainer: `/sample/cut/gym-trainer.webp?${v}`,
  g_navy_perf_tee: `/sample/cut/navy-perf-tee.webp?${v}`,
  g_white_train_tee: `/sample/cut/white-train-tee.webp?${v}`,
  g_olive_gym_short: `/sample/cut/olive-gym-short.webp?${v}`,
  g_navy_jogger: `/sample/cut/navy-jogger.webp?${v}`,
  g_black_trainer: `/sample/cut/black-trainer.webp?${v}`,
  g_navy_quarter_zip: `/sample/cut/navy-quarter-zip.webp?${v}`,
  g_black_hoodie: `/sample/cut/black-hoodie.webp?${v}`,
  g_white_tee: `/sample/cut/white-tee.webp?${v}`,
  g_chambray: `/sample/cut/chambray.webp?${v}`,
  g_black_jean: `/sample/cut/black-jean.webp?${v}`,
  g_khaki_chino: `/sample/cut/khaki-chino.webp?${v}`,
  g_denim_jacket: `/sample/cut/denim-jacket.webp?${v}`,
  g_rain_shell: `/sample/cut/rain-shell.webp?${v}`,
  e_bergamot: `/sample/cut/colonia.webp?${v}`,
  e_vetiver: `/sample/cut/grey-flannel.webp?${v}`,
  e_tonka: `/sample/cut/tonka.webp?${v}`,
  e_cleanser: `/sample/cut/cerave-cleanser.webp?${v}`,
  e_vitc: `/sample/cut/skinceuticals-ce.webp?${v}`,
  e_moist: `/sample/cut/lrp-moist.webp?${v}`,
  e_spf: `/sample/cut/supergoop-spf.webp?${v}`,
  e_retinol: `/sample/cut/gg-retinol.webp?${v}`,
  e_night: `/sample/cut/weleda-night.webp?${v}`,
  e_clay: `/sample/cut/hanz-clay.webp?${v}`,
  e_balm: `/sample/cut/santal-33.webp?${v}`,
};
