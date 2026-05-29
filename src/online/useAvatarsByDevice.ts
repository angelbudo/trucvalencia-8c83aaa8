import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resol avatar_url públic per a un conjunt de device_ids via RPC.
 * Reutilitzat per pantalles que mostren seients (Sala, Lobby, etc.).
 */
export function useAvatarsByDevice(deviceIds: string[]): Record<string, string | null> {
  const [map, setMap] = useState<Record<string, string | null>>({});
  const key = deviceIds.slice().sort().join("|");
  useEffect(() => {
    if (deviceIds.length === 0) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_public_avatars_by_devices", {
        p_device_ids: deviceIds,
      });
      if (!alive || error || !data) return;
      setMap((prev) => {
        const next = { ...prev };
        for (const row of data as Array<{ device_id: string; avatar_url: string | null }>) {
          next[row.device_id] = row.avatar_url ?? null;
        }
        return next;
      });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}