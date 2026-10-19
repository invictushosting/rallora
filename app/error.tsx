"use client";

import RecoveryScreen from "./components/recovery-screen";

export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <RecoveryScreen retry={reset}/>;
}
