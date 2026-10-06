"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/** Open an authorized record directly, independently of list pagination. */
export function useResourceLink<T>(load: (id: string) => Promise<T>, show: (record: T) => void, fail: (message: string) => void) {
  const params = useSearchParams();
  const id = params.get("open");
  const callbacks = useRef({ show, fail });
  useEffect(() => { callbacks.current = { show, fail }; });
  useEffect(() => {
    if (!id) return;
    let active = true;
    load(id).then(record => { if (active) callbacks.current.show(record); })
      .catch(() => { if (active) callbacks.current.fail("Impossible d’ouvrir cet élément. Vérifiez votre accès ou réessayez."); });
    return () => { active = false; };
  }, [id, load]);
  return () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("open");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
}
