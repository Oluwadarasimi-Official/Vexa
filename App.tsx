import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, Check, CheckCheck, ChevronLeft, CircleUserRound, Clock3, Copy, Flame,
  Hash, LogOut, Menu, MessageCircle, MoreHorizontal, Paperclip, Search, Send,
  Settings, Shield, Sparkles, UserPlus, Users, X, Zap, Camera, Edit3, Lock, Bell, Palette, SlidersHorizontal, ChevronRight, Save, Image as ImageIcon, UserRound, Globe2, CheckCircle2
} from 'lucide-react'
import { Session, RealtimeChannel } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'

type Profile = { id: string; username: string; created_at: string; last_seen_at: string | null; profile_name?: string | null; bio?: string | null; avatar_url?: string | null; updated_at?: string | null; show_activity?: boolean; read_receipts?: boolean; notifications_enabled?: boolean }
type Room = { id: string; user_a: string; user_b: string; created_at: string }
type Message = { id: string; room_id: string; sender_id: string; content: string; created_at: string; delivered_at: string | null; read_at: string | null; vaporized_at: string | null }
type Request = { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }
type Connection = { id: string; user_a: string; user_b: string; created_at: string }

type Notice = { kind: 'success' | 'error' | 'info'; text: string }

const usernamePattern = /^[A-Za-z]{3,20}$/
const internalEmail = (username: string) => `${username.toLowerCase()}@vexa.local`
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'VX'
const timeAgo = (date: string | null) => {
  if (!date) return 'offline'
  const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  if (s < 45) return 'online'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.kind === 'error' ? 5000 : 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); setLoading(false); return }
    let alive = true
    const load = async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (alive) {
        if (error) setNotice({ kind: 'error', text: error.message })
        setProfile(data)
        setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(() => supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', session.user.id), 30000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [session])

  if (!supabaseConfigured) return <ConfigScreen />
  if (loading) return <Splash />
  if (!session || !profile) return <AuthScreen notice={notice} setNotice={setNotice} />
  return <Shell profile={profile} setProfile={setProfile} setNotice={setNotice} notice={notice} />
}

function ConfigScreen() {
  return <div className="center-screen"><div className="config-card"><div className="brand"><span className="brand-mark"><Zap size={19}/></span><b>VEXA</b></div><h1>Connect Vexa to Supabase</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to Vercel Environment Variables, then redeploy.</p><div className="config-note"><Shield size={17}/> Your publishable/anon key belongs in the browser; never expose a Supabase service-role key.</div></div></div>
}
function Splash() { return <div className="center-screen"><div className="splash"><div className="pulse-mark"><Zap/></div><b>VEXA</b><span>Private realtime conversations.</span></div></div> }

function AuthScreen({ notice, setNotice }: { notice: Notice | null; setNotice: (n: Notice | null) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setNotice(null)
    const clean = username.trim()
    if (!usernamePattern.test(clean)) return setNotice({ kind: 'error', text: 'Username must be 3–20 letters only.' })
    if (password.length < 6) return setNotice({ kind: 'error', text: 'Password must be at least 6 characters.' })
    setBusy(true)
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email: internalEmail(clean), password, options: { data: { username: clean } } })
      : await supabase.auth.signInWithPassword({ email: internalEmail(clean), password })
    setBusy(false)
    if (result.error) return setNotice({ kind: 'error', text: result.error.message })
    if (mode === 'signup' && !result.data.session) setNotice({ kind: 'info', text: 'Account created. If your project still requires email confirmation, disable Confirm email in Supabase Auth.' })
  }

  return <div className="auth-page"><div className="auth-grid"/><div className="auth-panel"><div className="brand auth-brand"><span className="brand-mark"><Zap size={19}/></span><b>VEXA</b></div><div className="eyebrow"><span/> PRIVATE NETWORK</div><h1>Talk without the noise.</h1><p className="lead">A classic realtime space for people who value direct conversations, privacy and control.</p>{notice && <Notice notice={notice}/>}<form onSubmit={submit} className="auth-form"><label>USERNAME<input autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value.replace(/[^A-Za-z]/g, ''))} placeholder="YourUsername" maxLength={20}/></label><label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/></label><button className="primary full" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Enter Vexa' : 'Create account'}<Zap size={17}/></button></form><button className="switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setNotice(null) }}>{mode === 'login' ? 'New here? Create a username' : 'Already have an account? Sign in'}</button><div className="auth-foot"><Shield size={14}/> No email, phone, OTP or profile verification required.</div></div></div>
}

