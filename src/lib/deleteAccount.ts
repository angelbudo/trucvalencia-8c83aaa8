/**
 * Client wrapper for the `delete-account` edge function.
 *
 * Compleix dos requisits:
 *  1. Google Play Store (User Data deletion, exigit des de 2024).
 *  2. Dret de supressió RGPD (art. 17).
 *
 * S'usa des de:
 *  - `Ajustes.tsx` → botó "Esborrar les meues dades" dins de l'app.
 *  - `EsborrarDades.tsx` → pàgina pública /esborrar-dades, l'enllaç que
 *    declarem a la fitxa de Google Play (data deletion URL).
 */
import { supabase } from "@/integrations/supabase/client";

export interface DeleteAccountResult {
  ok: true;
  dryRun?: boolean;
  deleted: Record<string, number>;
  anonymized: Record<string, number>;
}

export async function requestAccountDeletion(args: {
  deviceId: string;
  dryRun?: boolean;
}): Promise<DeleteAccountResult> {
  const { deviceId, dryRun = false } = args;
  if (!deviceId) throw new Error("deviceId requerit");

  // Dry-run: compte directament contra la BD (no depèn de cap Edge Function).
  if (dryRun) {
    const countFor = async (
      table: "player_profiles" | "room_players" | "sala_chat" | "room_text_chat",
    ): Promise<number> => {
      const { count, error } = await supabase
        .from(table)
        .select("device_id", { count: "exact", head: true })
        .eq("device_id", deviceId);
      if (error) return 0;
      return count ?? 0;
    };
    const [pp, rp, sc, rtc] = await Promise.all([
      countFor("player_profiles"),
      countFor("room_players"),
      countFor("sala_chat"),
      countFor("room_text_chat"),
    ]);
    return {
      ok: true,
      dryRun: true,
      deleted: {
        player_profiles: pp,
        room_players: rp,
        sala_chat: sc,
      },
      anonymized: {
        room_text_chat: rtc,
      },
    };
  }

  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { deviceId, dryRun },
  });
  if (error) throw new Error(error.message ?? "Error de xarxa");
  if (data && typeof data === "object" && "error" in data && (data as { error: unknown }).error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as DeleteAccountResult;
}

/** Esborra completament les dades locals (localStorage) del dispositiu.
 *  Es crida després d'un esborrat servidor exitós dins de l'app per deixar
 *  el dispositiu en estat "primera obertura". */
export function wipeLocalDeviceData(): void {
  if (typeof window === "undefined") return;
  try {
    // Esborrem totes les claus de l'app (prefixades amb "truc:").
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("truc:")) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    /* noop — entorns sense localStorage (mode privat estricte) */
  }
}