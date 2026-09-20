"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_PRIZE_ESTIMATE,estimatePrizeBudget,formatMinor,
  type EntryUnit,type PotMode,type SupportedCurrency,
} from "@/lib/leagues/prize-budget";
import styles from "./prize-planner.module.css";

type Season = { id:string; name:string; teams:number; status:string };
type AmountKey = "entryPence" | "providerFeePence" | "platformFeePence" |
  "sponsorPence" | "guaranteedPotPence";
type NumberKey = "paidTeams" | "playersPerTeam" | "prizeSharePct" |
  "winnerPct" | "runnerUpPct";
function parsePence(input:string):number {
  const value = Number(input);
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000
    ? Math.round(value * 100) : Number.NaN;
}
function moneyInput(pence:number):string {
  return Number.isFinite(pence) ? String(pence/100) : "";
}

/** Club-only, read-only projection. Does not create registrations or take payments. */
export default function PrizePlanner({ clubName,seasons }:{
  clubName:string; seasons:Season[];
}) {
  const [seasonId,setSeasonId] = useState("");
  const [currency,setCurrency] = useState<SupportedCurrency>("GBP");
  const [entryUnit,setEntryUnit] = useState<EntryUnit>("team");
  const [freeEntry,setFreeEntry] = useState(true);
  const [paidTeams,setPaidTeams] = useState(0);
  const [playersPerTeam,setPlayersPerTeam] = useState(2);
  const [entryPence,setEntryPence] = useState(2500);
  const [providerFeePence,setProviderFeePence] = useState(0);
  const [platformFeePence,setPlatformFeePence] = useState(0);
  const [potMode,setPotMode] = useState<PotMode>("no_prize");
  const [prizeSharePct,setPrizeSharePct] = useState(80);
  const [sponsorPence,setSponsorPence] = useState(0);
  const [guaranteedPotPence,setGuaranteedPotPence] = useState(0);
  const [winnerPct,setWinnerPct] = useState(60);
  const [runnerUpPct,setRunnerUpPct] = useState(30);
  const season = seasons.find(s=>s.id===seasonId);
  const projectedTeamCount = season?.teams ?? 0;
  const draft = {
    ...DEFAULT_PRIZE_ESTIMATE,currency,entryUnit,
    paidTeams,playersPerTeam,
    entryPence:freeEntry?0:entryPence,
    providerFeePence:freeEntry?0:providerFeePence,
    platformFeePence:freeEntry?0:platformFeePence,
    sponsorPence,potMode,prizeSharePct,guaranteedPotPence,
    winnerPct,runnerUpPct,
  };
  const outcome = useMemo(()=>{
    try {
      return { value:estimatePrizeBudget(draft),error:"" };
    } catch (err) {
      return { value:null,error:err instanceof Error
        ? err.message:"Please review the budget inputs." };
    }
  },[currency,entryUnit,paidTeams,playersPerTeam,entryPence,freeEntry,
    providerFeePence,platformFeePence,sponsorPence,potMode,prizeSharePct,
    guaranteedPotPence,winnerPct,runnerUpPct]);

  function cashField(label:string,key:AmountKey,value:number,
    update:(pence:number)=>void,help?:string) {
    return <label className={styles.field} key={key}>
      <span>{label}</span>
      <div className={styles.currencyField}>
        <span>{currency}</span>
        <input type="number" min="0" max="1000000" step="0.01"
          disabled={freeEntry && ["entryPence","providerFeePence","platformFeePence"].includes(key)}
          value={moneyInput(value)} onChange={event=>
            update(parsePence(event.target.value))}
          aria-label={label} />
      </div>
      {help && <small>{help}</small>}
    </label>;
  }
  function numberField(label:string,key:NumberKey,value:number,
    update:(next:number)=>void,max=100) {
    return <label className={styles.field} key={key}>
      <span>{label}</span>
      <input type="number" min="0" max={max} step="1"
        value={Number.isFinite(value)?value:""}
        onChange={event=>update(Number(event.target.value))} />
    </label>;
  }
  const funded = outcome.value;
  return <section className={styles.wrap} aria-labelledby="entry-title">
    <div className={styles.intro}>
      <span>RALLORA LEAGUES · ENTRY & PRIZE POTS</span>
      <h2 id="entry-title">Plan free or paid competitions.</h2>
      <p>Model season entry fees, potential prize funding and organiser costs
        for {clubName}. Nothing here charges a player, creates an invoice
        or records a payment.</p>
      <strong>PLANNING PREVIEW · NO PAYMENT COLLECTION ENABLED</strong>
    </div>
    <div className={styles.content}>
      <div className={styles.form}>
        <div className={styles.stage}>01 / COMPETITION & ENTRY</div>
        <label className={styles.field}><span>Competition season</span>
          <select value={seasonId} onChange={event=>{
            const id=event.target.value;
            setSeasonId(id);
            setPaidTeams(seasons.find(s=>s.id===id)?.teams??0);
          }}>
            <option value="">Illustrative new competition</option>
            {seasons.map(s=><option key={s.id} value={s.id}>
              {s.name} · {s.status} · {s.teams} teams</option>)}
          </select>
        </label>
        <div className={styles.choice} role="group" aria-label="Entry pricing">
          <button type="button" aria-pressed={freeEntry}
            onClick={()=>setFreeEntry(true)}>Free entry</button>
          <button type="button" aria-pressed={!freeEntry}
            onClick={()=>setFreeEntry(false)}>Paid entry</button>
        </div>
        <div className={styles.row}>
          <label className={styles.field}><span>Currency</span>
            <select value={currency} onChange={event=>
              setCurrency(event.target.value as SupportedCurrency)}>
              <option value="GBP">GBP · £</option>
              <option value="EUR">EUR · €</option>
              <option value="USD">USD · $</option>
            </select>
          </label>
          <label className={styles.field}><span>Entry charged per</span>
            <select value={entryUnit} disabled={freeEntry}
              onChange={event=>setEntryUnit(event.target.value as EntryUnit)}>
              <option value="team">Team / pair</option>
              <option value="player">Player</option>
            </select>
          </label>
        </div>
        <div className={styles.row}>
          {cashField("Entry price", "entryPence",freeEntry?0:entryPence,
            setEntryPence,freeEntry?"Free entry selected.":undefined)}
          {numberField("Expected paying teams","paidTeams",paidTeams,
            setPaidTeams,10000)}
        </div>
        <p className={styles.help}>Currency changes the display and entry denomination,
          not an exchange rate. The paying team count is an estimate,
          not a count of confirmed transactions.
          {season && ` ${season.name} currently has ${projectedTeamCount} teams.
            That roster size is not evidence that anyone has paid.`}</p>
        {entryUnit==="player"&&!freeEntry&&
          numberField("Charged players per team","playersPerTeam",
            playersPerTeam,setPlayersPerTeam,8)}
        <div className={styles.stage}>02 / PRIZE FUNDING</div>
        <label className={styles.field}><span>Prize approach</span>
          <select value={potMode} onChange={event=>
            setPotMode(event.target.value as PotMode)}>
            <option value="no_prize">No prize pot</option>
            <option value="entry_percentage">Percentage of net entry receipts + sponsor funds</option>
            <option value="guaranteed">Fixed guaranteed prize pot</option>
          </select>
        </label>
        {potMode==="entry_percentage"&&
          numberField("Net entry income reserved for prizes (%)",
            "prizeSharePct",prizeSharePct,setPrizeSharePct)}
        {potMode==="guaranteed"&&
          cashField("Promised total prize pot","guaranteedPotPence",
            guaranteedPotPence,setGuaranteedPotPence)}
        {cashField("Additional sponsor contribution","sponsorPence",
          sponsorPence,setSponsorPence,
          "A pledged amount for planning, not money confirmed in an account.")}
        <div className={styles.stage}>03 / ESTIMATED COSTS & SPLIT</div>
        <div className={styles.row}>
          {cashField("Payment provider cost per charge","providerFeePence",
            freeEntry?0:providerFeePence,setProviderFeePence)}
          {cashField("Rallora fee per charge (unconfirmed)","platformFeePence",
            freeEntry?0:platformFeePence,setPlatformFeePence)}
        </div>
        <p className={styles.help}>Both costs default to zero, NOT a quotation.
          No Rallora transaction fee or provider has been approved yet.
          Fees may differ by payment method, refunds and location.</p>
        {potMode!=="no_prize"&&<div className={styles.row}>
          {numberField("Winners (%)","winnerPct",winnerPct,setWinnerPct)}
          {numberField("Runners-up (%)","runnerUpPct",runnerUpPct,setRunnerUpPct)}
        </div>}
        {potMode!=="no_prize"&&<p className={styles.help}>
          Remaining percentage goes to third place or the club’s named
          final prize position. The club must publish the real prize terms.</p>}
      </div>
      <div className={styles.output}>
        <span className={styles.stage}>PROJECTED SEASON BUDGET</span>
        <h3>{season?.name??"New competition preview"}</h3>
        <span className={styles.pill}>NOT RECEIVED · NOT HELD BY RALLORA</span>
        {outcome.error&&<p role="alert" className={styles.error}>
          {outcome.error}</p>}
        {funded&&<>
          <div className={styles.heroNumber}>
            <span>Projected prize pot</span>
            <strong>{formatMinor(funded.prizePotPence,currency)}</strong>
            <small>{potMode==="no_prize"?"No prizes configured.":
              potMode==="guaranteed"?"Fixed commitment even if fewer players enter.":
              "Depends on entry income and pledged sponsor funds."}</small>
          </div>
          <dl className={styles.breakdown}>
            <div><dt>Estimated chargeable entries</dt>
              <dd>{funded.chargeableEntries}</dd></div>
            <div><dt>Entry income</dt>
              <dd>{formatMinor(funded.grossPence,currency)}</dd></div>
            <div><dt>Estimated provider costs</dt>
              <dd>−{formatMinor(funded.processingPence,currency)}</dd></div>
            <div><dt>Estimated platform costs</dt>
              <dd>−{formatMinor(funded.platformPence,currency)}</dd></div>
            <div><dt>Entry income after costs</dt>
              <dd>{formatMinor(funded.netEntryPence,currency)}</dd></div>
            <div><dt>Pledged sponsor contribution</dt>
              <dd>{formatMinor(funded.sponsorPence,currency)}</dd></div>
            <div className={styles.total}><dt>Club balance / surplus</dt>
              <dd>{formatMinor(funded.clubBalancePence,currency)}</dd></div>
            {funded.organiserTopUpPence>0&&
              <div className={styles.shortfall}><dt>Organiser must contribute</dt>
                <dd>{formatMinor(funded.organiserTopUpPence,currency)}</dd></div>}
          </dl>
          {potMode!=="no_prize"&&<div className={styles.payouts}>
            <strong>Illustrative prize split</strong>
            <p>Winners <b>{formatMinor(funded.winnerPence,currency)}</b></p>
            <p>Runners-up <b>{formatMinor(funded.runnerUpPence,currency)}</b></p>
            <p>Remaining place <b>{formatMinor(funded.thirdPlacePence,currency)}</b></p>
          </div>}
          <p className={styles.disclaimer}>This is a scenario only. Confirmed
            payments, refunds, disputed payments, sponsor receipts and real
            payouts will require a separate auditable ledger. Nothing is owed,
            collected, reserved or paid through this screen.</p>
        </>}
      </div>
    </div>
  </section>;
}