function Shell({ profile, setProfile, notice, setNotice }: { profile: Profile; setProfile: (p: Profile) => void; notice: Notice | null; setNotice: (n: Notice | null) => void }) {
  const [tab, setTab] = useState<'chats' | 'connections' | 'discover' | 'random' | 'profile' | 'settings'>('chats')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [mobileMenu, setMobileMenu] = useState(false)
  const [setupOpen, setSetupOpen] = useState(!profile.profile_name)

  const refreshRooms = async () => {
    const { data } = await supabase.from('chat_rooms').select('*').or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`).order('created_at', { ascending: false })
    setRooms(data || [])
    const ids = (data || []).map(r => r.user_a === profile.id ? r.user_b : r.user_a)
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('*').in('id', ids)
      setProfiles(Object.fromEntries((ps || []).map(p => [p.id, p])))
    }
  }
  useEffect(() => { refreshRooms() }, [profile.id])
  useEffect(() => {
    const ch = supabase.channel('vexa-shell-rooms').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => refreshRooms()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile.id])

  const openRoom = (room: Room) => { setSelectedRoom(room); setTab('chats'); setMobileMenu(false) }
  const other = selectedRoom ? profiles[selectedRoom.user_a === profile.id ? selectedRoom.user_b : selectedRoom.user_a] : null
  const navigate = (next: typeof tab) => { setTab(next); setSelectedRoom(null); setMobileMenu(false) }
  const saveProfile = (next: Profile) => { setProfile(next); setSetupOpen(false) }

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={() => setMobileMenu(!mobileMenu)}><Menu/></button>
      <div className="brand"><span className="brand-mark"><Zap size={17}/></span><b>VEXA</b></div>
      <div className="top-center"><span className="status-dot"/> encrypted realtime</div>
      <div className="top-actions">
        <button className="top-profile" onClick={() => navigate('profile')}><Avatar profile={profile} size="sm"/><span>{profile.profile_name || profile.username}</span></button>
        <button className="icon-btn" onClick={() => navigate('settings')} title="Settings"><Settings/></button>
        <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Log out"><LogOut/></button>
      </div>
    </header>
    <div className="workspace">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <button className="side-profile side-profile-button" onClick={() => navigate('profile')}>
          <Avatar profile={profile}/><div><strong>{profile.profile_name || profile.username}</strong><span><i/> @{profile.username}</span></div><ChevronRight className="side-chevron"/>
        </button>
        <nav className="nav">
          <NavButton icon={<MessageCircle/>} text="Chats" active={tab === 'chats'} badge={rooms.length} onClick={() => navigate('chats')}/>
          <NavButton icon={<Users/>} text="Connections" active={tab === 'connections'} onClick={() => navigate('connections')}/>
          <NavButton icon={<Search/>} text="Discover" active={tab === 'discover'} onClick={() => navigate('discover')}/>
          <NavButton icon={<Zap/>} text="Random Pair" active={tab === 'random'} onClick={() => navigate('random')}/>
        </nav>
        <div className="side-bottom">
          <div className="privacy-card"><Shield size={16}/><div><b>Private by design</b><span>Realtime conversations protected by Supabase RLS.</span></div></div>
          <NavButton icon={<UserRound/>} text="My profile" active={tab === 'profile'} onClick={() => navigate('profile')}/>
          <NavButton icon={<Settings/>} text="Settings" active={tab === 'settings'} onClick={() => navigate('settings')}/>
        </div>
      </aside>
      <main className="content">
        {tab === 'chats' && !selectedRoom && <ChatList rooms={rooms} profiles={profiles} profile={profile} openRoom={openRoom}/>} 
        {tab === 'chats' && selectedRoom && other && <ChatRoom room={selectedRoom} me={profile} other={other} back={() => setSelectedRoom(null)} setNotice={setNotice}/>} 
        {tab === 'connections' && <Connections me={profile} openRoom={openRoom} refreshRooms={refreshRooms} setNotice={setNotice}/>} 
        {tab === 'discover' && <Discover me={profile} openRoom={openRoom} refreshRooms={refreshRooms} setNotice={setNotice}/>} 
        {tab === 'random' && <RandomPair me={profile} openRoom={openRoom} refreshRooms={refreshRooms} setNotice={setNotice}/>} 
        {tab === 'profile' && <ProfilePage profile={profile} rooms={rooms} onEdit={() => setSetupOpen(true)}/>} 
        {tab === 'settings' && <SettingsPage profile={profile} setProfile={setProfile} setNotice={setNotice}/>} 
      </main>
    </div>
    {setupOpen && <ProfileSetup profile={profile} onClose={() => setSetupOpen(false)} onSaved={saveProfile} setNotice={setNotice}/>}
    <nav className="mobile-nav" aria-label="Primary navigation">
      <button className={tab === 'chats' ? 'active' : ''} onClick={() => navigate('chats')}><MessageCircle/><span>Chats</span></button>
      <button className={tab === 'discover' ? 'active' : ''} onClick={() => navigate('discover')}><Search/><span>Discover</span></button>
      <button className={tab === 'random' ? 'active' : ''} onClick={() => navigate('random')}><Zap/><span>Random</span></button>
      <button className={tab === 'connections' ? 'active' : ''} onClick={() => navigate('connections')}><Users/><span>Network</span></button>
      <button className={tab === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><CircleUserRound/><span>Profile</span></button>
    </nav>
    {notice && <div className="floating-notice"><Notice notice={notice}/><button onClick={() => setNotice(null)}><X size={15}/></button></div>}
  </div>
}

function Avatar({ profile, size = 'md' }: { profile: Profile; size?: 'sm'|'md'|'lg' }) {
  const name = profile.profile_name || profile.username
  return profile.avatar_url
    ? <img className={`avatar avatar-image ${size}`} src={profile.avatar_url} alt={name}/>
    : <div className={`avatar ${size}`}>{initials(name)}</div>
}

function NavButton({ icon, text, active, badge, onClick }: {icon: React.ReactNode;text:string;active:boolean;badge?:number;onClick:()=>void}) { return <button className={`nav-row ${active?'active':''}`} onClick={onClick}>{icon}<span>{text}</span>{badge ? <em>{badge}</em> : null}</button> }
function Notice({ notice }: { notice: Notice }) { return <div className={`notice ${notice.kind}`}><span>{notice.kind === 'success' ? <Check size={15}/> : notice.kind === 'error' ? <X size={15}/> : <Shield size={15}/>}</span>{notice.text}</div> }


function ProfileSetup({ profile, onClose, onSaved, setNotice }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void; setNotice: (n: Notice) => void }) {
  const [name, setName] = useState(profile.profile_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatar, setAvatar] = useState(profile.avatar_url || '')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const save = async () => {
    if (!name.trim()) return setNotice({kind:'error', text:'Enter a profile name.'})
    setBusy(true)
    const { data, error } = await supabase.from('profiles').update({ profile_name:name.trim(), bio:bio.trim() || null, avatar_url:avatar || null, updated_at:new Date().toISOString() }).eq('id',profile.id).select().single()
    setBusy(false)
    if (error) return setNotice({kind:'error',text:error.message})
    onSaved(data); setNotice({kind:'success',text:'Profile updated.'})
  }
  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setNotice({kind:'error',text:'Please choose an image file.'})
    if (file.size > 5 * 1024 * 1024) return setNotice({kind:'error',text:'Profile pictures must be under 5MB.'})
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'})
    if (error) { setBusy(false); return setNotice({kind:'error',text:`Photo upload failed: ${error.message}`}) }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${data.publicUrl}?v=${Date.now()}`
    const { data: saved, error: saveError } = await supabase.from('profiles').update({ avatar_url:url, updated_at:new Date().toISOString() }).eq('id',profile.id).select().single()
    setBusy(false)
    if (saveError) return setNotice({kind:'error',text:`Photo uploaded but could not save profile: ${saveError.message}`})
    setAvatar(url)
    onSaved(saved)
    setNotice({kind:'success',text:'Profile picture saved.'})
  }
  return <div className="modal-backdrop"><div className="setup-modal">
    <div className="setup-head"><div><span className="eyebrow">WELCOME TO VEXA</span><h2>Build your profile</h2><p>Choose how people will see you. Your username stays your unique account handle.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div>
    <div className="profile-editor">
      <button className="profile-photo-picker" onClick={()=>fileRef.current?.click()}><Avatar profile={{...profile,avatar_url:avatar,profile_name:name||profile.username}} size="lg"/><span><Camera/> Change photo</span></button>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>
      <label>PROFILE NAME<input value={name} onChange={e=>setName(e.target.value.slice(0,40))} placeholder="e.g. David Oluwadarasimi" maxLength={40}/></label>
      <label>BIO <span className="optional">optional</span><textarea value={bio} onChange={e=>setBio(e.target.value.slice(0,180))} placeholder="What do you build, love, or want people to know about you?" maxLength={180}/><small className="bio-counter">{bio.length}/180</small></label>
      <div className="handle-preview"><span>@{profile.username}</span><small>Your unique Vexa username</small></div>
    </div>
    <div className="modal-actions"><button className="secondary" onClick={onClose}>Skip for now</button><button className="primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save profile'}<Save/></button></div>
  </div></div>
}

