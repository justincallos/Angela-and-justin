import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

const EXPENSE_TYPES = ["Parts", "RWC", "Transport", "Paint/Bodywork", "Advertising", "Rego", "Other"];
const PAYERS = ["Justin", "Angela"];
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtMonth = (str) => { const [y, m] = str.split("-"); return new Date(y, m - 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" }); };
const currentMonth = () => new Date().toISOString().slice(0, 7);

const C = {
  bg: "#F5F5F7", card: "#FFFFFF", dark: "#0A0A0B", dark2: "#1C1C1E",
  mid: "#3A3A3C", muted: "#8E8E93", border: "#E5E5EA",
  green: "#30D158", greenBg: "#F0FBF3", greenText: "#1A7F37",
  red: "#FF3B30", redBg: "#FFF2F1", redText: "#C0392B",
  blue: "#0A84FF", blueBg: "#F0F6FF", blueText: "#0055CC",
};

const getCarExpenses = (expenses, carId) => expenses.filter(e => e.car_id === carId);
const calcTotals = (car, carExpenses) => {
  const totalExpenses = carExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const purchasePrice = Number(car.purchase_price || 0);
  const totalCost = purchasePrice + totalExpenses;
  const justinPaid = carExpenses.filter(e => e.paid_by === "Justin").reduce((s, e) => s + Number(e.amount || 0), 0);
  const angelaPaid = carExpenses.filter(e => e.paid_by === "Angela").reduce((s, e) => s + Number(e.amount || 0), 0);
  return { totalExpenses, totalCost, justinPaid, angelaPaid };
};
const calcPayout = (car, carExpenses) => {
  const { totalCost, justinPaid, angelaPaid } = calcTotals(car, carExpenses);
  const sellPrice = Number(car.sell_price || 0);
  const profitLoss = sellPrice - totalCost;
  const profitShare = profitLoss / 2;
  return { profitLoss, profitShare, justinPayout: justinPaid + profitShare, angelaPayout: angelaPaid + profitShare, sellPrice, totalCost };
};
const calcMonthlyProfits = (cars, expenses) => {
  const sold = cars.filter(c => c.status === "sold" && c.sold_date);
  const map = {};
  sold.forEach(car => {
    const month = car.sold_date.slice(0, 7);
    const { profitLoss } = calcPayout(car, getCarExpenses(expenses, car.id));
    if (!map[month]) map[month] = { month, profit: 0, cars: [] };
    map[month].profit += profitLoss;
    map[month].cars.push({ model: car.model, rego: car.rego, profit: profitLoss });
  });
  return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
};

const I = {
  back: (c=C.dark) => <svg width="11" height="19" viewBox="0 0 11 19" fill="none"><path d="M10 1L1 9.5L10 18" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus: (c="#fff") => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: (c="#fff") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  trash: (c=C.red) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  photo: (c=C.muted) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  car: (c="#C7C7CC") => <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17H5v-5l2.5-6h9L19 12v5z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3 12h18"/></svg>,
  edit: (c=C.muted) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  download: (c="#fff") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  history: (c=C.mid) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>,
  chevR: (c="#C7C7CC") => <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1L7 6.5L1 12" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

const GF = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";
const iSx = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.border}`, borderRadius:14, fontSize:16, color:C.dark, background:C.card, outline:"none", boxSizing:"border-box", fontFamily:"inherit", WebkitAppearance:"none", appearance:"none" };
const Inp = (p) => <input style={iSx} {...p}/>;
const Sel = ({children,...p}) => <select style={{...iSx, backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%238E8E93' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 16px center"}} {...p}>{children}</select>;
const Field = ({label,req,children}) => <div style={{marginBottom:18}}><label style={{display:"block",fontSize:12,fontWeight:600,color:C.muted,letterSpacing:"0.02em",marginBottom:8}}>{label}{req&&<span style={{color:C.red,marginLeft:3}}>*</span>}</label>{children}</div>;
const Btn = ({children,onClick,variant="primary",full,small,disabled,loading}) => {
  const v={primary:{background:C.dark,color:"#fff",border:"none"},ghost:{background:"transparent",color:C.mid,border:`1.5px solid ${C.border}`},danger:{background:C.redBg,color:C.red,border:"none"},blue:{background:C.blue,color:"#fff",border:"none"}}[variant];
  return <button onClick={onClick} disabled={disabled||loading} style={{...v,width:full?"100%":"auto",padding:small?"9px 16px":"15px 22px",borderRadius:small?10:14,fontSize:small?13:15,fontWeight:600,cursor:(disabled||loading)?"not-allowed":"pointer",opacity:(disabled||loading)?0.45:1,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:7,justifyContent:"center",letterSpacing:"-0.01em",WebkitTapHighlightColor:"transparent"}}>{loading?"Saving…":children}</button>;
};
const Tag = ({children,color="grey"}) => {
  const cols={green:{bg:C.greenBg,text:C.greenText},blue:{bg:C.blueBg,text:C.blueText},grey:{bg:"#F2F2F7",text:C.mid},red:{bg:C.redBg,text:C.redText}};
  return <span style={{background:cols[color].bg,color:cols[color].text,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:"0.03em"}}>{children}</span>;
};
const Divider = () => <div style={{height:1,background:C.border,margin:"16px 0"}}/>;
const Spinner = () => <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:12}}><div style={{width:28,height:28,border:`3px solid ${C.border}`,borderTopColor:C.dark,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style><span style={{fontSize:14,color:C.muted}}>Loading…</span></div>;

const PhotoUpload = ({value,onChange,label="Add Photo"}) => {
  const ref = useRef();
  const handleFile = (e) => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>onChange(ev.target.result); r.readAsDataURL(f); };
  return <div onClick={()=>ref.current.click()} style={{border:`2px dashed ${C.border}`,borderRadius:16,padding:value?8:32,textAlign:"center",cursor:"pointer",background:"#FAFAFA",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,minHeight:value?"auto":110}}><input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>{value?<img src={value} alt="upload" style={{maxWidth:"100%",maxHeight:200,borderRadius:12,objectFit:"cover"}}/>:<>{I.photo()}<span style={{fontSize:14,color:C.muted,fontWeight:500}}>{label}</span></>}</div>;
};

const Shell = ({title,onBack,action,children,noPad}) => (
  <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:C.bg,fontFamily:"'Inter',system-ui,-apple-system,sans-serif"}}>
    <link href={GF} rel="stylesheet"/>
    <style>{"*{-webkit-tap-highlight-color:transparent;box-sizing:border-box}"}</style>
    <div style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",padding:"54px 20px 14px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:50,display:"flex",alignItems:"center",gap:14}}>
      {onBack&&<button onClick={onBack} style={{background:"#F2F2F7",border:"none",borderRadius:50,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>{I.back()}</button>}
      <h1 style={{flex:1,margin:0,fontSize:19,fontWeight:800,color:C.dark,letterSpacing:"-0.03em"}}>{title}</h1>
      {action}
    </div>
    <div style={{padding:noPad?0:"22px 16px 110px"}}>{children}</div>
  </div>
);

const StatTile = ({label,value,sub,dark,onClick,hint}) => (
  <div onClick={onClick} style={{background:dark?C.dark2:C.card,borderRadius:18,padding:"16px 18px",border:dark?"none":`1px solid ${C.border}`,cursor:onClick?"pointer":"default",flex:1,minWidth:0}}>
    <div style={{fontSize:11,fontWeight:600,color:dark?"#636366":C.muted,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
    <div style={{fontSize:22,fontWeight:800,color:dark?"#fff":C.dark,letterSpacing:"-0.03em",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:dark?"#48484A":C.muted,marginTop:5,fontWeight:500}}>{sub}</div>}
    {hint&&<div style={{fontSize:11,color:dark?"#636366":"#C7C7CC",marginTop:3}}>{hint}</div>}
  </div>
);

const MonthlyModal = ({cars,expenses,onClose}) => {
  const monthly = calcMonthlyProfits(cars,expenses);
  const now = currentMonth();
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:430,margin:"0 auto",maxHeight:"82vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"center",paddingTop:12,paddingBottom:4}}><div style={{width:36,height:4,background:C.border,borderRadius:4}}/></div>
        <div style={{padding:"12px 22px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>Monthly Profit</div>
          <button onClick={onClose} style={{background:"#F2F2F7",border:"none",borderRadius:20,padding:"7px 16px",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit",color:C.mid}}>Done</button>
        </div>
        <div style={{overflowY:"auto",padding:"4px 22px 40px",flex:1}}>
          {monthly.length===0?<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontSize:15}}>No sold cars yet</div>
          :monthly.map(({month,profit,cars:mc})=>(
            <div key={month} style={{marginBottom:22}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16,fontWeight:700,color:C.dark}}>{fmtMonth(month)}</span>
                  {month===now&&<Tag color="green">This month</Tag>}
                </div>
                <span style={{fontSize:17,fontWeight:800,color:profit>=0?C.greenText:C.redText,letterSpacing:"-0.02em"}}>{profit>=0?"+":""}{fmt(profit)}</span>
              </div>
              {mc.map((c,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.bg,borderRadius:12,marginBottom:6}}>
                  <div><div style={{fontSize:14,fontWeight:600,color:C.dark}}>{c.model}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{c.rego}</div></div>
                  <span style={{fontSize:14,fontWeight:700,color:c.profit>=0?C.greenText:C.redText}}>{c.profit>=0?"+":""}{fmt(c.profit)}</span>
                </div>
              ))}
              <div style={{height:1,background:C.border,marginTop:14}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const HomeScreen = ({cars,expenses,loading,onSelectCar,onAddCar,onHistory}) => {
  const [filter,setFilter] = useState("all");
  const [showMonthly,setShowMonthly] = useState(false);
  const filtered = cars.filter(c=>filter==="all"?true:c.status===filter);
  const now = currentMonth();
  const monthly = calcMonthlyProfits(cars,expenses);
  const thisMonth = monthly.find(m=>m.month===now);
  const monthProfit = thisMonth?thisMonth.profit:0;
  const inStockCars = cars.filter(c=>c.status==="instock");
  const inStockExp = expenses.filter(e=>inStockCars.some(c=>c.id===e.car_id));
  const justinTotal = inStockExp.filter(e=>e.paid_by==="Justin").reduce((s,e)=>s+Number(e.amount||0),0);
  const angelaTotal = inStockExp.filter(e=>e.paid_by==="Angela").reduce((s,e)=>s+Number(e.amount||0),0);

  return (
    <Shell title="Tracar" action={
      <div style={{display:"flex",gap:8}}>
        <button onClick={onHistory} style={{background:"#F2F2F7",border:"none",borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:C.mid,display:"flex",alignItems:"center",gap:6}}>{I.history()} History</button>
        <button onClick={onAddCar} style={{background:C.dark,border:"none",borderRadius:10,padding:"9px 16px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:"#fff",display:"flex",alignItems:"center",gap:6}}>{I.plus()} Add Car</button>
      </div>
    }>
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <StatTile label="In Stock" value={inStockCars.length} dark/>
        <StatTile label="Sold" value={cars.filter(c=>c.status==="sold").length}/>
        <StatTile label="This Month" value={`${monthProfit>=0?"+":""}${fmt(monthProfit)}`} hint={`${new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short"})} · tap`} onClick={()=>setShowMonthly(true)}/>
      </div>

      <div style={{background:C.card,borderRadius:18,padding:"16px 18px",marginBottom:22,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:14}}>Expenses in Stock Cars</div>
        <div style={{display:"flex"}}>
          {[["Justin",justinTotal],["Angela",angelaTotal],["Total",justinTotal+angelaTotal]].map(([name,val],i,arr)=>(
            <div key={name} style={{flex:1,borderLeft:i>0?`1px solid ${C.border}`:"none",paddingLeft:i>0?16:0}}>
              <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:4}}>{name}</div>
              <div style={{fontSize:17,fontWeight:800,color:i===arr.length-1?C.dark:C.mid,letterSpacing:"-0.02em"}}>{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:18}}>
        {[["all","All"],["instock","In Stock"],["sold","Sold"]].map(([val,label])=>(
          <button key={val} onClick={()=>setFilter(val)} style={{padding:"8px 18px",borderRadius:20,fontSize:13,fontWeight:600,background:filter===val?C.dark:C.card,color:filter===val?"#fff":C.muted,border:filter===val?"none":`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
        ))}
      </div>

      {loading?<Spinner/>:filtered.length===0?(
        <div style={{textAlign:"center",padding:"80px 20px"}}>{I.car()}<div style={{fontSize:16,fontWeight:600,color:C.dark,marginTop:16}}>No cars yet</div><div style={{fontSize:14,color:C.muted,marginTop:6}}>Tap "Add Car" to get started</div></div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtered.map(car=>{
            const carExp=getCarExpenses(expenses,car.id);
            const {totalCost}=calcTotals(car,carExp);
            const isSold=car.status==="sold";
            return (
              <div key={car.id} onClick={()=>onSelectCar(car)} style={{background:C.card,borderRadius:20,overflow:"hidden",border:`1px solid ${C.border}`,cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
                {car.photo
                  ?<div style={{height:170,overflow:"hidden",position:"relative"}}><img src={car.photo} alt={car.model} style={{width:"100%",height:"100%",objectFit:"cover"}}/><div style={{position:"absolute",top:12,right:12}}><Tag color={isSold?"blue":"green"}>{isSold?"Sold":"In Stock"}</Tag></div></div>
                  :<div style={{height:90,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>{I.car()}<div style={{position:"absolute",top:12,right:12}}><Tag color={isSold?"blue":"green"}>{isSold?"Sold":"In Stock"}</Tag></div></div>
                }
                <div style={{padding:"14px 18px 18px"}}>
                  <div style={{fontSize:17,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>{car.model}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:3,fontWeight:500}}>Rego: {car.rego||"—"}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>Total Cost</div>
                      <div style={{fontSize:18,fontWeight:800,color:C.dark,marginTop:3,letterSpacing:"-0.02em"}}>{fmt(totalCost)}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,color:C.muted}}>
                      <span style={{fontSize:13,fontWeight:500}}>{carExp.length} expense{carExp.length!==1?"s":""}</span>
                      {I.chevR()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showMonthly&&<MonthlyModal cars={cars} expenses={expenses} onClose={()=>setShowMonthly(false)}/>}
    </Shell>
  );
};

const CarDetailScreen = ({car,expenses,onBack,onAddExpense,onMarkSold,onDeleteExpense,onDeleteCar,onEditCar,onEditExpense,onToggleNonna}) => {
  const carExp=getCarExpenses(expenses,car.id);
  const {totalExpenses,totalCost,justinPaid,angelaPaid}=calcTotals(car,carExp);
  const isSold=car.status==="sold";
  const payout=isSold?calcPayout(car,carExp):null;

  return (
    <Shell title={car.model} onBack={onBack} noPad>
      {car.photo?<div style={{height:240,overflow:"hidden"}}><img src={car.photo} alt={car.model} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>:<div style={{height:140,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>{I.car()}</div>}
      <div style={{padding:"20px 16px 110px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:C.dark,letterSpacing:"-0.03em"}}>{car.model}</div>
            <div style={{fontSize:14,color:C.muted,marginTop:3}}>Rego: <span style={{fontWeight:600,color:C.mid}}>{car.rego||"—"}</span></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <Tag color={isSold?"blue":"green"}>{isSold?"Sold":"In Stock"}</Tag>
            <button onClick={onEditCar} style={{background:"#F2F2F7",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:C.mid,fontFamily:"inherit"}}>{I.edit()} Edit</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <StatTile label="Purchase Price" value={fmt(car.purchase_price)} sub={car.purchase_date?fmtDate(car.purchase_date):undefined}/>
          <StatTile label="Total Expenses" value={fmt(totalExpenses)} sub={`${carExp.length} item${carExp.length!==1?"s":""}`}/>
          <StatTile label="Total Cost" value={fmt(totalCost)} dark/>
          {isSold?<StatTile label="Sell Price" value={fmt(car.sell_price)} sub={fmtDate(car.sold_date)}/>:<StatTile label="Purchase Date" value={car.purchase_date?fmtDate(car.purchase_date):"—"}/>}
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:14}}>Paid Into This Car</div>
          <div style={{display:"flex"}}>
            {[["Justin",justinPaid],["Angela",angelaPaid]].map(([name,amt],i)=>(
              <div key={name} style={{flex:1,borderLeft:i>0?`1px solid ${C.border}`:"none",paddingLeft:i>0?18:0}}>
                <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:4}}>{name}</div>
                <div style={{fontSize:19,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>{fmt(amt)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nonna Money */}
        <div style={{background:car.nonna_funded?"#FFFBEB":C.card,border:"1.5px solid "+(car.nonna_funded?"#FCD34D":C.border),borderRadius:18,padding:"16px 18px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:14,fontWeight:700,color:C.dark}}>Nonna's Money</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{car.nonna_funded?"Funded by Angela's mum":"Standard funding"}</div></div>
            <button onClick={onToggleNonna} style={{background:car.nonna_funded?"#F59E0B":"#E5E5EA",border:"none",borderRadius:30,width:51,height:31,position:"relative",cursor:"pointer",flexShrink:0}}><div style={{position:"absolute",top:3,left:car.nonna_funded?23:3,width:25,height:25,background:"#fff",borderRadius:50,boxShadow:"0 1px 4px rgba(0,0,0,0.2)",transition:"left 0.2s"}}/></button>
          </div>
          {car.nonna_funded&&(
            <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #FDE68A"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:"#92400E",fontWeight:500}}>Purchase price</span><span style={{fontSize:14,fontWeight:700,color:"#92400E"}}>{fmt(car.purchase_price)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:"#92400E",fontWeight:500}}>Return fee</span><span style={{fontSize:14,fontWeight:700,color:"#92400E"}}>$500.00</span></div>
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid #FDE68A"}}><span style={{fontSize:14,fontWeight:800,color:"#78350F"}}>Owed to Angela's mum</span><span style={{fontSize:16,fontWeight:800,color:"#78350F"}}>{fmt(Number(car.purchase_price)+500)}</span></div>
            </div>
          )}
        </div>

        {isSold&&payout&&(
          <div style={{background:payout.profitLoss>=0?C.greenBg:C.redBg,border:`1px solid ${payout.profitLoss>=0?"#BBF7D0":"#FED7D7"}`,borderRadius:18,padding:"16px 18px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:payout.profitLoss>=0?C.greenText:C.redText,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:12}}>{payout.profitLoss>=0?"🎉 Sale Result":"📉 Sale Result"}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:12,marginBottom:12,borderBottom:`1px solid ${payout.profitLoss>=0?"#BBF7D0":"#FED7D7"}`}}>
              <span style={{fontSize:15,fontWeight:600,color:C.mid}}>Profit / Loss</span>
              <span style={{fontSize:18,fontWeight:800,color:payout.profitLoss>=0?C.greenText:C.redText,letterSpacing:"-0.02em"}}>{payout.profitLoss>=0?"+":""}{fmt(payout.profitLoss)}</span>
            </div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:10}}>Payouts — costs back + 50/50 split</div>
            {[["Justin",justinPaid,payout.justinPayout],["Angela",angelaPaid,payout.angelaPayout]].map(([name,paid,pout])=>(
              <div key={name} style={{paddingTop:10,borderTop:`1px solid ${payout.profitLoss>=0?"#D1FAE5":"#FEE2E2"}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:15,fontWeight:700,color:C.dark}}>{name} receives</span><span style={{fontSize:17,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>{fmt(pout)}</span></div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>{fmt(paid)} back + {fmt(payout.profitShare)} profit share</div>
              </div>
            ))}
          </div>
        )}

        {!isSold&&<div style={{display:"flex",gap:10,marginBottom:24}}><Btn full onClick={onAddExpense}>{I.plus()} Add Expense</Btn><Btn variant="blue" onClick={onMarkSold} small>{I.check()} Mark Sold</Btn></div>}

        <div style={{marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:800,color:C.dark,marginBottom:14,letterSpacing:"-0.02em"}}>Expenses <span style={{color:C.muted,fontWeight:500,fontSize:14}}>({carExp.length})</span></div>
          {carExp.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"32px 20px",textAlign:"center"}}><div style={{fontSize:14,fontWeight:500,color:C.muted}}>No expenses yet</div></div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[...carExp].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(exp=>(
                <div key={exp.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}><Tag>{exp.type}</Tag><span style={{fontSize:12,color:C.muted}}>{fmtDate(exp.date)}</span></div>
                      <div style={{fontSize:18,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>{fmt(exp.amount)}</div>
                      {exp.description&&<div style={{fontSize:13,color:C.mid,marginTop:4}}>{exp.description}</div>}
                      <div style={{fontSize:12,color:C.muted,marginTop:6}}>Paid by <span style={{fontWeight:700,color:C.mid}}>{exp.paid_by}</span></div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,marginLeft:14,flexShrink:0}}>
                      {exp.receipt&&<img src={exp.receipt} alt="receipt" style={{width:50,height:50,borderRadius:10,objectFit:"cover"}}/>}
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>onEditExpense(exp)} style={{background:"#F2F2F7",border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>{I.edit()}</button>
                        <button onClick={()=>onDeleteExpense(exp.id)} style={{background:"none",border:"none",cursor:"pointer",padding:6}}>{I.trash()}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:20}}><Btn variant="danger" full onClick={onDeleteCar}>{I.trash(C.red)} Delete This Car</Btn></div>
      </div>
    </Shell>
  );
};

const AddCarScreen = ({onBack,onSave}) => {
  const [form,setForm] = useState({model:"",rego:"",purchase_price:"",purchase_date:"",photo:null});
  const [saving,setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleSave=async()=>{setSaving(true);await onSave(form);setSaving(false);};
  return (
    <Shell title="Add Car" onBack={onBack}>
      <Field label="Car Model" req><Inp placeholder="e.g. 2018 Toyota Camry" value={form.model} onChange={e=>set("model",e.target.value)}/></Field>
      <Field label="Rego Number" req><Inp placeholder="e.g. ABC123" value={form.rego} onChange={e=>set("rego",e.target.value.toUpperCase())}/></Field>
      <Field label="Purchase Price" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.purchase_price} onChange={e=>set("purchase_price",e.target.value)}/></Field>
      <Field label="Purchase Date"><Inp type="date" value={form.purchase_date} onChange={e=>set("purchase_date",e.target.value)}/></Field>
      <Field label="Car Photo"><PhotoUpload value={form.photo} onChange={v=>set("photo",v)}/></Field>
      <div style={{marginTop:10}}><Btn full onClick={handleSave} disabled={!form.model||!form.rego||!form.purchase_price} loading={saving}>{I.check()} Add Car</Btn></div>
    </Shell>
  );
};

const AddExpenseScreen = ({car,onBack,onSave}) => {
  const [form,setForm] = useState({date:new Date().toISOString().slice(0,10),type:"Parts",description:"",amount:"",paid_by:"Justin",receipt:null});
  const [saving,setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleSave=async()=>{setSaving(true);await onSave(form);setSaving(false);};
  return (
    <Shell title="Add Expense" onBack={onBack}>
      <div style={{background:C.bg,borderRadius:14,padding:"12px 16px",marginBottom:22,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.muted}}>Adding expense for</div>
        <div style={{fontSize:16,fontWeight:700,color:C.dark,marginTop:2}}>{car.model} — {car.rego}</div>
      </div>
      <Field label="Date" req><Inp type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
      <Field label="Expense Type" req><Sel value={form.type} onChange={e=>set("type",e.target.value)}>{EXPENSE_TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
      <Field label="Description"><Inp placeholder="What was this for?" value={form.description} onChange={e=>set("description",e.target.value)}/></Field>
      <Field label="Amount" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.amount} onChange={e=>set("amount",e.target.value)}/></Field>
      <Field label="Paid By" req>
        <div style={{display:"flex",gap:10}}>
          {PAYERS.map(p=><button key={p} onClick={()=>set("paid_by",p)} style={{flex:1,padding:"14px",borderRadius:14,border:`2px solid ${form.paid_by===p?C.dark:C.border}`,background:form.paid_by===p?C.dark:C.card,color:form.paid_by===p?"#fff":C.mid,fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{p}</button>)}
        </div>
      </Field>
      <Field label="Receipt / Photo"><PhotoUpload value={form.receipt} onChange={v=>set("receipt",v)} label="Tap to add receipt"/></Field>
      <div style={{marginTop:10}}><Btn full onClick={handleSave} disabled={!form.date||!form.amount||Number(form.amount)<=0} loading={saving}>{I.check()} Save Expense</Btn></div>
    </Shell>
  );
};

const MarkSoldScreen = ({car,expenses,onBack,onSave}) => {
  const [form,setForm] = useState({sell_price:"",sold_date:new Date().toISOString().slice(0,10)});
  const [saving,setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const carExp=getCarExpenses(expenses,car.id);
  const {totalCost,justinPaid,angelaPaid}=calcTotals(car,carExp);
  const sellPrice=Number(form.sell_price||0);
  const profitLoss=sellPrice-totalCost;
  const profitShare=profitLoss/2;
  const hasPreview=sellPrice>0;
  const handleSave=async()=>{setSaving(true);await onSave(form);setSaving(false);};
  return (
    <Shell title="Mark as Sold" onBack={onBack}>
      <div style={{background:C.bg,borderRadius:14,padding:"12px 16px",marginBottom:22,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.muted}}>Selling</div>
        <div style={{fontSize:16,fontWeight:700,color:C.dark,marginTop:2}}>{car.model} — {car.rego}</div>
        <div style={{fontSize:13,color:C.muted,marginTop:4}}>Total cost in: <strong style={{color:C.dark}}>{fmt(totalCost)}</strong></div>
      </div>
      <Field label="Sell Price" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.sell_price} onChange={e=>set("sell_price",e.target.value)}/></Field>
      <Field label="Sold Date"><Inp type="date" value={form.sold_date} onChange={e=>set("sold_date",e.target.value)}/></Field>
      {hasPreview&&(
        <div style={{background:profitLoss>=0?C.greenBg:C.redBg,border:`1px solid ${profitLoss>=0?"#BBF7D0":"#FED7D7"}`,borderRadius:18,padding:"16px 18px",marginBottom:22}}>
          <div style={{fontSize:12,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:14}}>Preview</div>
          {[["Total Cost",fmt(totalCost)],["Sell Price",fmt(sellPrice)]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",paddingBottom:8}}><span style={{fontSize:14,color:C.muted}}>{l}</span><span style={{fontSize:14,fontWeight:600,color:C.dark}}>{v}</span></div>)}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${profitLoss>=0?"#BBF7D0":"#FED7D7"}`}}>
            <span style={{fontSize:15,fontWeight:700,color:C.dark}}>Profit / Loss</span>
            <span style={{fontSize:17,fontWeight:800,color:profitLoss>=0?C.greenText:C.redText,letterSpacing:"-0.02em"}}>{profitLoss>=0?"+":""}{fmt(profitLoss)}</span>
          </div>
          <div style={{height:1,background:profitLoss>=0?"#BBF7D0":"#FED7D7",margin:"14px 0"}}/>
          <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:12}}>Payouts — costs back + 50/50 split</div>
          {[["Justin",justinPaid,justinPaid+profitShare],["Angela",angelaPaid,angelaPaid+profitShare]].map(([name,paid,pout])=>(
            <div key={name} style={{paddingTop:10,borderTop:`1px solid ${profitLoss>=0?"#D1FAE5":"#FEE2E2"}`}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:14,fontWeight:700,color:C.dark}}>{name} receives</span><span style={{fontSize:16,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>{fmt(pout)}</span></div>
              <div style={{fontSize:12,color:C.muted,marginTop:3}}>{fmt(paid)} back + {fmt(profitShare)} profit share</div>
            </div>
          ))}
        </div>
      )}
      <Btn full variant="blue" onClick={handleSave} disabled={!sellPrice} loading={saving}>{I.check()} Confirm Sale</Btn>
    </Shell>
  );
};

const EditCarScreen = ({car,onBack,onSave}) => {
  const [form,setForm] = useState({model:car.model||"",rego:car.rego||"",purchase_price:car.purchase_price||"",purchase_date:car.purchase_date||"",photo:car.photo||null,sell_price:car.sell_price||"",sold_date:car.sold_date||""});
  const [saving,setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleSave=async()=>{setSaving(true);await onSave(form);setSaving(false);};
  return (
    <Shell title="Edit Car" onBack={onBack}>
      <Field label="Car Model" req><Inp placeholder="e.g. 2018 Toyota Camry" value={form.model} onChange={e=>set("model",e.target.value)}/></Field>
      <Field label="Rego Number" req><Inp placeholder="e.g. ABC123" value={form.rego} onChange={e=>set("rego",e.target.value.toUpperCase())}/></Field>
      <Field label="Purchase Price" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.purchase_price} onChange={e=>set("purchase_price",e.target.value)}/></Field>
      <Field label="Purchase Date"><Inp type="date" value={form.purchase_date} onChange={e=>set("purchase_date",e.target.value)}/></Field>
      {car.status==="sold"&&<><Field label="Sell Price"><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.sell_price} onChange={e=>set("sell_price",e.target.value)}/></Field><Field label="Sold Date"><Inp type="date" value={form.sold_date} onChange={e=>set("sold_date",e.target.value)}/></Field></>}
      <Field label="Car Photo"><PhotoUpload value={form.photo} onChange={v=>set("photo",v)}/></Field>
      <div style={{marginTop:10}}><Btn full onClick={handleSave} disabled={!form.model||!form.rego||!form.purchase_price} loading={saving}>{I.check()} Save Changes</Btn></div>
    </Shell>
  );
};

const EditExpenseScreen = ({car,expense,onBack,onSave}) => {
  const [form,setForm] = useState({date:expense.date||"",type:expense.type||"Parts",description:expense.description||"",amount:expense.amount||"",paid_by:expense.paid_by||"Justin",receipt:expense.receipt||null});
  const [saving,setSaving] = useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleSave=async()=>{setSaving(true);await onSave(form);setSaving(false);};
  return (
    <Shell title="Edit Expense" onBack={onBack}>
      <div style={{background:C.bg,borderRadius:14,padding:"12px 16px",marginBottom:22,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.muted}}>Editing expense for</div>
        <div style={{fontSize:16,fontWeight:700,color:C.dark,marginTop:2}}>{car.model} — {car.rego}</div>
      </div>
      <Field label="Date" req><Inp type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></Field>
      <Field label="Expense Type" req><Sel value={form.type} onChange={e=>set("type",e.target.value)}>{EXPENSE_TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
      <Field label="Description"><Inp placeholder="What was this for?" value={form.description} onChange={e=>set("description",e.target.value)}/></Field>
      <Field label="Amount" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.amount} onChange={e=>set("amount",e.target.value)}/></Field>
      <Field label="Paid By" req>
        <div style={{display:"flex",gap:10}}>
          {PAYERS.map(p=><button key={p} onClick={()=>set("paid_by",p)} style={{flex:1,padding:"14px",borderRadius:14,border:`2px solid ${form.paid_by===p?C.dark:C.border}`,background:form.paid_by===p?C.dark:C.card,color:form.paid_by===p?"#fff":C.mid,fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{p}</button>)}
        </div>
      </Field>
      <Field label="Receipt / Photo"><PhotoUpload value={form.receipt} onChange={v=>set("receipt",v)} label="Tap to update receipt"/></Field>
      <div style={{marginTop:10}}><Btn full onClick={handleSave} disabled={!form.date||!form.amount||Number(form.amount)<=0} loading={saving}>{I.check()} Save Changes</Btn></div>
    </Shell>
  );
};

const SalesHistoryScreen = ({cars,expenses,onBack}) => {
  const sold=cars.filter(c=>c.status==="sold").sort((a,b)=>(b.sold_date||"").localeCompare(a.sold_date||""));
  const totalProfit=sold.reduce((s,car)=>{const{profitLoss}=calcPayout(car,getCarExpenses(expenses,car.id));return s+profitLoss;},0);
  const downloadCSV=()=>{
    const rows=[["Car","Rego","Purchase Date","Sold Date","Purchase Price","Total Expenses","Total Cost","Sell Price","Profit/Loss","Justin Paid","Angela Paid","Justin Payout","Angela Payout"]];
    sold.forEach(car=>{const carExp=getCarExpenses(expenses,car.id);const{totalExpenses,totalCost,justinPaid,angelaPaid}=calcTotals(car,carExp);const{profitLoss,justinPayout,angelaPayout}=calcPayout(car,carExp);rows.push([car.model,car.rego,car.purchase_date||"",car.sold_date||"",car.purchase_price,totalExpenses.toFixed(2),totalCost.toFixed(2),car.sell_price||"",profitLoss.toFixed(2),justinPaid.toFixed(2),angelaPaid.toFixed(2),justinPayout.toFixed(2),angelaPayout.toFixed(2)]);});
    rows.push([],["TOTAL","","","","","","","",totalProfit.toFixed(2),"","","",""]);
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`tracar-history-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  };
  return (
    <Shell title="Sales History" onBack={onBack} action={<button onClick={downloadCSV} style={{background:C.dark,border:"none",borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",color:"#fff",display:"flex",alignItems:"center",gap:6}}>{I.download()} Export</button>}>
      <div style={{display:"flex",gap:10,marginBottom:22}}>
        <StatTile label="Cars Sold" value={sold.length} dark/>
        <StatTile label="Total Profit" value={`${totalProfit>=0?"+":""}${fmt(totalProfit)}`}/>
      </div>
      {sold.length===0?<div style={{textAlign:"center",padding:"80px 20px",color:C.muted,fontSize:16,fontWeight:600}}>No sold cars yet</div>:(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {sold.map(car=>{
            const carExp=getCarExpenses(expenses,car.id);
            const{totalExpenses,justinPaid,angelaPaid}=calcTotals(car,carExp);
            const{profitLoss,justinPayout,angelaPayout}=calcPayout(car,carExp);
            return (
              <div key={car.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,overflow:"hidden"}}>
                <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontSize:17,fontWeight:800,color:C.dark,letterSpacing:"-0.02em"}}>{car.model}</div><div style={{fontSize:13,color:C.muted,marginTop:3}}>Rego: <span style={{fontWeight:600,color:C.mid}}>{car.rego}</span></div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:profitLoss>=0?C.greenText:C.redText,letterSpacing:"-0.02em"}}>{profitLoss>=0?"+":""}{fmt(profitLoss)}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>profit / loss</div></div>
                </div>
                <div style={{padding:"14px 18px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,borderBottom:`1px solid ${C.border}`}}>
                  {[["Buy",fmt(car.purchase_price)],["Expenses",fmt(totalExpenses)],["Sell",fmt(car.sell_price)]].map(([l,v])=>(
                    <div key={l}><div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{l}</div><div style={{fontSize:15,fontWeight:800,color:C.dark,marginTop:4,letterSpacing:"-0.02em"}}>{v}</div></div>
                  ))}
                </div>
                <div style={{padding:"12px 18px",display:"flex",gap:16,borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,color:C.muted}}>Bought: <span style={{color:C.mid,fontWeight:600}}>{fmtDate(car.purchase_date)}</span></span>
                  <span style={{fontSize:12,color:C.muted}}>Sold: <span style={{color:C.mid,fontWeight:600}}>{fmtDate(car.sold_date)}</span></span>
                </div>
                <div style={{padding:"14px 18px",display:"flex"}}>
                  {[["Justin",justinPayout],["Angela",angelaPayout]].map(([name,pout],i)=>(
                    <div key={name} style={{flex:1,borderLeft:i>0?`1px solid ${C.border}`:"none",paddingLeft:i>0?18:0}}>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{name}</div>
                      <div style={{fontSize:16,fontWeight:800,color:C.dark,marginTop:4,letterSpacing:"-0.02em"}}>{fmt(pout)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
};

export default function App() {
  const [cars,setCars] = useState([]);
  const [expenses,setExpenses] = useState([]);
  const [loading,setLoading] = useState(true);
  const [screen,setScreen] = useState("home");
  const [selectedCarId,setSelectedCarId] = useState(null);
  const [editingExpense,setEditingExpense] = useState(null);

  const fetchData = async () => {
    const [{data:carsData},{data:expData}] = await Promise.all([
      supabase.from("cars").select("*").order("created_at",{ascending:false}),
      supabase.from("expenses").select("*").order("date",{ascending:false}),
    ]);
    setCars(carsData||[]);setExpenses(expData||[]);setLoading(false);
  };
  useEffect(()=>{fetchData();},[]);

  const selectedCar=cars.find(c=>c.id===selectedCarId);

  const handleAddCar=async(form)=>{const{data,error}=await supabase.from("cars").insert([{model:form.model,rego:form.rego,purchase_price:Number(form.purchase_price),purchase_date:form.purchase_date||null,photo:form.photo||null,status:"instock"}]).select().single();if(!error&&data){setCars(prev=>[data,...prev]);setSelectedCarId(data.id);setScreen("car");}};
  const handleAddExpense=async(form)=>{const{data,error}=await supabase.from("expenses").insert([{car_id:selectedCarId,date:form.date,type:form.type,description:form.description||null,amount:Number(form.amount),paid_by:form.paid_by,receipt:form.receipt||null}]).select().single();if(!error&&data){setExpenses(prev=>[data,...prev]);setScreen("car");}};
  const handleMarkSold=async(form)=>{const{data,error}=await supabase.from("cars").update({status:"sold",sell_price:Number(form.sell_price),sold_date:form.sold_date||null}).eq("id",selectedCarId).select().single();if(!error&&data){setCars(prev=>prev.map(c=>c.id===selectedCarId?data:c));setScreen("car");}};
  const handleDeleteExpense=async(expId)=>{await supabase.from("expenses").delete().eq("id",expId);setExpenses(prev=>prev.filter(e=>e.id!==expId));};
  const handleEditCar=async(form)=>{const{data,error}=await supabase.from("cars").update({model:form.model,rego:form.rego,purchase_price:Number(form.purchase_price),purchase_date:form.purchase_date||null,photo:form.photo||null,...(form.sell_price?{sell_price:Number(form.sell_price)}:{}),...(form.sold_date?{sold_date:form.sold_date}:{})}).eq("id",selectedCarId).select().single();if(!error&&data){setCars(prev=>prev.map(c=>c.id===selectedCarId?data:c));setScreen("car");}};
  const handleEditExpense=async(form)=>{const{data,error}=await supabase.from("expenses").update({date:form.date,type:form.type,description:form.description||null,amount:Number(form.amount),paid_by:form.paid_by,receipt:form.receipt||null}).eq("id",editingExpense.id).select().single();if(!error&&data){setExpenses(prev=>prev.map(e=>e.id===editingExpense.id?data:e));setEditingExpense(null);setScreen("car");}};
  const handleToggleNonna=async()=>{const newVal=!selectedCar.nonna_funded;const{data,error}=await supabase.from("cars").update({nonna_funded:newVal}).eq("id",selectedCarId).select().single();if(!error&&data){setCars(prev=>prev.map(c=>c.id===selectedCarId?data:c));}};
  const handleDeleteCar=async()=>{if(!window.confirm("Delete this car and all its expenses?"))return;await supabase.from("expenses").delete().eq("car_id",selectedCarId);await supabase.from("cars").delete().eq("id",selectedCarId);setCars(prev=>prev.filter(c=>c.id!==selectedCarId));setExpenses(prev=>prev.filter(e=>e.car_id!==selectedCarId));setScreen("home");};

  if(screen==="add-car")return<AddCarScreen onBack={()=>setScreen("home")} onSave={handleAddCar}/>;
  if(screen==="add-expense"&&selectedCar)return<AddExpenseScreen car={selectedCar} onBack={()=>setScreen("car")} onSave={handleAddExpense}/>;
  if(screen==="sell"&&selectedCar)return<MarkSoldScreen car={selectedCar} expenses={expenses} onBack={()=>setScreen("car")} onSave={handleMarkSold}/>;
  if(screen==="edit-car"&&selectedCar)return<EditCarScreen car={selectedCar} onBack={()=>setScreen("car")} onSave={handleEditCar}/>;
  if(screen==="edit-expense"&&selectedCar&&editingExpense)return<EditExpenseScreen car={selectedCar} expense={editingExpense} onBack={()=>{setEditingExpense(null);setScreen("car");}} onSave={handleEditExpense}/>;
  if(screen==="history")return<SalesHistoryScreen cars={cars} expenses={expenses} onBack={()=>setScreen("home")}/>;
  if(screen==="car"&&selectedCar)return<CarDetailScreen car={selectedCar} expenses={expenses} onBack={()=>setScreen("home")} onAddExpense={()=>setScreen("add-expense")} onMarkSold={()=>setScreen("sell")} onDeleteExpense={handleDeleteExpense} onDeleteCar={handleDeleteCar} onEditCar={()=>setScreen("edit-car")} onEditExpense={(exp)=>{setEditingExpense(exp);setScreen("edit-expense");}} onToggleNonna={handleToggleNonna}/>;
  return<HomeScreen cars={cars} expenses={expenses} loading={loading} onSelectCar={(car)=>{setSelectedCarId(car.id);setScreen("car");}} onAddCar={()=>setScreen("add-car")} onHistory={()=>setScreen("history")}/>;
}
