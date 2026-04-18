'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──
type Task = { id: string; label: string }
type Package = { id: string; name: string; icon: string; color: string; tasks: Task[] }
type Patient = { id: string; bed: string; name: string; packages: string[]; routineTasks: Task[]; customTasks: Task[] }
type Checked = Record<string, Record<string, boolean>>

// ── Defaults ──
const DEFAULT_PACKAGES: Package[] = [
  { id:'pkg_cancer', name:'癌症', icon:'🎗️', color:'#7C3AED', tasks:[
    {id:'c1',label:'疼痛評估（NRS 量表）'},
    {id:'c2',label:'化療副作用評估（噁心/嘔吐/口腔潰瘍）'},
    {id:'c3',label:'PICC/Port-A 管路護理'},
    {id:'c4',label:'白血球低下感染徵象監測'},
    {id:'c5',label:'營養狀態評估 / 體重記錄'},
    {id:'c6',label:'心理支持 / 情緒評估'},
  ]},
  { id:'pkg_diabetes', name:'糖尿病', icon:'💉', color:'#0891B2', tasks:[
    {id:'d1',label:'血糖監測（AC/PC）'},
    {id:'d2',label:'胰島素注射核對'},
    {id:'d3',label:'足部皮膚評估'},
    {id:'d4',label:'低血糖徵象觀察'},
    {id:'d5',label:'飲食衛教記錄'},
  ]},
  { id:'pkg_stroke', name:'腦中風', icon:'🧠', color:'#DC2626', tasks:[
    {id:'s1',label:'神經學評估（GCS/肌力/瞳孔）'},
    {id:'s2',label:'吞嚥功能評估（進食安全）'},
    {id:'s3',label:'壓瘡預防翻身記錄'},
    {id:'s4',label:'深部靜脈血栓預防'},
    {id:'s5',label:'復健治療配合記錄'},
  ]},
  { id:'pkg_cardiac', name:'心臟病', icon:'❤️', color:'#E11D48', tasks:[
    {id:'h1',label:'心電圖監測 / 心律觀察'},
    {id:'h2',label:'血壓 / 心跳記錄（每4小時）'},
    {id:'h3',label:'水分攝入/排出記錄'},
    {id:'h4',label:'胸痛評估記錄'},
    {id:'h5',label:'水腫程度評估'},
  ]},
]

const DEFAULT_ROUTINE: Task[] = [
  {id:'r1',label:'生命徵象量測'},
  {id:'r2',label:'給藥核對（Five Rights）'},
  {id:'r3',label:'床邊安全確認（床欄/呼叫鈴）'},
  {id:'r4',label:'翻身擺位記錄'},
  {id:'r5',label:'輸入/輸出量記錄'},
  {id:'r6',label:'護理記錄完成'},
]

const COLORS = ['#1A3C5E','#0891B2','#7C3AED','#DC2626','#D97706','#059669','#E11D48','#9333EA']
const PKG_ICONS = ['📋','🎗️','💉','🧠','❤️','🫁','🦴','💊','🩺','🩸','🧬','⚕️','🔬','🩹','🧪']

function uid() { return Math.random().toString(36).slice(2,9) }

// ── Storage via API ──
async function loadKey(key: string) {
  try {
    const res = await fetch(`/api/data?key=${key}`)
    const json = await res.json()
    return json.value ?? null
  } catch { return null }
}

async function saveKey(key: string, value: unknown) {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
  } catch (e) { console.error('save failed', e) }
}

// ── Components ──
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:999,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxWidth:430,maxHeight:'88vh',overflowY:'auto',padding:'16px 18px 44px'}}>
        <div style={{width:36,height:4,background:'#E2E8F0',borderRadius:2,margin:'0 auto 14px'}}/>
        <div style={{display:'flex',alignItems:'center',marginBottom:16}}>
          <span style={{fontWeight:800,fontSize:16,color:'#0F172A',flex:1}}>{title}</span>
          <button onClick={onClose} style={{background:'#F1F5F9',border:'none',borderRadius:'50%',width:32,height:32,fontSize:15,cursor:'pointer',color:'#64748B'}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{background:'#F1F5F9',borderRadius:99,height:7,overflow:'hidden'}}>
      <div style={{width:`${pct}%`,background:pct===100?'#22C55E':'linear-gradient(90deg,#1A3C5E,#3B82F6)',height:'100%',borderRadius:99,transition:'width 0.5s ease'}}/>
    </div>
  )
}

