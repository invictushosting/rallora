"use client";

import { useMemo, useState } from "react";
import {
  PAYMENT_METHODS, type PaymentMethodKey,
  canShowRegistrationMethod, type CollectionOption,
} from "@/lib/leagues/payments";
import styles from "./payment-setup.module.css";

type PrizeType = "cash" | "non_cash" | "mixed";
const MANUAL: readonly PaymentMethodKey[] = ["bank_transfer","cash_at_club"];

/**
 * This preview contains no account credentials, bank numbers, registration
 * writer, payment link, billing API or persistent financial records.
 */
type Season = { id: string; name: string; status: string };
export default function PaymentSetup({ clubName,seasons }:{
  clubName:string;seasons:Season[];
}) {
  const [seasonId,setSeasonId] = useState("");
  const [manualMethods,setManualMethods] = useState<PaymentMethodKey[]>([]);
  const [prizeType,setPrizeType] = useState<PrizeType>("cash");
  const [nonCash,setNonCash] = useState("");
  const [terms,setTerms] = useState("");
  const [refundTerms,setRefundTerms] = useState("");
  const [confirmation,setConfirmation] = useState(false);
  const [message,setMessage] = useState("");
  const chosenSeason = seasons.find(season=>season.id===seasonId);

  const prizeDescriptionRequired = prizeType !== "cash";
  const termsReady = confirmation && terms.trim().length>=20 &&
    refundTerms.trim().length>=20 &&
    (!prizeDescriptionRequired || nonCash.trim().length>=8);
  const ready = useMemo(() => manualMethods.map(key => ({
    key,readiness:"approved",clubEnabled:true,
    seasonEnabled:true,termsPublished:termsReady,
    merchantReady:false,
  } satisfies CollectionOption)),[manualMethods,termsReady]);
  const visible = ready.filter(canShowRegistrationMethod);

  function toggle(key: PaymentMethodKey) {
    if (!MANUAL.includes(key)) return;
    setManualMethods(existing => existing.includes(key)
      ? existing.filter(item=>item!==key) : [...existing,key]);
    setMessage("");
  }
  function buildBrief() {
    const result = [
      `${clubName} · ${chosenSeason?.name??"Illustrative new competition"} · Example entry setup`,
      "DRAFT PREVIEW · NOT AVAILABLE TO PLAYERS",
      "Collection options: " + (manualMethods.map(key=>
        PAYMENT_METHODS.find(item=>item.key===key)?.label).filter(Boolean).join(", ")||"None selected"),
      "Prize types: " + (prizeType==="cash"?"Cash":
        prizeType==="mixed"?"Cash and non-cash":"Non-cash"),
      ...(prizeDescriptionRequired ? ["Proposed non-cash prizes: "+nonCash.trim()]:[]),
      "Entry terms: "+terms.trim(),
      "Refund/cancellation terms: "+refundTerms.trim(),
    ].join("\n");
    void navigator.clipboard.writeText(result).then(()=>{
      setMessage("Example draft copied. No payment instructions were published.");
    }).catch(()=>{
      setMessage("Copy blocked by the browser. Nothing was published.");
    });
  }
  return <section className={styles.root} aria-labelledby="methods-heading">
    <header className={styles.intro}>
      <span>RALLORA LEAGUES · COLLECTION METHODS</span>
      <h2 id="methods-heading">Choose how your club wants to collect entry fees.</h2>
      <p>Clubs can plan manual collections now and explore approved merchant
        checkout options later. This screen is a setup preview only.
        No bank details, card numbers or account passwords are collected.</p>
      <strong>NOT ACTIVE · NO PLAYER CHECKOUT OR PAYMENT STATUS CHANGES</strong>
    </header>
    <div className={styles.content}>
      <section aria-labelledby="manual-heading">
        <label className={styles.field}>Competition to plan
          <select className={styles.season} value={seasonId}
            onChange={event=>{
              setSeasonId(event.target.value);
              setManualMethods([]); setPrizeType("cash"); setNonCash("");
              setTerms("");setRefundTerms("");setConfirmation(false);setMessage("");
            }}>
            <option value="">Illustrative new competition</option>
            {seasons.map(season=><option key={season.id} value={season.id}>
              {season.name} · {season.status}</option>)}
          </select>
          <small>This is a preview for one competition at a time.
            Switching season resets the example, without saving data.</small>
        </label>
        <span className={styles.step}>01 / CLUB-MANAGED OPTIONS</span>
        <h3 id="manual-heading">Manual collection</h3>
        <p className={styles.help}>These will require an organiser to check a
          genuine receipt before marking an entry as paid. Selecting one here
          does not activate it for any season or player.</p>
        <div className={styles.methods}>
          {PAYMENT_METHODS.filter(method=>method.group==="club_managed")
            .map(method=><label className={styles.method} key={method.key}>
              <input type="checkbox"
                checked={manualMethods.includes(method.key)}
                onChange={()=>toggle(method.key)} />
              <span><strong>{method.label}</strong>
                <small>{method.description}</small></span>
            </label>)}
        </div>
        <span className={styles.step}>02 / FUTURE CONNECTED CHECKOUT</span>
        <h3>Merchant account integrations</h3>
        <div className={styles.methods}>
          {PAYMENT_METHODS.filter(method=>method.group==="integrated")
            .map(method=><article className={styles.method} key={method.key}>
              <span className={styles.future}>PLANNED</span>
              <span><strong>{method.label}</strong>
                <small>{method.description}</small></span>
            </article>)}
        </div>
        <p className={styles.help}>These providers are potential integrations,
          not approved or connected merchant accounts. Cash-prize eligibility,
          merchant onboarding and transaction charges need separate confirmation.
          Rallora will not present a player with an unavailable checkout button.</p>
      </section>
      <section aria-labelledby="prize-heading">
        <span className={styles.step}>03 / PRIZE FORMAT</span>
        <h3 id="prize-heading">Prizes are not always cash.</h3>
        <div className={styles.choices} role="group" aria-label="Prize type">
          {([["cash","Cash"],["non_cash","Physical prizes / vouchers"],
            ["mixed","Cash + other prizes"]] as [PrizeType,string][])
            .map(([key,label])=><button type="button" key={key}
              aria-pressed={prizeType===key}
              onClick={()=>setPrizeType(key)}>{label}</button>)}
        </div>
        {prizeDescriptionRequired&&<label className={styles.field}>
          Describe the non-cash prizes
          <textarea rows={3} maxLength={500} value={nonCash}
            onChange={event=>setNonCash(event.target.value)}
            placeholder="Example: two padel rackets and four coaching sessions, provided by club sponsor…" />
          <small>Non-cash prizes are not added to the cash pot. Publish
            descriptions and conditions separately before entry opens.</small>
        </label>}
        <span className={styles.step}>04 / PLAYER-FACING TERMS</span>
        <h3>Prepare clear competition rules</h3>
        <label className={styles.field}>Entry and eligibility
          <textarea rows={3} maxLength={1200} value={terms}
            onChange={event=>setTerms(event.target.value)}
            placeholder="Who can enter, cost and whether the price is per player or pair, entry deadline…" />
        </label>
        <label className={styles.field}>Refund and cancellation terms
          <textarea rows={3} maxLength={1200} value={refundTerms}
            onChange={event=>setRefundTerms(event.target.value)}
            placeholder="What happens if a pair withdraws, event is cancelled, or numbers are too low…" />
        </label>
        <label className={styles.confirm}><input type="checkbox"
          checked={confirmation} onChange={event=>setConfirmation(event.target.checked)} />
          I understand this is only a preview, not published entry rules
          or an approved payment setup.</label>
        <button className={styles.copy} type="button"
          disabled={!termsReady || !manualMethods.length}
          onClick={buildBrief}>Copy sample setup brief ↓</button>
        {message&&<p role="status" className={styles.feedback}>{message}</p>}
        <aside className={styles.example}>
          <span className={styles.step}>PLAYER EXPERIENCE · FUTURE PREVIEW</span>
          <h4>Choose how to pay {clubName}
            {chosenSeason?` · ${chosenSeason.name}`:""}</h4>
          {visible.length
            ? visible.map(method=><div key={method.key}>
              <strong>{PAYMENT_METHODS.find(x=>x.key===method.key)?.label}</strong>
              <small>Club-managed · payment verification required</small>
            </div>)
            : <p>No player-facing methods are active. Complete the
              real season setup, approval and published terms first.</p>}
          <p><b>After registration:</b> Payment pending → independently
            reconciled → Entry confirmed. Registration alone never counts
            as money collected.</p>
        </aside>
      </section>
    </div>
  </section>;
}
