"use client";

import { useState } from "react";
import type { createClient } from "@/lib/supabase";
import styles from "../admin.module.css";

type Entry = {
  id: string;
  captain_name: string;
  partner_name: string;
  captain_playtomic_rating: number | null;
  partner_playtomic_rating: number | null;
  updated_at: string;
};

type Props = {
  request: Entry;
  supabase: ReturnType<typeof createClient>;
  disabled: boolean;
  onBusy: (value: boolean) => void;
  onSaved: () => Promise<void>;
};

export default function EntryRatingEditor({ request, supabase, disabled, onBusy, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [captain, setCaptain] = useState("");
  const [partner, setPartner] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState("");

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    onBusy(true);
    try {
      const reply = await supabase.rpc("rallora_admin_update_entry_ratings", {
        p_application_id: request.id,
        p_captain_rating: Number(captain),
        p_partner_rating: Number(partner),
        p_expected_updated_at: version,
      });
      if (reply.error) {
        setError(reply.error.message);
        return;
      }
      await onSaved();
      setEditing(false);
    } catch {
      setError("Could not save ratings. Check your connection and try again.");
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  if (!editing) return <div className={`${styles.actionRow} ${styles.registrationActions}`}>
    <button type="button" disabled={disabled} onClick={() => {
      setCaptain(request.captain_playtomic_rating?.toString() ?? "");
      setPartner(request.partner_playtomic_rating?.toString() ?? "");
      setVersion(request.updated_at);
      setError("");
      setEditing(true);
    }}>Edit ratings</button>
  </div>;

  return <form className={styles.ratingEditor} onSubmit={save} aria-label={`Edit ratings for ${request.captain_name} and ${request.partner_name}`}>
    <p>Set each player’s league rating (0–7). This updates Rallora only. Existing groups and fixtures stay as they are.</p>
    <label htmlFor={`captain-rating-${request.id}`}>{request.captain_name}
      <input id={`captain-rating-${request.id}`} type="number" min="0" max="7" step="0.01" required inputMode="decimal" value={captain} disabled={disabled || saving} onChange={event => setCaptain(event.target.value)} />
    </label>
    <label htmlFor={`partner-rating-${request.id}`}>{request.partner_name}
      <input id={`partner-rating-${request.id}`} type="number" min="0" max="7" step="0.01" required inputMode="decimal" value={partner} disabled={disabled || saving} onChange={event => setPartner(event.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
    <div className={`${styles.actionRow} ${styles.registrationActions}`}>
      <button type="submit" disabled={disabled || saving}>{saving ? "Saving…" : "Save ratings"}</button>
      <button type="button" disabled={disabled || saving} onClick={() => setEditing(false)}>Cancel</button>
    </div>
  </form>;
}