function SaveIndicator({ status }: { status: 'idle'|'saving'|'saved'|'error' }) {
  if (status === 'idle') return null
  const map = {
    saving: { text:'儲存中...', color:'#64748B', bg:'#F1F5F9' },
    saved:  { text:'✓ 已儲存', color:'#16A34A', bg:'#DCFCE7' },
    error:  { text:'⚠ 儲存失敗', color:'#DC2626', bg:'#FEE2E2' },
  }
  const s = map[status]
  return (
    <div style={{position:'fixed',top:72,right:12,zIndex:200,background:s.bg,color:s.color,
      fontSize:12,fontWeight:700,padding:'6px 12px',borderRadius:99,boxShadow:'0 2px 8px rgba(0,0,0,0.1)',
      transition:'all 0.3s'}}>
      {s.text}
    </div>
  )
}

// ── Main App ──
export default function App() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [packages, setPackages] = useState<Package[]>(DEFAULT_PACKAGES)
  const [routineTpl, setRoutineTpl] = useState<Task[]>(DEFAULT_ROUTINE)
  const [checked, setChecked] = useState<Checked>({})
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle')

  const [view, setView] = useState<'home'|'patient'|'packages'|'routine'>('home')
  const [activePid, setActivePid] = useState<string|null>(null)
  const [modal, setModal] = useState<string|null>(null)
  const [ctx, setCtx] = useState<Record<string,string>>({})
  const [fText, setFText] = useState('')
  const [fText2, setFText2] = useState('')
  const [fIcon, setFIcon] = useState('📋')
  const [fColor, setFColor] = useState(COLORS[0])

  const saveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  // ── Load from Supabase on mount ──
  useEffect(() => {
    (async () => {
      const [p, pkg, r, c] = await Promise.all([
        loadKey('patients'),
        loadKey('packages'),
        loadKey('routine'),
        loadKey('checked'),
      ])
      if (p) setPatients(p)
      if (pkg) setPackages(pkg)
      if (r) setRoutineTpl(r)
      if (c) setChecked(c)
      setLoaded(true)
    })()
  }, [])

  // ── Auto-save whenever state changes ──
  const triggerSave = useCallback((key: string, value: unknown) => {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveKey(key, value)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 800)
  }, [])

  const setAndSavePatients = (v: Patient[] | ((prev: Patient[]) => Patient[])) => {
    setPatients(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      triggerSave('patients', next)
      return next
    })
  }
  const setAndSavePackages = (v: Package[] | ((prev: Package[]) => Package[])) => {
    setPackages(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      triggerSave('packages', next)
      return next
    })
  }
  const setAndSaveRoutine = (v: Task[] | ((prev: Task[]) => Task[])) => {
    setRoutineTpl(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      triggerSave('routine', next)
      return next
    })
  }
  const setAndSaveChecked = (v: Checked | ((prev: Checked) => Checked)) => {
    setChecked(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      triggerSave('checked', next)
      return next
    })
  }

  const closeModal = () => { setModal(null); setCtx({}); setFText(''); setFText2('') }
  const activePatient = patients.find(p => p.id === activePid) ?? null

  const updatePatient = (id: string, patch: Partial<Patient>) => {
    setAndSavePatients(prev => prev.map(p => p.id === id ? {...p,...patch} : p))
  }

  const toggleCheck = (pid: string, key: string) => {
    setAndSaveChecked(prev => ({
      ...prev,
      [pid]: { ...(prev[pid]||{}), [key]: !(prev[pid]||{})[key] }
    }))
  }

  const calcProgress = (pt: Patient) => {
    const c = checked[pt.id] || {}
    const pkgKeys = (pt.packages||[]).flatMap(pkgId =>
      (packages.find(p=>p.id===pkgId)?.tasks||[]).map(t=>`pkg_${pkgId}_${t.id}`)
    )
    const all = [
      ...(pt.routineTasks||[]).map(t=>`r_${t.id}`),
      ...(pt.customTasks||[]).map(t=>`cu_${t.id}`),
      ...pkgKeys,
    ]
    const done = all.filter(k=>c[k]).length
    return { done, total: all.length, pct: all.length ? Math.round(done/all.length*100) : 0 }
  }

  const inp: React.CSSProperties = {
    width:'100%',border:'1.5px solid #E2E8F0',borderRadius:11,padding:'11px 13px',
    fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit',
    color:'#1E293B',marginBottom:12,background:'#FAFAFA',
  }
  const btnPrimary = (color='#1A3C5E'): React.CSSProperties => ({
    width:'100%',background:color,color:'#fff',border:'none',borderRadius:11,
    padding:'13px',fontSize:14,fontWeight:800,cursor:'pointer',
  })

  // ── Modals ──
  const renderModal = () => {
    if (!modal) return null

    if (modal==='addPatient' || modal==='editPatient') {
      const isEdit = modal==='editPatient'
      return (
        <Modal title={isEdit?'編輯病人資料':'新增病人'} onClose={closeModal}>
          <label style={{fontSize:12,color:'#64748B',fontWeight:700,display:'block',marginBottom:5}}>床號 *</label>
          <input style={inp} value={fText} onChange={e=>setFText(e.target.value)} placeholder='如：01、A床、ICU-3' autoFocus/>
          <label style={{fontSize:12,color:'#64748B',fontWeight:700,display:'block',marginBottom:5}}>病人姓名（選填）</label>
          <input style={inp} value={fText2} onChange={e=>setFText2(e.target.value)} placeholder='姓名或代稱'/>
          <button style={btnPrimary()} onClick={()=>{
            if (!fText.trim()) return
            if (isEdit) {
              updatePatient(ctx.id, {bed:fText.trim(), name:fText2.trim()})
            } else {
              const np: Patient = {
                id:uid(), bed:fText.trim(), name:fText2.trim(),
                packages:[], routineTasks:routineTpl.map(t=>({...t,id:uid()})), customTasks:[],
              }
              setAndSavePatients(prev=>[...prev,np])
            }
            closeModal()
          }}>{isEdit?'儲存變更':'新增病人'}</button>
        </Modal>
      )
    }

    if (modal==='addPatientTask' || modal==='editPatientTask') {
      const isEdit = modal==='editPatientTask'
      const field = ctx.section==='routine' ? 'routineTasks' : 'customTasks'
      const pt = patients.find(p=>p.id===ctx.pid)
      return (
        <Modal title={isEdit?'編輯護理項目':'新增護理項目'} onClose={closeModal}>
          <input style={inp} value={fText} onChange={e=>setFText(e.target.value)} placeholder='輸入護理項目內容' autoFocus/>
          <button style={btnPrimary()} onClick={()=>{
            if (!fText.trim() || !pt) return
            if (isEdit) {
              updatePatient(ctx.pid, { [field]: (pt[field]||[]).map((t:Task)=>t.id===ctx.taskId?{...t,label:fText.trim()}:t) })
            } else {
              updatePatient(ctx.pid, { [field]: [...(pt[field]||[]), {id:uid(),label:fText.trim()}] })
            }
            closeModal()
          }}>{isEdit?'儲存':'新增'}</button>
        </Modal>
      )
    }

    if (modal==='addPkg' || modal==='editPkg') {
      const isEdit = modal==='editPkg'
      return (
        <Modal title={isEdit?'編輯套餐':'新增疾病套餐'} onClose={closeModal}>
          <label style={{fontSize:12,color:'#64748B',fontWeight:700,display:'block',marginBottom:5}}>套餐名稱 *</label>
          <input style={inp} value={fText} onChange={e=>setFText(e.target.value)} placeholder='如：癌症、腎病、骨折...' autoFocus/>
          <label style={{fontSize:12,color:'#64748B',fontWeight:700,display:'block',marginBottom:8}}>圖示</label>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
            {PKG_ICONS.map(ic=>(
              <button key={ic} onClick={()=>setFIcon(ic)} style={{width:38,height:38,fontSize:20,background:fIcon===ic?'#1A3C5E':'#F1F5F9',border:'none',borderRadius:9,cursor:'pointer',outline:fIcon===ic?'3px solid #93C5FD':'none'}}>{ic}</button>
            ))}
          </div>
          <label style={{fontSize:12,color:'#64748B',fontWeight:700,display:'block',marginBottom:8}}>主題色</label>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {COLORS.map(col=>(
              <button key={col} onClick={()=>setFColor(col)} style={{width:30,height:30,background:col,border:'none',outline:fColor===col?'3px solid #334155':'2px solid transparent',outlineOffset:2,borderRadius:'50%',cursor:'pointer'}}/>
            ))}
          </div>
          <button style={btnPrimary(fColor)} onClick={()=>{
            if (!fText.trim()) return
            if (isEdit) {
              setAndSavePackages(prev=>prev.map(p=>p.id===ctx.pkgId?{...p,name:fText.trim(),icon:fIcon,color:fColor}:p))
            } else {
              setAndSavePackages(prev=>[...prev,{id:uid(),name:fText.trim(),icon:fIcon,color:fColor,tasks:[]}])
            }
            closeModal()
          }}>{isEdit?'儲存套餐':`${fIcon} 建立套餐`}</button>
        </Modal>
      )
    }

    if (modal==='addPkgTask' || modal==='editPkgTask') {
      const isEdit = modal==='editPkgTask'
      const pkg = packages.find(p=>p.id===ctx.pkgId)
      return (
        <Modal title={isEdit?`編輯 ${pkg?.name} 要點`:`新增 ${pkg?.name} 護理要點`} onClose={closeModal}>
          <input style={inp} value={fText} onChange={e=>setFText(e.target.value)} placeholder='輸入護理要點' autoFocus/>
          <button style={btnPrimary(pkg?.color||'#1A3C5E')} onClick={()=>{
            if (!fText.trim()) return
            if (isEdit) {
              setAndSavePackages(prev=>prev.map(p=>p.id===ctx.pkgId?{...p,tasks:p.tasks.map(t=>t.id===ctx.taskId?{...t,label:fText.trim()}:t)}:p))
            } else {
              setAndSavePackages(prev=>prev.map(p=>p.id===ctx.pkgId?{...p,tasks:[...(p.tasks||[]),{id:uid(),label:fText.trim()}]}:p))
            }
            closeModal()
          }}>{isEdit?'儲存':'新增要點'}</button>
        </Modal>
      )
    }

    if (modal==='addRoutine' || modal==='editRoutine') {
      const isEdit = modal==='editRoutine'
      return (
        <Modal title={isEdit?'編輯常規項目':'新增常規項目'} onClose={closeModal}>
          <input style={inp} value={fText} onChange={e=>setFText(e.target.value)} placeholder='輸入護理項目' autoFocus/>
          <button style={btnPrimary()} onClick={()=>{
            if (!fText.trim()) return
            if (isEdit) setAndSaveRoutine(prev=>prev.map(t=>t.id===ctx.taskId?{...t,label:fText.trim()}:t))
            else setAndSaveRoutine(prev=>[...prev,{id:uid(),label:fText.trim()}])
            closeModal()
          }}>{isEdit?'儲存':'新增'}</button>
        </Modal>
      )
    }

    return null
  }

  // ── Views ──
  if (!loaded) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F0F4F8',flexDirection:'column',gap:12}}>
        <div style={{fontSize:40}}>🏥</div>
        <div style={{fontSize:14,color:'#64748B',fontWeight:700}}>載入資料中...</div>
        <div style={{fontSize:12,color:'#94A3B8'}}>從雲端同步</div>
      </div>
    )
  }

  const HomeView = () => (
    <div style={{padding:'14px 16px'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:14}}>
        <span style={{fontWeight:800,fontSize:15,color:'#0F172A',flex:1}}>今日病人床位</span>
        <button onClick={()=>{setFText('');setFText2('');setModal('addPatient')}} style={{background:'#1A3C5E',color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>＋ 新增病人</button>
      </div>
      {patients.length===0&&(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#94A3B8'}}>
          <div style={{fontSize:52}}>🛏️</div>
          <div style={{fontSize:15,fontWeight:600,marginTop:10,color:'#64748B'}}>尚無病人</div>
          <div style={{fontSize:13,marginTop:4}}>點擊「新增病人」開始建立床位</div>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {patients.map(pt=>{
          const {done,total,pct}=calcProgress(pt)
          const assignedPkgs=(pt.packages||[]).map(id=>packages.find(p=>p.id===id)).filter(Boolean) as Package[]
          return (
            <div key={pt.id} onClick={()=>{setActivePid(pt.id);setView('patient')}}
              style={{background:'#fff',borderRadius:16,padding:'14px 16px',cursor:'pointer',
                boxShadow:'0 2px 8px rgba(0,0,0,0.06)',border:'1px solid #E2E8F0',
                borderLeft:`5px solid ${pct===100?'#22C55E':'#1A3C5E'}`}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{background:pct===100?'#DCFCE7':'#EFF6FF',color:pct===100?'#16A34A':'#1A3C5E',borderRadius:10,padding:'6px 14px',fontWeight:900,fontSize:18,minWidth:56,textAlign:'center'}}>{pt.bed}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:'#0F172A'}}>{pt.name||'（未命名）'}</div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:5}}>
                    {assignedPkgs.map(pkg=>(
                      <span key={pkg.id} style={{background:pkg.color+'18',color:pkg.color,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99,border:`1px solid ${pkg.color}33`}}>{pkg.icon} {pkg.name}</span>
                    ))}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:20,fontWeight:900,color:pct===100?'#22C55E':'#1A3C5E'}}>{pct}%</div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>{done}/{total}</div>
                </div>
              </div>
              <ProgressBar pct={pct}/>
            </div>
          )
        })}
      </div>
    </div>
  )

  const PatientView = () => {
    const pt = patients.find(p=>p.id===activePid)
    if (!pt) return null
    const c = checked[pt.id]||{}
    const {done,total,pct}=calcProgress(pt)
    const assignedPkgs=(pt.packages||[]).map(id=>packages.find(p=>p.id===id)).filter(Boolean) as Package[]

    const TaskItem = ({taskKey,label,onEdit,onDelete}:{taskKey:string;label:string;onEdit?:()=>void;onDelete?:()=>void}) => {
      const isDone=!!c[taskKey]
      return (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:isDone?'#F8FAFC':'#fff',border:'1px solid #E2E8F0',borderRadius:10,marginBottom:6,opacity:isDone?0.6:1}}>
          <button onClick={()=>toggleCheck(pt.id,taskKey)} style={{width:24,height:24,borderRadius:'50%',flexShrink:0,cursor:'pointer',border:'none',background:isDone?'#22C55E':'#E2E8F0',color:'#fff',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.2s'}}>{isDone?'✓':''}</button>
          <span style={{flex:1,fontSize:13,color:isDone?'#94A3B8':'#334155',textDecoration:isDone?'line-through':'none',lineHeight:1.4}}>{label}</span>
          {onEdit&&<button onClick={onEdit} style={{background:'none',border:'none',color:'#CBD5E1',cursor:'pointer',fontSize:15,padding:'0 2px'}}>✏️</button>}
          {onDelete&&<button onClick={onDelete} style={{background:'none',border:'none',color:'#CBD5E1',cursor:'pointer',fontSize:14,padding:'0 2px'}}>🗑</button>}
        </div>
      )
    }

    const SectionHeader = ({label,color,onAdd}:{label:string;color:string;onAdd?:()=>void}) => (
      <div style={{display:'flex',alignItems:'center',marginBottom:9}}>
        <div style={{width:4,height:16,background:color,borderRadius:2,marginRight:8,flexShrink:0}}/>
        <span style={{fontWeight:800,fontSize:13,color:'#1E293B',flex:1}}>{label}</span>
        {onAdd&&<button onClick={onAdd} style={{background:color+'1A',color:color,border:'none',borderRadius:8,padding:'4px 11px',fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ 新增</button>}
      </div>
    )

    return (
      <div style={{padding:'14px 16px'}}>
        <div style={{background:'linear-gradient(135deg,#1A3C5E,#1D4ED8)',borderRadius:18,padding:'18px',marginBottom:16,color:'#fff'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
            <div style={{background:'rgba(255,255,255,0.2)',borderRadius:12,padding:'8px 18px',fontWeight:900,fontSize:22}}>{pt.bed}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:17}}>{pt.name||'（未命名）'}</div>
              <div style={{fontSize:12,opacity:0.75,marginTop:2}}>{total} 項護理任務</div>
            </div>
            <button onClick={()=>{setFText(pt.bed);setFText2(pt.name||'');setCtx({id:pt.id});setModal('editPatient')}} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:9,color:'#fff',fontSize:12,padding:'6px 11px',cursor:'pointer',fontWeight:600}}>✏️ 編輯</button>
          </div>
          <div style={{fontSize:12,opacity:0.9,marginBottom:6}}>完成進度 {done}/{total}（{pct}%）</div>
          <div style={{background:'rgba(255,255,255,0.2)',borderRadius:99,height:9,overflow:'hidden'}}>
            <div style={{width:`${pct}%`,background:pct===100?'#4ADE80':'#93C5FD',height:'100%',borderRadius:99,transition:'width 0.5s'}}/>
          </div>
        </div>

        <div style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:'1px solid #E2E8F0'}}>
          <SectionHeader label='🗂 疾病套餐分配' color='#6D28D9'/>
          {packages.length===0&&<div style={{fontSize:12,color:'#94A3B8'}}>尚無套餐，請至「套餐管理」建立</div>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {packages.map(pkg=>{
              const on=(pt.packages||[]).includes(pkg.id)
              return (
                <button key={pkg.id} onClick={()=>{
                  const cur=pt.packages||[]
                  updatePatient(pt.id,{packages:on?cur.filter(x=>x!==pkg.id):[...cur,pkg.id]})
                }} style={{background:on?pkg.color:'#F8FAFC',color:on?'#fff':pkg.color,border:`2px solid ${pkg.color}`,borderRadius:99,padding:'7px 14px',fontSize:13,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}>{pkg.icon} {pkg.name}</button>
              )
            })}
          </div>
        </div>

        <div style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:'1px solid #E2E8F0'}}>
          <SectionHeader label='常規護理項目' color='#1A3C5E' onAdd={()=>{setFText('');setCtx({pid:pt.id,section:'routine'});setModal('addPatientTask')}}/>
          {(pt.routineTasks||[]).length===0&&<div style={{fontSize:12,color:'#94A3B8',paddingLeft:12}}>尚無項目</div>}
          {(pt.routineTasks||[]).map(task=>(
            <TaskItem key={task.id} taskKey={`r_${task.id}`} label={task.label}
              onEdit={()=>{setFText(task.label);setCtx({pid:pt.id,section:'routine',taskId:task.id});setModal('editPatientTask')}}
              onDelete={()=>updatePatient(pt.id,{routineTasks:(pt.routineTasks||[]).filter(t=>t.id!==task.id)})}
            />
          ))}
        </div>

        {assignedPkgs.map(pkg=>(
          <div key={pkg.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:`1px solid ${pkg.color}33`,borderTop:`3px solid ${pkg.color}`}}>
            <SectionHeader label={`${pkg.icon} ${pkg.name} 護理要點`} color={pkg.color}/>
            {(pkg.tasks||[]).length===0&&<div style={{fontSize:12,color:'#94A3B8',paddingLeft:12}}>此套餐尚無要點，請至套餐管理編輯</div>}
            {(pkg.tasks||[]).map(task=>(
              <TaskItem key={task.id} taskKey={`pkg_${pkg.id}_${task.id}`} label={task.label}/>
            ))}
          </div>
        ))}

        <div style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:'1px solid #E2E8F0'}}>
          <SectionHeader label='個人化護理項目' color='#7C3AED' onAdd={()=>{setFText('');setCtx({pid:pt.id,section:'custom'});setModal('addPatientTask')}}/>
          {(pt.customTasks||[]).length===0&&<div style={{fontSize:12,color:'#94A3B8',paddingLeft:12}}>可新增此病人專屬的護理任務</div>}
          {(pt.customTasks||[]).map(task=>(
            <TaskItem key={task.id} taskKey={`cu_${task.id}`} label={task.label}
              onEdit={()=>{setFText(task.label);setCtx({pid:pt.id,section:'custom',taskId:task.id});setModal('editPatientTask')}}
              onDelete={()=>updatePatient(pt.id,{customTasks:(pt.customTasks||[]).filter(t=>t.id!==task.id)})}
            />
          ))}
        </div>

        {pct===100&&(
          <div style={{background:'linear-gradient(135deg,#DCFCE7,#BBF7D0)',border:'1px solid #86EFAC',borderRadius:14,padding:'16px',textAlign:'center',color:'#14532D',marginBottom:14}}>
            <div style={{fontSize:30}}>🌟</div>
            <div style={{fontWeight:800,fontSize:15,marginTop:6}}>此病人所有護理任務完成！</div>
          </div>
        )}

        <div style={{textAlign:'center',paddingTop:4,paddingBottom:8}}>
          <button onClick={()=>{
            if(!window.confirm('確定要刪除此病人及所有記錄？')) return
            setAndSavePatients(prev=>prev.filter(p=>p.id!==pt.id))
            setAndSaveChecked(prev=>{const c={...prev};delete c[pt.id];return c})
            setView('home');setActivePid(null)
          }} style={{background:'none',border:'1px solid #FCA5A5',color:'#EF4444',borderRadius:10,padding:'9px 22px',fontSize:13,cursor:'pointer'}}>
            🗑 刪除此病人
          </button>
        </div>
      </div>
    )
  }

  const PackagesView = () => (
    <div style={{padding:'14px 16px'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:14}}>
        <span style={{fontWeight:800,fontSize:15,color:'#0F172A',flex:1}}>疾病套餐管理</span>
        <button onClick={()=>{setFText('');setFIcon('📋');setFColor(COLORS[0]);setModal('addPkg')}} style={{background:'#1A3C5E',color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>＋ 新增套餐</button>
      </div>
      {packages.map(pkg=>(
        <div key={pkg.id} style={{background:'#fff',borderRadius:16,padding:'16px',marginBottom:14,border:`1px solid ${pkg.color}33`,borderTop:`4px solid ${pkg.color}`,boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}>
          <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
            <span style={{fontSize:22,marginRight:8}}>{pkg.icon}</span>
            <span style={{fontWeight:800,fontSize:16,color:'#0F172A',flex:1}}>{pkg.name}</span>
            <button onClick={()=>{setFText(pkg.name);setFIcon(pkg.icon);setFColor(pkg.color);setCtx({pkgId:pkg.id});setModal('editPkg')}} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8',fontSize:15,padding:'0 5px'}}>✏️</button>
            <button onClick={()=>{
              if(!window.confirm(`確定刪除「${pkg.name}」套餐？`)) return
              setAndSavePackages(prev=>prev.filter(p=>p.id!==pkg.id))
              setAndSavePatients(prev=>prev.map(pt=>({...pt,packages:(pt.packages||[]).filter(x=>x!==pkg.id)})))
            }} style={{background:'none',border:'none',cursor:'pointer',color:'#94A3B8',fontSize:14,padding:'0 5px'}}>🗑</button>
          </div>
          {(pkg.tasks||[]).map(task=>(
            <div key={task.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',background:'#F8FAFC',borderRadius:9,marginBottom:5}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:pkg.color,flexShrink:0}}/>
              <span style={{flex:1,fontSize:13,color:'#334155',lineHeight:1.4}}>{task.label}</span>
              <button onClick={()=>{setFText(task.label);setCtx({pkgId:pkg.id,taskId:task.id});setModal('editPkgTask')}} style={{background:'none',border:'none',color:'#CBD5E1',cursor:'pointer',fontSize:14}}>✏️</button>
              <button onClick={()=>setAndSavePackages(prev=>prev.map(p=>p.id===pkg.id?{...p,tasks:p.tasks.filter(t=>t.id!==task.id)}:p))} style={{background:'none',border:'none',color:'#CBD5E1',cursor:'pointer',fontSize:13}}>🗑</button>
            </div>
          ))}
          {(pkg.tasks||[]).length===0&&<div style={{fontSize:12,color:'#94A3B8',padding:'4px 11px'}}>尚無護理要點</div>}
          <button onClick={()=>{setFText('');setCtx({pkgId:pkg.id});setModal('addPkgTask')}} style={{marginTop:8,background:pkg.color+'15',color:pkg.color,border:`1.5px dashed ${pkg.color}66`,borderRadius:9,width:'100%',padding:'8px',fontSize:12,fontWeight:700,cursor:'pointer'}}>＋ 新增護理要點</button>
        </div>
      ))}
    </div>
  )

  const RoutineView = () => (
    <div style={{padding:'14px 16px'}}>
      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:12,padding:'12px 14px',marginBottom:14,fontSize:12,color:'#1D4ED8',lineHeight:1.6}}>
        💡 此範本為新增病人時的預設常規護理清單。已建立的病人請至各病人頁面單獨調整。
      </div>
      <div style={{display:'flex',alignItems:'center',marginBottom:14}}>
        <span style={{fontWeight:800,fontSize:15,color:'#0F172A',flex:1}}>常規護理範本</span>
        <button onClick={()=>{setFText('');setModal('addRoutine')}} style={{background:'#1A3C5E',color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>＋ 新增</button>
      </div>
      <div style={{background:'#fff',borderRadius:14,padding:'12px',border:'1px solid #E2E8F0'}}>
        {routineTpl.map((task,i)=>(
          <div key={task.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',background:i%2===0?'#F8FAFC':'#fff',borderRadius:9,marginBottom:4}}>
            <span style={{width:24,height:24,background:'#EFF6FF',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#1A3C5E',flexShrink:0}}>{i+1}</span>
            <span style={{flex:1,fontSize:13,color:'#334155'}}>{task.label}</span>
            <button onClick={()=>{setFText(task.label);setCtx({taskId:task.id});setModal('editRoutine')}} style={{background:'none',border:'none',color:'#CBD5E1',cursor:'pointer',fontSize:14}}>✏️</button>
            <button onClick={()=>setAndSaveRoutine(prev=>prev.filter(t=>t.id!==task.id))} style={{background:'none',border:'none',color:'#CBD5E1',cursor:'pointer',fontSize:13}}>🗑</button>
          </div>
        ))}
        {routineTpl.length===0&&<div style={{fontSize:12,color:'#94A3B8',textAlign:'center',padding:'20px'}}>尚無常規項目</div>}
      </div>
    </div>
  )

  const navItems = [{key:'home',icon:'🛏️',label:'病人'},{key:'packages',icon:'🗂️',label:'套餐'},{key:'routine',icon:'📋',label:'常規範本'}]

  return (
    <div style={{fontFamily:"'Noto Sans TC','Microsoft JhengHei',sans-serif",background:'#F0F4F8',minHeight:'100vh',maxWidth:430,margin:'0 auto',paddingBottom:72}}>
      <SaveIndicator status={saveStatus}/>
      <div style={{background:'linear-gradient(135deg,#1A3C5E 0%,#2D6A9F 100%)',padding:'18px 18px 16px',color:'#fff',position:'sticky',top:0,zIndex:90,boxShadow:'0 4px 20px rgba(26,60,94,0.25)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {view==='patient'&&(
            <button onClick={()=>{setView('home');setActivePid(null)}} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:8,color:'#fff',fontSize:20,width:34,height:34,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          )}
          <span style={{fontSize:20}}>🏥</span>
          <div>
            <div style={{fontSize:17,fontWeight:800,letterSpacing:0.5}}>
              {view==='home'&&'護理工作清單'}
              {view==='patient'&&`${activePatient?.bed}床${activePatient?.name?' · '+activePatient.name:''}`}
              {view==='packages'&&'疾病套餐管理'}
              {view==='routine'&&'常規護理範本'}
            </div>
            <div style={{fontSize:10,opacity:0.65}}>雲端同步 · Nursing Care System</div>
          </div>
        </div>
      </div>

      {view==='home'&&<HomeView/>}
      {view==='patient'&&<PatientView/>}
      {view==='packages'&&<PackagesView/>}
      {view==='routine'&&<RoutineView/>}

      {view!=='patient'&&(
        <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'#fff',borderTop:'1px solid #E2E8F0',display:'flex',boxShadow:'0 -4px 20px rgba(0,0,0,0.08)',zIndex:90}}>
          {navItems.map(n=>(
            <button key={n.key} onClick={()=>setView(n.key as typeof view)} style={{flex:1,padding:'10px 0 8px',background:'none',border:'none',cursor:'pointer',color:view===n.key?'#1A3C5E':'#94A3B8',borderTop:view===n.key?'3px solid #1A3C5E':'3px solid transparent',transition:'all 0.2s'}}>
              <div style={{fontSize:21}}>{n.icon}</div>
              <div style={{fontSize:10,fontWeight:view===n.key?800:400,marginTop:2}}>{n.label}</div>
            </button>
          ))}
        </div>
      )}

      {renderModal()}
    </div>
  )
}
