"use client";

import {useEffect,useState} from "react";
import styles from "./pilot.module.css";

const ACTION_ONE="https://images.unsplash.com/photo-1767128890583-b3f8dc30bdbc?auto=format&fit=crop&q=82&w=1400";
const ACTION_TWO="https://images.unsplash.com/photo-1753470955237-5621aa79c90c?auto=format&fit=crop&q=82&w=1400";

export default function SocialCarousel(){
  const [index,setIndex]=useState(0);
  const [touchStart,setTouchStart]=useState<number|null>(null);
  const count=4;
  useEffect(()=>{const timer=window.setInterval(()=>setIndex(value=>(value+1)%count),5500);return()=>window.clearInterval(timer)},[]);
  const go=(value:number)=>setIndex((value+count)%count);
  return <div className={styles.socialCarousel}>
    <div className={styles.carouselViewport}>
      <div className={styles.carouselTrack} style={{transform:"translateX(-"+(index*100)+"%)"}}
        onTouchStart={event=>setTouchStart(event.touches[0]?.clientX??null)}
        onTouchEnd={event=>{if(touchStart==null)return;const end=event.changedTouches[0]?.clientX??touchStart;const delta=end-touchStart;if(Math.abs(delta)>45)go(index+(delta<0?1:-1));setTouchStart(null)}}>
        <article className={styles.socialSlide}>
          <div className={styles.postTop}><div className={styles.clubMark}>PC</div><div><strong>Padel Club</strong><span>Premier Division · Matchday 6</span></div></div>
          <div className={styles.resultGraphic}><small>FINAL SCORE</small><div className={styles.teams}><span>Martínez / Evans</span><b>2</b><span>Shah / Wilson</span><b>1</b></div><strong>6–4&nbsp;&nbsp;3–6&nbsp;&nbsp;10–7</strong><em>RALLORA LEAGUE</em></div>
          <div className={styles.postCaption}><b>What a finish.</b><span> Three sets, a championship tiebreak and another brilliant league night at the club.</span></div>
        </article>
        <article className={styles.socialSlide+" "+styles.photoSlide}>
          <img src={ACTION_ONE} alt="Padel player jumping to strike the ball on court"/>
          <div className={styles.photoShade}/>
          <div className={styles.photoBrand}><span>PADEL CLUB · MATCHDAY 6</span><strong>POINT<br/>OF THE NIGHT.</strong><p>League action, captured and ready for the club feed.</p></div>
          <div className={styles.photoScore}><span>FINAL</span><b>2–1</b><small>Premier Division</small></div>
        </article>
        <article className={styles.socialSlide}>
          <div className={styles.fixtureGraphic}><small>NEXT UP · PREMIER DIVISION</small><span>THURSDAY · 19:30 · COURT 3</span><div><strong>Martínez / Evans</strong><em>VS</em><strong>Shah / Wilson</strong></div><p>Matchday graphics generated from the same fixture data your league already uses.</p><b>RALLORA LEAGUE</b></div>
          <div className={styles.postCaption}><b>Thursday night padel.</b><span> Who takes the points in our next Premier Division fixture?</span></div>
        </article>
        <article className={styles.socialSlide+" "+styles.photoSlide}>
          <img src={ACTION_TWO} alt="Padel player returning the ball on a blue outdoor court"/>
          <div className={styles.photoShade}/>
          <div className={styles.photoBrand}><span>CLUB MOMENTS</span><strong>YOUR PLAYERS.<br/>YOUR STORY.</strong><p>Mix action photography with fixtures, scores and club branding.</p></div>
          <div className={styles.photoTag}>SOCIAL STUDIO</div>
        </article>
      </div>
    </div>
    <button type="button" className={styles.carouselArrow+" "+styles.carouselPrev} onClick={()=>go(index-1)} aria-label="Previous social example">‹</button>
    <button type="button" className={styles.carouselArrow+" "+styles.carouselNext} onClick={()=>go(index+1)} aria-label="Next social example">›</button>
    <div className={styles.carouselDots} aria-label="Social Studio examples">{Array.from({length:count},(_,i)=><button key={i} type="button" className={i===index?styles.activeDot:""} onClick={()=>setIndex(i)} aria-label={"Show example "+(i+1)} aria-current={i===index?"true":undefined}/>)}</div>
  </div>;
}
