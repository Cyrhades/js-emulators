import { useState, useEffect } from "react";

/**
 * Hook qui tente de charger `/emulators/${consoleId}/background.png`.
 * Si `background.png` est présent, il est retourné.
 * Sinon, il bascule sur `/emulators/${consoleId}/thumbnail.png`.
 */
export function useConsoleWallpaper(consoleId?: string): string {
  const [wallpaperUrl, setWallpaperUrl] = useState<string>("");

  useEffect(() => {
    if (!consoleId) {
      setWallpaperUrl("");
      return;
    }

    const bgCandidate = `/emulators/${consoleId}/background.png`;
    const thumbCandidate = `/emulators/${consoleId}/thumbnail.png`;

    let isMounted = true;

    const imgBg = new Image();
    imgBg.src = bgCandidate;

    imgBg.onload = () => {
      if (isMounted) setWallpaperUrl(bgCandidate);
    };

    imgBg.onerror = () => {
      const imgThumb = new Image();
      imgThumb.src = thumbCandidate;
      imgThumb.onload = () => {
        if (isMounted) setWallpaperUrl(thumbCandidate);
      };
      imgThumb.onerror = () => {
        if (isMounted) setWallpaperUrl("");
      };
    };

    return () => {
      isMounted = false;
    };
  }, [consoleId]);

  return wallpaperUrl;
}
