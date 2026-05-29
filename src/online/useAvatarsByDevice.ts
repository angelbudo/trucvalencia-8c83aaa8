import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resol avatar_url públic per a un conjunt de device_ids via RPC.
 * Reutilitzat per pantalles que mostren seients (Sala, Lobby, etc.).
 */
export function useAvatarsByDevice(
  deviceIds: string[],
  userIdsByDevice: Record<string, string | null> = {},
): Record<string, string | null> {
  const [map, setMap] = useState<Record<string, string | null>>({});
  const key = Array.from(new Set(deviceIds.filter(Boolean)))
    .sort()
    .join("|");
  const userKey = Object.entries(userIdsByDevice)
    .filter(([deviceId, userId]) => deviceId && userId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deviceId, userId]) => `${deviceId}:${userId}`)
    .join("|");
  useEffect(() => {
    const ids = Array.from(new Set(deviceIds.filter(Boolean)));
    if (ids.length === 0) {
      setMap({});
      return;
    }
    let alive = true;
    (async () => {
      const next: Record<string, string | null> = {};
      const { data, error } = await supabase.rpc("get_public_avatars_by_devices", {
        p_device_ids: ids,
      });
      if (!error && data) {
        for (const row of data as Array<{ device_id: string; avatar_url: string | null }>) {
          next[row.device_id] = row.avatar_url ?? null;
        }
      }

      const missing = ids.filter((id) => !next[id]);
      await Promise.all(
        missing.map(async (id) => {
          let avatarUrl: string | null = null;
          try {
            const { data: profile } = await supabase.rpc("get_public_player_profile_by_device", {
              p_device_id: id,
            });
            const row = Array.isArray(profile) ? profile[0] : profile;
            avatarUrl = (row as { avatar_url?: string | null } | undefined)?.avatar_url ?? null;
          } catch {
            avatarUrl = null;
          }

          const userId = userIdsByDevice[id];
          if (!avatarUrl && userId) {
            try {
              const { data: profile } = await supabase.rpc("get_public_player_profile_by_user_id", {
                p_user_id: userId,
              });
              const row = Array.isArray(profile) ? profile[0] : profile;
              avatarUrl = (row as { avatar_url?: string | null } | undefined)?.avatar_url ?? null;
            } catch {
              avatarUrl = null;
            }
          }

          next[id] = avatarUrl;
        }),
      );

      if (alive) setMap(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userKey]);
  return map;
}
