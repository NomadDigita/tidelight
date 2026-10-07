"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function ProfileEditor({userId,initialName,initialHandle,initialAvatar,profileExists,handleChangedAt}:{userId:string;initialName:string;initialHandle:string;initialAvatar:string;profileExists:boolean;handleChangedAt:string|null}) {
 const [name,setName]=useState(initialName);const [handle,setHandle]=useState(initialHandle);const canChangeUsername=!profileExists||!handleChangedAt||Date.now()>=Date.parse(handleChangedAt)+90*24*60*60*1000;const [avatar,setAvatar]=useState(initialAvatar);const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");const [error,setError]=useState("");
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice("");setError("");
  try{const supabase=createClient();let url=avatar;
   if(file){if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>3*1024*1024)throw new Error("Use a PNG, JPG, or WebP image up to 3 MB.");const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";const path=userId+"/profile."+ext;
    const {error:upErr}=await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(upErr)throw new Error(upErr.message);
    url=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;setAvatar(url);
   }
   const cleanHandle=handle.toLowerCase();if(!/^[a-z0-9]{4,8}$/.test(cleanHandle))throw new Error("Choose a username with 4–8 letters or numbers.");if(profileExists&&cleanHandle!==initialHandle&&!canChangeUsername)throw new Error("Your username can be changed once every three months.");
   const {error:saveErr}=await supabase.from("community_profiles").upsert({id:userId,handle:cleanHandle,display_name:name.trim(),avatar_url:url||null,bio:"",handle_changed_at:profileExists?handleChangedAt??new Date().toISOString():new Date().toISOString()},{onConflict:"id"});
   if(saveErr)throw new Error(saveErr.code==="23505"?"That username is already in use. Choose another one.":saveErr.message);
   setFile(null);setNotice("Your Your Tidelight profile is saved.");
  }catch(err){setError(err instanceof Error?err.message:"Profile could not be saved.");}finally{setBusy(false)}
 }
 return <form className="profile-editor" onSubmit={save}>
  <div className="profile-editor-avatar">{avatar?<img src={avatar} alt="Your profile"/>:<span>{name.slice(0,1).toUpperCase()||"T"}</span>}</div>
  <div className="profile-editor-fields"><label>Display name<input value={name} maxLength={48} onChange={e=>setName(e.target.value)} required/></label><label>USERNAME<input value={handle} maxLength={8} disabled={!canChangeUsername&&profileExists} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8))} pattern="[a-zA-Z0-9]{4,8}" title="Use 4–8 letters or numbers" required/><small>{!canChangeUsername&&profileExists&&handleChangedAt?"Username changes unlock "+new Date(Date.parse(handleChangedAt)+90*24*60*60*1000).toLocaleDateString():"4–8 letters or numbers · can change once every 3 months"}</small></label><label className="profile-upload">Profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/><small>{file?file.name:"PNG, JPG, or WebP · up to 3 MB"}</small></label><button type="submit" disabled={busy}>{busy?"Saving…":"Save profile"}</button></div>
  {notice?<p className="community-toast" role="status">{notice}</p>:null}{error?<p className="community-error" role="alert">{error}</p>:null}
 </form>
}
