"use client";
import {useEffect,useState} from "react";
import {registrationWindowState,type RegistrationWindow} from "../registration-window";

/** Recheck at the exact deadline and when a sleeping/backgrounded tab returns. */
export function useRegistrationWindow(window:RegistrationWindow|null|undefined){
 const [now,setNow]=useState(()=>Date.now());
 const opens=window?.registration_opens_at,closes=window?.registration_closes_at;
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  function refresh(){
   clearTimeout(timer);
   const current=Date.now();setNow(current);
   const next=[opens,closes].filter(Boolean).map(value=>Date.parse(value!)+1).filter(value=>value>current).sort((a,b)=>a-b)[0];
   if(next!==undefined)timer=setTimeout(refresh,Math.min(next-current,2147483647));
  }
  refresh();globalThis.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
  return()=>{clearTimeout(timer);globalThis.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh)};
 },[opens,closes]);
 return registrationWindowState(window,now);
}
