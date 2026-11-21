/** Browser-only artwork export. The rendered SVG is identical to the preview. */
export async function loadArtworkLogo(url = "/brand/rallora-logo-dark.svg", dimensions = {width:490,height:116}): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Could not load brand artwork."));image.src=url;});
  const canvas=document.createElement("canvas");canvas.width=dimensions.width;canvas.height=dimensions.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Artwork is unavailable in this browser.");
  const scale=Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  return canvas.toDataURL("image/png");
}
export async function downloadArtwork(svg:string,height:number,filename:string,isCurrent:()=>boolean=()=>true) {
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Could not render artwork."));image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;});
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Artwork is unavailable in this browser.");
  ctx.drawImage(image,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not prepare download.")),"image/png"));
  if(!isCurrent())throw new Error("This draft changed. Review it again before downloading.");
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
