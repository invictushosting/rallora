"use client";

import { useState, type FormEvent } from "react";
import styles from "./platform.module.css";

type Props = { clubId: string; clubName: string; onSaved: () => void };

export default function OwnerAccess({ clubId, clubName, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const formId = `owner-access-${clubId}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (!window.confirm(`Give ${String(fields.get("email"))} owner access to ${clubName}? No invitation email will be sent.`)) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/platform/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_owner", clubId, ownerEmail: fields.get("email"), ownerPassword: fields.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not set up owner access.");
      form.reset();
      setMessage(data.ownerCreated
        ? "Owner account created and club access assigned. No invitation was sent. Share access details securely when ready."
        : "Existing account linked as owner. Its password is unchanged. No invitation was sent.");
      onSaved();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Could not set up owner access.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.ownerAccess}>
    <button className={styles.ownerAccessToggle} type="button" aria-expanded={open} aria-controls={formId}
      disabled={busy} onClick={() => setOpen(value => !value)}>
      {open ? "Close owner setup" : "Set up owner access"}
    </button>
    {open && <form id={formId} onSubmit={save} className={styles.ownerAccessForm}>
      <p>Create or link an owner for this existing club. This does not create another club or send an email.</p>
      <label>Owner email<input name="email" type="email" autoComplete="off" required /></label>
      <label>Temporary password for a new account
        <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} />
        <small>Leave blank if the account already exists. Existing passwords are preserved.</small>
      </label>
      <button className={styles.ownerAccessSubmit} type="submit" disabled={busy}>
        {busy ? "Setting up…" : "Create or link owner"}
      </button>
    </form>}
    {message && <p className={styles.ownerAccessNotice} data-tone={failed ? "error" : "success"} role={failed ? "alert" : "status"}>{message}</p>}
  </div>;
}