function ProfilePage({ profile, rooms, onEdit }: { profile: Profile; rooms: Room[]; onEdit: () => void }) {
  return <section className="panel profile-page">
    <div className="profile-cover"><div className="cover-grid"/><div className="profile-hero"><Avatar profile={profile} size="lg"/><div className="profile-identity"><span className="eyebrow">VEXA MEMBER</span><h1>{profile.profile_name || profile.username}</h1><p>@{profile.username}</p></div><button className="secondary edit-profile" onClick={onEdit}><Edit3/> Edit profile</button></div></div>
    <div className="profile-body"><div className="profile-main"><div className="profile-section"><div className="section-label">ABOUT</div><p className="bio-text">{profile.bio || 'No bio yet. Tell people what you are about.'}</p></div><div className="profile-section"><div className="section-label">ACCOUNT</div><div className="profile-detail"><span>Username</span><b>@{profile.username}</b></div><div className="profile-detail"><span>Member since</span><b>{new Date(profile.created_at).toLocaleDateString([], {month:'long',year:'numeric'})}</b></div><div className="profile-detail"><span>Activity</span><b>{profile.last_seen_at ? timeAgo(profile.last_seen_at) : 'active'}</b></div></div></div><div className="profile-stats"><div><b>{rooms.length}</b><span>Chats</span></div><div><b>Private</b><span>Account</span></div><div><b>Live</b><span>Presence</span></div></div></div>
  </section>
}

