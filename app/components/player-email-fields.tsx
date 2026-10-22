"use client";
import {useId} from "react";
import {isAppleRelayEmail} from "@/lib/player-emails";

type Props = {
  playtomic: string;
  contact: string;
  different: boolean;
  onPlaytomic: (value: string) => void;
  onContact: (value: string) => void;
  onDifferent: (value: boolean) => void;
  checkClass: string;
  noticeClass: string;
  partner?: boolean;
  contactReadOnly?: boolean;
};

export default function PlayerEmailFields(props: Props) {
  const id=useId();
  const relay=isAppleRelayEmail(props.playtomic);
  return <>
    <label>Playtomic email<input required type="email" maxLength={254} autoComplete="off" value={props.playtomic} onChange={e=>props.onPlaytomic(e.target.value)} aria-describedby={`${id}-help`}/><small id={`${id}-help`}>Enter the email shown in {props.partner?"your partner’s":"your"} Playtomic account. We use it to match {props.partner?"their":"your"} Playtomic details when the club connects. {!props.contactReadOnly&&"We’ll also use it for Rallora emails unless you choose another address."}</small></label>
    {relay&&!props.contactReadOnly?<aside className={props.noticeClass} role="status"><strong>Apple private email detected</strong><p>Apple created this address for Playtomic, so it may block Rallora emails. Enter {props.partner?"your partner’s usual":"your usual"} email below for {props.partner?"invitations and league updates":"Rallora sign-in, verification and league updates"}. We’ll keep the Apple address for Playtomic.</p></aside>:!props.contactReadOnly&&<label className={props.checkClass}><input type="checkbox" checked={props.different} onChange={e=>props.onDifferent(e.target.checked)} aria-controls={`${id}-contact`}/> {props.partner?"My partner uses":"I use"} a different email for Rallora</label>}
    {(relay||props.different||props.contactReadOnly)&&<label id={`${id}-contact`}>Rallora email<input required type="email" maxLength={254} autoComplete={props.partner?"off":"email"} readOnly={props.contactReadOnly} value={props.contact} onChange={e=>props.onContact(e.target.value)}/><small>{props.partner?"Invitations and league updates go here.":"Use this address to sign in to Rallora and receive verification emails and league updates."}</small></label>}
  </>;
}