function SettingsPage({ profile, setProfile, setNotice }: { profile: Profile; setProfile: (p: Profile)=>void; setNotice:(n:Notice)=>void }) {
  const [section,setSection]=useState<'profile'|'privacy'|'appearance'|'notifications'>('profile')
  const [name,setName]=useState(profile.profile_name||''); const [bio,setBio]=useState(profile.bio||''); const [avatar,setAvatar]=useState(profile.avatar_url||''); const [busy,setBusy]=useState(false); const fileRef=useRef<HTMLInputElement>(null)
  const [privacy,setPrivacy]=useState(profile.show_activity !== false)
  const [compact,setCompact]=useState(localStorage.getItem('vexa_compact')==='true')
  const [notifications,setNotifications]=useState(profile.notifications_enabled !== false)
  const [readReceipts,setReadReceipts]=useState(profile.read_receipts !== false)
  const [theme,setTheme]=useState(localStorage.getItem('vexa_theme') || 'dark')
  useEffect(()=>{ const resolved=theme==='system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : theme; document.documentElement.dataset.vexaTheme=resolved; localStorage.setItem('vexa_theme',theme) },[theme])
  const save=async()=>{setBusy(true);const {data,error}=await supabase.from('profiles').update({profile_name:name.trim()||null,bio:bio.trim()||null,avatar_url:avatar||null,updated_at:new Date().toISOString()}).eq('id',profile.id).select().single();setBusy(false);if(error)return setNotice({kind:'error',text:error.message});setProfile(data);setNotice({kind:'success',text:'Settings saved.'})}
  const savePreference=async(field:string,value:boolean)=>{const {data,error}=await supabase.from('profiles').update({[field]:value,updated_at:new Date().toISOString()}).eq('id',profile.id).select().single();if(error)return setNotice({kind:'error',text:error.message});setProfile(data);if(field==='show_activity')setPrivacy(value);if(field==='notifications_enabled')setNotifications(value);if(field==='read_receipts')setReadReceipts(value)}
  const upload=async(file:File)=>{if(!file.type.startsWith('image/'))return setNotice({kind:'error',text:'Please choose an image file.'});if(file.size>5*1024*1024)return setNotice({kind:'error',text:'Profile pictures must be under 5MB.'});setBusy(true);const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${profile.id}/avatar-${Date.now()}.${ext}`;const {error}=await supabase.storage.from('avatars').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});if(error){setBusy(false);return setNotice({kind:'error',text:`Photo upload failed: ${error.message}`})};const {data}=supabase.storage.from('avatars').getPublicUrl(path);const url=`${data.publicUrl}?v=${Date.now()}`;const {data:saved,error:saveError}=await supabase.from('profiles').update({avatar_url:url,updated_at:new Date().toISOString()}).eq('id',profile.id).select().single();setBusy(false);if(saveError)return setNotice({kind:'error',text:`Photo uploaded but could not save profile: ${saveError.message}`});setAvatar(url);setProfile(saved);setNotice({kind:'success',text:'Profile picture saved.'})}
  const toggle=(key:string,value:boolean,setter:(v:boolean)=>void)=>{setter(value);localStorage.setItem(key,String(value))}
  return <section className="panel settings-page"><div className="section-head"><div><span className="eyebrow">ACCOUNT CONTROL</span><h2>Settings</h2></div></div><div className="settings-layout"><aside className="settings-nav"><SettingsItem icon={<UserRound/>} label="Profile" active={section==='profile'} onClick={()=>setSection('profile')}/><SettingsItem icon={<Lock/>} label="Privacy" active={section==='privacy'} onClick={()=>setSection('privacy')}/><SettingsItem icon={<Bell/>} label="Notifications" active={section==='notifications'} onClick={()=>setSection('notifications')}/><SettingsItem icon={<Palette/>} label="Appearance" active={section==='appearance'} onClick={()=>setSection('appearance')}/></aside><div className="settings-content">
    {section==='profile'&&<><div className="settings-title"><h3>Profile</h3><p>Manage the identity people see across Vexa.</p></div><div className="settings-photo"><button className="profile-photo-picker" onClick={()=>fileRef.current?.click()}><Avatar profile={{...profile,avatar_url:avatar,profile_name:name||profile.username}} size="lg"/><span><Camera/> Change photo</span></button><div><b>Profile picture</b><p>JPG, PNG or WebP. Maximum 5MB.</p></div></div><input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/><label>PROFILE NAME<input value={name} onChange={e=>setName(e.target.value.slice(0,40))}/></label><label>USERNAME<div className="locked-field">@{profile.username}<Lock/></div></label><label>BIO<textarea value={bio} onChange={e=>setBio(e.target.value.slice(0,160))} maxLength={160} placeholder="Write a short bio…"/><small>{bio.length}/160</small></label><button className="primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save changes'}<Save/></button></>}
    {section==='privacy'&&<SettingsBlock title="Privacy" text="Control what activity information Vexa exposes." items={[['Show activity status','Allow connections to see when you were last active.',privacy,()=>savePreference('show_activity',!privacy)],['Read receipts','Show when you have read a message.',readReceipts,()=>savePreference('read_receipts',!readReceipts)]]}/>} 
    {section==='notifications'&&<SettingsBlock title="Notifications" text="Choose how this browser handles Vexa alerts." items={[['Realtime notifications','Allow notification prompts for important activity.',notifications,()=>savePreference('notifications_enabled',!notifications)],['Connection requests','Show request activity inside Vexa.',true,()=>{}]]}/>} 
    {section==='appearance'&&<><SettingsBlock title="Appearance" text="Vexa adapts to the way you use your device." items={[['Compact layout','Use tighter spacing in lists and chat.',compact,()=>{toggle('vexa_compact',!compact,setCompact);document.body.classList.toggle('compact-mode',!compact)}],['Dark interface','Use Vexa Black surfaces and neon depth.',theme==='dark',()=>setTheme(theme==='dark'?'light':'dark')]}]/><div className="theme-choice"><button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}>Vexa Black</button><button className={theme==='light'?'selected':''} onClick={()=>setTheme('light')}>Vexa White</button><button className={theme==='system'?'selected':''} onClick={()=>setTheme('system')}>System</button></div></>}
  </div></div></section>
}
function SettingsItem({icon,label,active,onClick}:{icon:React.ReactNode;label:string;active:boolean;onClick:()=>void}){return <button className={`settings-item ${active?'active':''}`} onClick={onClick}>{icon}<span>{label}</span><ChevronRight/></button>}
function SettingsBlock({title,text,items}:{title:string;text:string;items:[string,string,boolean,()=>void][]}){return <div className="settings-block"><div className="settings-title"><h3>{title}</h3><p>{text}</p></div>{items.map(([a,b,v,fn])=><div className="toggle-row" key={a}><div><b>{a}</b><span>{b}</span></div><button className={`toggle ${v?'on':''}`} onClick={fn}><span/></button></div>)}</div>}

function ChatList({ rooms, profiles, profile, openRoom }: {rooms:Room[];profiles:Record<string,Profile>;profile:Profile;openRoom:(r:Room)=>void}) {
  return <section className="panel"><div className="section-head"><div><span className="eyebrow">MESSAGES</span><h2>Your conversations</h2></div><button className="square-btn"><Search/></button></div>{rooms.length === 0 ? <Empty icon={<MessageCircle/>} title="No conversations yet" text="Find someone in Discover or use Random Pair to start a conversation."/> : <div className="room-list">{rooms.map(r => { const id=r.user_a===profile.id?r.user_b:r.user_a; const p=profiles[id]; return <button className="room-card" key={r.id} onClick={()=>openRoom(r)}><Avatar profile={p || {id:'',username:'VX',created_at:'',last_seen_at:null}}/><div className="room-copy"><b>{p?.username || 'Loading…'}</b><span>{p?.show_activity === false ? 'Vexa member' : p?.last_seen_at ? timeAgo(p.last_seen_at) : 'Vexa connection'}</span></div><ChevronLeft className="room-arrow"/></button>})}</div>}</section>
}

function ChatRoom({ room, me, other, back, setNotice }: {room:Room;me:Profile;other:Profile;back:()=>void;setNotice:(n:Notice)=>void}) {
  const [messages,setMessages]=useState<Message[]>([])
  const [text,setText]=useState('')
  const [typing,setTyping]=useState(false)
  const [online,setOnline]=useState(false)
  const [busy,setBusy]=useState(false)
  const bottom=useRef<HTMLDivElement>(null)
  const channelRef=useRef<RealtimeChannel|null>(null)
  const typingTimer=useRef<number|undefined>(undefined)

  const load = async () => {
    const {data,error}=await supabase.from('messages').select('*').eq('room_id',room.id).order('created_at',{ascending:true})
    if(error) return setNotice({kind:'error',text:error.message})
    setMessages(data||[])
    const unread=(data||[]).filter(m=>m.sender_id===other.id && !m.read_at).map(m=>m.id)
    if(unread.length) await supabase.from('messages').update({delivered_at:new Date().toISOString(), ...(me.read_receipts !== false ? {read_at:new Date().toISOString()} : {})}).in('id',unread)
  }
  useEffect(()=>{
    load()
    const ch=supabase.channel(`room:${room.id}`, {config:{presence:{key:me.id}}})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`room_id=eq.${room.id}`},payload=>{
        const m=payload.new as Message
        setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m])
        if(m.sender_id===other.id) supabase.from('messages').update({delivered_at:new Date().toISOString(), ...(me.read_receipts !== false ? {read_at:new Date().toISOString()} : {})}).eq('id',m.id)
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages',filter:`room_id=eq.${room.id}`},payload=>setMessages(prev=>prev.map(m=>m.id===payload.new.id?payload.new as Message:m)))
      .on('broadcast',{event:'typing'},payload=>setTyping(Boolean(payload.payload?.typing)))
      .on('presence',{event:'sync'},()=>setOnline(Object.values(ch.presenceState()).some((v:any[])=>v.some(x=>x.user_id===other.id))))
      .subscribe(async status=>{ if(status==='SUBSCRIBED') await ch.track({user_id:me.id}) })
    channelRef.current=ch
    return ()=>{ if(typingTimer.current) window.clearTimeout(typingTimer.current); supabase.removeChannel(ch); channelRef.current=null }
  },[room.id,me.id,other.id])
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages,typing])

  const send=async(e?:FormEvent)=>{
    e?.preventDefault(); const value=text.trim(); if(!value||busy)return
    setBusy(true); setText('')
    const {error}=await supabase.from('messages').insert({room_id:room.id,sender_id:me.id,content:value,delivered_at:new Date().toISOString()})
    setBusy(false); if(error){setText(value);setNotice({kind:'error',text:error.message})}
    channelRef.current?.send({type:'broadcast',event:'typing',payload:{typing:false}})
  }
  const change=(v:string)=>{setText(v);channelRef.current?.send({type:'broadcast',event:'typing',payload:{typing:true}});if(typingTimer.current)window.clearTimeout(typingTimer.current);typingTimer.current=window.setTimeout(()=>channelRef.current?.send({type:'broadcast',event:'typing',payload:{typing:false}}),1200)}
  const vaporize=async()=>{if(!confirm('Vaporize every message in this chat?'))return; const {error}=await supabase.rpc('vaporize_chat_room',{target_room_id:room.id}); if(error)setNotice({kind:'error',text:error.message});else setNotice({kind:'success',text:'Chat vaporized.'})}

  return <section className="chat-panel"><header className="chat-head"><button className="back-btn" onClick={back}><ChevronLeft/></button><Avatar profile={other} size="sm"/><div className="chat-person"><b>{other.username}</b><span><i className={online?'online':''}/>{online && other.show_activity !== false ? 'online' : other.show_activity === false ? 'offline' : other.last_seen_at ? `last seen ${timeAgo(other.last_seen_at)}` : 'offline'}</span></div><div className="chat-tools"><button className="icon-btn" onClick={vaporize} title="Vaporize chat"><Flame/></button><button className="icon-btn"><MoreHorizontal/></button></div></header><div className="messages"><div className="conversation-note"><Shield size={14}/> Messages are delivered through Vexa realtime.</div>{messages.map(m=><MessageBubble key={m.id} m={m} mine={m.sender_id===me.id}/>) }{typing&&<div className="typing"><span/><span/><span/> {other.username} is typing</div>}<div ref={bottom}/></div><form className="composer" onSubmit={send}><button type="button" className="icon-btn"><Paperclip/></button><input value={text} onChange={e=>change(e.target.value)} placeholder="Write a message…"/><button className="send-btn" disabled={busy||!text.trim()}><Send/></button></form></section>
}
function MessageBubble({m,mine}:{m:Message;mine:boolean}) { return <div className={`bubble-row ${mine?'mine':''}`}><div className={`bubble ${m.vaporized_at?'vaporized':''}`}><span>{m.content}</span><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}{mine&&<>{m.read_at?<CheckCheck className="receipt read"/>:m.delivered_at?<CheckCheck className="receipt"/>:<Check className="receipt"/>}</>}</small></div></div> }

function Connections({me,openRoom,refreshRooms,setNotice}:{me:Profile;openRoom:(r:Room)=>void;refreshRooms:()=>Promise<void>;setNotice:(n:Notice)=>void}) {
  const [requests,setRequests]=useState<Request[]>([]); const [connections,setConnections]=useState<Connection[]>([]); const [ps,setPs]=useState<Record<string,Profile>>({})
  const load=async()=>{const [{data:r},{data:c}]=await Promise.all([supabase.from('connection_requests').select('*').eq('receiver_id',me.id).eq('status','pending').order('created_at',{ascending:false}),supabase.from('connections').select('*').or(`user_a.eq.${me.id},user_b.eq.${me.id}`)]);setRequests(r||[]);setConnections(c||[]);const ids=[...(r||[]).map(x=>x.sender_id),...(c||[]).map(x=>x.user_a===me.id?x.user_b:x.user_a)];if(ids.length){const {data}=await supabase.from('profiles').select('*').in('id',[...new Set(ids)]);setPs(Object.fromEntries((data||[]).map(p=>[p.id,p])))}}
  useEffect(()=>{load();const ch=supabase.channel(`requests:${me.id}`).on('postgres_changes',{event:'*',schema:'public',table:'connection_requests',filter:`receiver_id=eq.${me.id}`},load).subscribe();return()=>{supabase.removeChannel(ch)}},[me.id])
  const accept=async(id:string)=>{const {error}=await supabase.rpc('accept_connection_request',{request_id:id});if(error)setNotice({kind:'error',text:error.message});else{setNotice({kind:'success',text:'Connection accepted.'});await load();await refreshRooms()}}
  const start=async(id:string)=>{let {data:r}=await supabase.from('chat_rooms').select('*').or(`and(user_a.eq.${me.id},user_b.eq.${id}),and(user_a.eq.${id},user_b.eq.${me.id})`).maybeSingle();if(!r){const {data:n,error}=await supabase.from('chat_rooms').insert({user_a:me.id,user_b:id}).select().single();if(error)return setNotice({kind:'error',text:error.message});r=n}await refreshRooms();if(r)openRoom(r)}
  return <section className="panel"><div className="section-head"><div><span className="eyebrow">NETWORK</span><h2>Connections</h2></div></div>{requests.length>0&&<div className="subsection"><div className="subhead">Pending requests <em>{requests.length}</em></div>{requests.map(r=><div className="person-row" key={r.id}><Avatar profile={ps[r.sender_id] || {id:'',username:'VX',created_at:'',last_seen_at:null}}/><div><b>{ps[r.sender_id]?.username||'User'}</b><span>wants to connect</span></div><div className="row-actions"><button className="primary compact" onClick={()=>accept(r.id)}><Check/> Accept</button></div></div>)}</div>}<div className="subsection"><div className="subhead">Your connections <em>{connections.length}</em></div>{connections.length===0?<Empty icon={<Users/>} title="No connections yet" text="Search a username in Discover to connect."/>:connections.map(c=>{const id=c.user_a===me.id?c.user_b:c.user_a;return <div className="person-row" key={c.id}><Avatar profile={ps[id] || {id:'',username:'VX',created_at:'',last_seen_at:null}}/><div><b>{ps[id]?.username||'User'}</b><span>connected</span></div><div className="row-actions"><button className="square-btn" onClick={()=>start(id)}><MessageCircle/></button></div></div>})}</div></section>
}

function Discover({me,openRoom,refreshRooms,setNotice}:{me:Profile;openRoom:(r:Room)=>void;refreshRooms:()=>Promise<void>;setNotice:(n:Notice)=>void}) {
  const [q,setQ]=useState('');const [results,setResults]=useState<Profile[]>([]);const [sent,setSent]=useState<Record<string,boolean>>({});
  useEffect(()=>{const t=window.setTimeout(async()=>{if(q.length<2){setResults([]);return}const {data}=await supabase.from('profiles').select('*').ilike('username',`${q}%`).neq('id',me.id).limit(12);setResults(data||[])},250);return()=>window.clearTimeout(t)},[q,me.id])
  const connect=async(id:string)=>{const {error}=await supabase.from('connection_requests').insert({sender_id:me.id,receiver_id:id});if(error)setNotice({kind:'error',text:error.code==='23505'?'Request already sent.':error.message});else{setSent(s=>({...s,[id]:true}));setNotice({kind:'success',text:'Connection request sent.'})}}
  const start=async(id:string)=>{let {data:r}=await supabase.from('chat_rooms').select('*').or(`and(user_a.eq.${me.id},user_b.eq.${id}),and(user_a.eq.${id},user_b.eq.${me.id})`).maybeSingle();if(!r){const {data:n,error}=await supabase.from('chat_rooms').insert({user_a:me.id,user_b:id}).select().single();if(error)return setNotice({kind:'error',text:error.message});r=n}await refreshRooms();if(r)openRoom(r)}
  return <section className="panel"><div className="section-head"><div><span className="eyebrow">DISCOVER</span><h2>Find people by username</h2></div></div><div className="search-box"><Search/><input value={q} onChange={e=>setQ(e.target.value.replace(/[^A-Za-z]/g,''))} placeholder="Search username…"/></div>{q.length<2?<Empty icon={<Search/>} title="Search Vexa" text="Type at least two letters to find a username."/>:results.length===0?<Empty icon={<CircleUserRound/>} title="No matches" text="Try another username."/>:<div className="person-list">{results.map(p=><div className="person-row" key={p.id}><Avatar profile={p}/><div><b>{p.username}</b><span>{p.last_seen_at?timeAgo(p.last_seen_at):'Vexa member'}</span></div><div className="row-actions"><button className="square-btn" onClick={()=>start(p.id)}><MessageCircle/></button><button className="primary compact" disabled={sent[p.id]} onClick={()=>connect(p.id)}>{sent[p.id]?'Sent':'Connect'}{!sent[p.id]&&<UserPlus/>}</button></div></div>)}</div>}</section>
}

function RandomPair({me,openRoom,refreshRooms,setNotice}:{me:Profile;openRoom:(r:Room)=>void;refreshRooms:()=>Promise<void>;setNotice:(n:Notice)=>void}) {
  const [searching,setSearching]=useState(false);const [matched,setMatched]=useState<Profile|null>(null);const [room,setRoom]=useState<Room|null>(null)
  const start=async()=>{setMatched(null);setRoom(null);setSearching(true);const {data,error}=await supabase.rpc('join_random_pair');if(error){setSearching(false);return setNotice({kind:'error',text:error.message})}if(data?.[0]?.room_id){const rid=data[0].room_id;const {data:r}=await supabase.from('chat_rooms').select('*').eq('id',rid).single();if(r){const id=r.user_a===me.id?r.user_b:r.user_a;const {data:p}=await supabase.from('profiles').select('*').eq('id',id).single();setRoom(r);setMatched(p);setSearching(false)}}}
  useEffect(()=>{const ch=supabase.channel(`match:${me.id}`).on('postgres_changes',{event:'*',schema:'public',table:'matchmaking_queue',filter:`user_id=eq.${me.id}`},async()=>{const {data:q}=await supabase.from('matchmaking_queue').select('*').eq('user_id',me.id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(q?.status==='matched'&&q.matched_user_id){const {data:r}=await supabase.from('chat_rooms').select('*').or(`and(user_a.eq.${me.id},user_b.eq.${q.matched_user_id}),and(user_a.eq.${q.matched_user_id},user_b.eq.${me.id})`).maybeSingle();if(r){const {data:p}=await supabase.from('profiles').select('*').eq('id',q.matched_user_id).single();setMatched(p);setRoom(r);setSearching(false)}}}).subscribe();return()=>{supabase.removeChannel(ch)}},[me.id])
  const cancel=async()=>{await supabase.from('matchmaking_queue').delete().eq('user_id',me.id).eq('status','waiting');setSearching(false)}
  return <section className="panel"><div className="section-head"><div><span className="eyebrow">RANDOM PAIR</span><h2>Meet someone online</h2></div></div><div className="random-card"><div className="random-orbit"><div className="orbit-core"><Zap/></div><span/><span/><span/></div>{matched?<><Avatar profile={matched} size="lg"/><h3>Paired with {matched.username}</h3><p>A realtime chat room is ready.</p><button className="primary" onClick={()=>{if(room)openRoom(room)}}>Open chat <MessageCircle/></button></>:searching?<><div className="searching"><span/><span/><span/></div><h3>Finding a Vexa user…</h3><p>We're looking for another available person.</p><button className="secondary" onClick={cancel}>Stop searching</button></>:<><h3>Random Pair</h3><p>Meet another available Vexa user without searching by name.</p><button className="primary" onClick={start}>Start pairing <Zap/></button></>}</div><div className="random-meta"><div><Shield/><span><b>Realtime</b> pairing</span></div><div><Users/><span><b>Username-free</b> discovery</span></div><div><Flame/><span><b>Vaporize</b> after chat</span></div></div></section>
}

function Empty({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) { return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div> }

export default App
