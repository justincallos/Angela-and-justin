import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPENSE_TYPES = ["Parts", "RWC", "Transport", "Paint/Bodywork", "Advertising", "Rego", "Other"];
const PAYERS = ["Justin", "Angela"];
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtMonth = (str) => { const [y, m] = str.split("-"); return new Date(y, m - 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" }); };
const currentMonth = () => new Date().toISOString().slice(0, 7);

// ─── Calculations ─────────────────────────────────────────────────────────────
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

// Monthly profit grouping — groups sold cars by their sold_date month
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

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  back: (c = "#111") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
  plus: (c = "#fff") => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  check: (c = "#fff") => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  trash: (c = "#dc2626") => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>,
  photo: (c = "#9ca3af") => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
  car: (c = "#d1d5db") => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17H5v-5l2.5-6h9L19 12v5z" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M3 12h18" /></svg>,
  chart: (c = "#fff") => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  chevron: (c = "#9ca3af") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  edit: (c = "#374151") => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  download: (c = "#fff") => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  history: (c = "#374151") => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>,
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
const inputSx = { width: "100%", padding: "13px 14px", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 16, color: "#111827", background: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit", WebkitAppearance: "none", appearance: "none" };
const Inp = (props) => <input style={inputSx} {...props} />;
const Sel = ({ children, ...p }) => <select style={{ ...inputSx, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%236b7280' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }} {...p}>{children}</select>;
const Field = ({ label, req, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
      {label}{req && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", full, small, disabled, loading }) => {
  const v = { primary: { background: "#111827", color: "#fff", border: "none" }, outline: { background: "#fff", color: "#111827", border: "1.5px solid #e5e7eb" }, danger: { background: "#fee2e2", color: "#dc2626", border: "none" }, blue: { background: "#1d4ed8", color: "#fff", border: "none" }, green: { background: "#059669", color: "#fff", border: "none" } }[variant];
  return <button onClick={onClick} disabled={disabled || loading} style={{ ...v, width: full ? "100%" : "auto", padding: small ? "10px 16px" : "14px 20px", borderRadius: 12, fontSize: small ? 13 : 15, fontWeight: 700, cursor: (disabled || loading) ? "not-allowed" : "pointer", opacity: (disabled || loading) ? 0.6 : 1, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", letterSpacing: "0.01em", WebkitTapHighlightColor: "transparent" }}>{loading ? "Saving…" : children}</button>;
};
const Badge = ({ children, color }) => <span style={{ background: color === "green" ? "#d1fae5" : color === "blue" ? "#dbeafe" : "#f3f4f6", color: color === "green" ? "#065f46" : color === "blue" ? "#1e40af" : "#374151", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{children}</span>;
const Divider = () => <div style={{ height: 1, background: "#f3f4f6", margin: "14px 0" }} />;
const Spinner = () => <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60, color: "#9ca3af", fontSize: 15 }}>Loading…</div>;

const PhotoUpload = ({ value, onChange, label = "Tap to add photo" }) => {
  const ref = useRef();
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div onClick={() => ref.current.click()} style={{ border: "2px dashed #d1d5db", borderRadius: 14, padding: value ? 8 : 24, textAlign: "center", cursor: "pointer", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, minHeight: value ? "auto" : 90 }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      {value ? <img src={value} alt="upload" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 10, objectFit: "cover" }} /> : <>{Icons.photo()}<span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>{label}</span></>}
    </div>
  );
};

const Shell = ({ title, onBack, action, children }) => (
  <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#f9fafb", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,800&display=swap" rel="stylesheet" />
    <div style={{ background: "#fff", padding: "52px 20px 16px", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
      {onBack && <button onClick={onBack} style={{ background: "none", border: "none", padding: "4px 4px 4px 0", cursor: "pointer", display: "flex", WebkitTapHighlightColor: "transparent" }}>{Icons.back()}</button>}
      <h1 style={{ flex: 1, margin: 0, fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>{title}</h1>
      {action}
    </div>
    <div style={{ padding: "20px 16px 100px" }}>{children}</div>
  </div>
);

// ─── Monthly Profit Modal ─────────────────────────────────────────────────────
const MonthlyProfitModal = ({ cars, expenses, onClose }) => {
  const monthly = calcMonthlyProfits(cars, expenses);
  const now = currentMonth();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, margin: "0 auto", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>Monthly Profit</div>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: 20, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 20px 32px", flex: 1 }}>
          {monthly.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 14 }}>No sold cars yet</div>
          ) : monthly.map(({ month, profit, cars: monthCars }) => (
            <div key={month} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{fmtMonth(month)}</span>
                  {month === now && <Badge color="green">This month</Badge>}
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: profit >= 0 ? "#059669" : "#dc2626" }}>{profit >= 0 ? "+" : ""}{fmt(profit)}</span>
              </div>
              {monthCars.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f9fafb", borderRadius: 10, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{c.model}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>Rego: {c.rego}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: c.profit >= 0 ? "#059669" : "#dc2626" }}>{c.profit >= 0 ? "+" : ""}{fmt(c.profit)}</span>
                </div>
              ))}
              <Divider />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Home Screen ──────────────────────────────────────────────────────────────
const HomeScreen = ({ cars, expenses, loading, onSelectCar, onAddCar, onHistory }) => {
  const [filter, setFilter] = useState("all");
  const [showMonthly, setShowMonthly] = useState(false);
  const filtered = cars.filter(c => filter === "all" ? true : c.status === filter);

  const now = currentMonth();
  const monthly = calcMonthlyProfits(cars, expenses);
  const thisMonth = monthly.find(m => m.month === now);
  const monthProfit = thisMonth ? thisMonth.profit : 0;

  return (
    <Shell title="Tracar" action={<div style={{display:"flex",gap:8}}><Btn onClick={onHistory} variant="outline" small>{Icons.history()} History</Btn><Btn onClick={onAddCar} small>{Icons.plus()} Add Car</Btn></div>}>
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, background: "#111827", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>In Stock</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 2 }}>{cars.filter(c => c.status === "instock").length}</div>
        </div>
        <div style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1.5px solid #e5e7eb" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sold</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", marginTop: 2 }}>{cars.filter(c => c.status === "sold").length}</div>
        </div>
        {/* Monthly profit — tappable */}
        <div onClick={() => setShowMonthly(true)} style={{ flex: 2, background: monthProfit >= 0 ? "#d1fae5" : "#fee2e2", borderRadius: 14, padding: "14px 16px", cursor: "pointer", WebkitTapHighlightColor: "transparent", position: "relative" }}>
          <div style={{ fontSize: 11, color: monthProfit >= 0 ? "#065f46" : "#991b1b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>This Month</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: monthProfit >= 0 ? "#059669" : "#dc2626", marginTop: 2 }}>{monthProfit >= 0 ? "+" : ""}{fmt(monthProfit)}</div>
          <div style={{ fontSize: 11, color: monthProfit >= 0 ? "#6ee7b7" : "#fca5a5", marginTop: 1 }}>as of {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · tap to see all</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["all", "All"], ["instock", "In Stock"], ["sold", "Sold"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 700, background: filter === val ? "#111827" : "#f3f4f6", color: filter === val ? "#fff" : "#6b7280", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>{label}</button>
        ))}
      </div>

      {/* Car list */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          {Icons.car()}
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>No cars yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Tap "Add Car" to get started</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(car => {
            const carExp = getCarExpenses(expenses, car.id);
            const { totalCost } = calcTotals(car, carExp);
            return (
              <div key={car.id} onClick={() => onSelectCar(car)} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1.5px solid #e5e7eb", cursor: "pointer", WebkitTapHighlightColor: "transparent", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                {car.photo ? <div style={{ height: 160, overflow: "hidden" }}><img src={car.photo} alt={car.model} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                  : <div style={{ height: 80, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>{Icons.car()}</div>}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>{car.model}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2, fontWeight: 500 }}>Rego: <strong style={{ color: "#374151" }}>{car.rego || "—"}</strong></div>
                    </div>
                    <Badge color={car.status === "instock" ? "green" : "blue"}>{car.status === "instock" ? "In Stock" : "Sold"}</Badge>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Cost</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginTop: 2 }}>{fmt(totalCost)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expenses</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#374151", marginTop: 2 }}>{carExp.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showMonthly && <MonthlyProfitModal cars={cars} expenses={expenses} onClose={() => setShowMonthly(false)} />}
    </Shell>
  );
};

// ─── Car Detail ───────────────────────────────────────────────────────────────
const CarDetailScreen = ({ car, expenses, onBack, onAddExpense, onMarkSold, onDeleteExpense, onDeleteCar, onEditCar, onEditExpense }) => {
  const carExp = getCarExpenses(expenses, car.id);
  const { totalExpenses, totalCost, justinPaid, angelaPaid } = calcTotals(car, carExp);
  const isSold = car.status === "sold";
  const payout = isSold ? calcPayout(car, carExp) : null;

  return (
    <Shell title={car.model} onBack={onBack}>
      {car.photo && <div style={{ marginBottom: 20, borderRadius: 16, overflow: "hidden", height: 200 }}><img src={car.photo} alt={car.model} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 15, color: "#6b7280", fontWeight: 600 }}>Rego: <span style={{ color: "#111827", fontWeight: 800 }}>{car.rego || "—"}</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge color={isSold ? "blue" : "green"}>{isSold ? "Sold" : "In Stock"}</Badge>
          <button onClick={onEditCar} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>{Icons.edit()} Edit</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Purchase Price", value: fmt(car.purchase_price), sub: car.purchase_date ? fmtDate(car.purchase_date) : undefined },
          { label: "Total Expenses", value: fmt(totalExpenses), sub: `${carExp.length} item${carExp.length !== 1 ? "s" : ""}` },
          { label: "Total Cost", value: fmt(totalCost), accent: true },
          isSold ? { label: "Sell Price", value: fmt(car.sell_price), sub: fmtDate(car.sold_date) } : { label: "Purchase Date", value: car.purchase_date ? fmtDate(car.purchase_date) : "—" },
        ].map((s, i) => (
          <div key={i} style={{ background: s.accent ? "#111827" : "#fff", border: s.accent ? "none" : "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.accent ? "#9ca3af" : "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: s.accent ? "#fff" : "#111827", letterSpacing: "-0.01em" }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: s.accent ? "#6b7280" : "#9ca3af", marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Paid Into This Car (expenses)</div>
        <div style={{ display: "flex", gap: 16 }}>
          {[["Justin", justinPaid], ["Angela", angelaPaid]].map(([name, amt]) => (
            <div key={name} style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginTop: 2 }}>{fmt(amt)}</div>
            </div>
          ))}
        </div>
      </div>

      {isSold && payout && (
        <div style={{ background: payout.profitLoss >= 0 ? "#f0fdf4" : "#fff7f7", border: `1.5px solid ${payout.profitLoss >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: payout.profitLoss >= 0 ? "#065f46" : "#991b1b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            {payout.profitLoss >= 0 ? "🎉 Sale Result" : "📉 Sale Result"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 600 }}>Profit / Loss</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: payout.profitLoss >= 0 ? "#059669" : "#dc2626" }}>{payout.profitLoss >= 0 ? "+" : ""}{fmt(payout.profitLoss)}</span>
          </div>
          <Divider />
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Payouts — costs back + 50/50 split</div>
          {[["Justin", justinPaid, payout.justinPayout], ["Angela", angelaPaid, payout.angelaPayout]].map(([name, paid, pout]) => (
            <div key={name} style={{ padding: "8px 0", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{name} receives</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{fmt(pout)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(paid)} back + {fmt(payout.profitShare)} profit share</div>
            </div>
          ))}
        </div>
      )}

      {!isSold && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <Btn full onClick={onAddExpense}>{Icons.plus()} Add Expense</Btn>
          <Btn variant="blue" onClick={onMarkSold} small>{Icons.check()} Mark Sold</Btn>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>Expenses ({carExp.length})</div>
        {carExp.length === 0 ? (
          <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>No expenses yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...carExp].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(exp => (
              <div key={exp.id} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 8 }}>{exp.type}</span>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{fmtDate(exp.date)}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{fmt(exp.amount)}</div>
                    {exp.description && <div style={{ fontSize: 13, color: "#6b7280" }}>{exp.description}</div>}
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Paid by <strong style={{ color: "#374151" }}>{exp.paid_by}</strong></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: 12 }}>
                    {exp.receipt && <img src={exp.receipt} alt="receipt" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onEditExpense(exp)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", WebkitTapHighlightColor: "transparent" }}>{Icons.edit()}</button>
                      <button onClick={() => onDeleteExpense(exp.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, WebkitTapHighlightColor: "transparent" }}>{Icons.trash()}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
        <Btn variant="danger" full onClick={onDeleteCar}>{Icons.trash()} Delete This Car</Btn>
      </div>
    </Shell>
  );
};

// ─── Add Car ──────────────────────────────────────────────────────────────────
const AddCarScreen = ({ onBack, onSave }) => {
  const [form, setForm] = useState({ model: "", rego: "", purchase_price: "", purchase_date: "", photo: null });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.model && form.rego && form.purchase_price;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };
  return (
    <Shell title="Add Car" onBack={onBack}>
      <Field label="Car Model" req><Inp placeholder="e.g. 2018 Toyota Camry" value={form.model} onChange={e => set("model", e.target.value)} /></Field>
      <Field label="Rego Number" req><Inp placeholder="e.g. ABC123" value={form.rego} onChange={e => set("rego", e.target.value.toUpperCase())} /></Field>
      <Field label="Purchase Price" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} /></Field>
      <Field label="Purchase Date"><Inp type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} /></Field>
      <Field label="Car Photo"><PhotoUpload value={form.photo} onChange={v => set("photo", v)} /></Field>
      <div style={{ marginTop: 8 }}><Btn full onClick={handleSave} disabled={!valid} loading={saving}>{Icons.check()} Add Car</Btn></div>
    </Shell>
  );
};

// ─── Add Expense ──────────────────────────────────────────────────────────────
const AddExpenseScreen = ({ car, onBack, onSave }) => {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: "Parts", description: "", amount: "", paid_by: "Justin", receipt: null });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.date && form.amount && Number(form.amount) > 0;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };
  return (
    <Shell title="Add Expense" onBack={onBack}>
      <div style={{ background: "#f3f4f6", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Adding expense for</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{car.model} — {car.rego}</div>
      </div>
      <Field label="Date" req><Inp type="date" value={form.date} onChange={e => set("date", e.target.value)} /></Field>
      <Field label="Expense Type" req><Sel value={form.type} onChange={e => set("type", e.target.value)}>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</Sel></Field>
      <Field label="Description"><Inp placeholder="What was this for?" value={form.description} onChange={e => set("description", e.target.value)} /></Field>
      <Field label="Amount" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.amount} onChange={e => set("amount", e.target.value)} /></Field>
      <Field label="Paid By" req>
        <div style={{ display: "flex", gap: 10 }}>
          {PAYERS.map(p => (
            <button key={p} onClick={() => set("paid_by", p)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid", borderColor: form.paid_by === p ? "#111827" : "#e5e7eb", background: form.paid_by === p ? "#111827" : "#fff", color: form.paid_by === p ? "#fff" : "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>{p}</button>
          ))}
        </div>
      </Field>
      <Field label="Receipt / Photo"><PhotoUpload value={form.receipt} onChange={v => set("receipt", v)} label="Tap to add receipt photo" /></Field>
      <div style={{ marginTop: 8 }}><Btn full onClick={handleSave} disabled={!valid} loading={saving}>{Icons.check()} Save Expense</Btn></div>
    </Shell>
  );
};

// ─── Mark Sold ────────────────────────────────────────────────────────────────
const MarkSoldScreen = ({ car, expenses, onBack, onSave }) => {
  const [form, setForm] = useState({ sell_price: "", sold_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const carExp = getCarExpenses(expenses, car.id);
  const { totalCost, justinPaid, angelaPaid } = calcTotals(car, carExp);
  const sellPrice = Number(form.sell_price || 0);
  const profitLoss = sellPrice - totalCost;
  const profitShare = profitLoss / 2;
  const hasPreview = sellPrice > 0;
  const valid = form.sell_price && sellPrice > 0;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <Shell title="Mark as Sold" onBack={onBack}>
      <div style={{ background: "#f3f4f6", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Selling</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{car.model} — {car.rego}</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Total cost in: <strong style={{ color: "#111827" }}>{fmt(totalCost)}</strong></div>
      </div>
      <Field label="Sell Price" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.sell_price} onChange={e => set("sell_price", e.target.value)} /></Field>
      <Field label="Sold Date"><Inp type="date" value={form.sold_date} onChange={e => set("sold_date", e.target.value)} /></Field>
      {hasPreview && (
        <div style={{ background: profitLoss >= 0 ? "#f0fdf4" : "#fff7f7", border: `1.5px solid ${profitLoss >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Live Preview</div>
          {[["Total Cost", fmt(totalCost), false], ["Sell Price", fmt(sellPrice), false], ["Profit / Loss", (profitLoss >= 0 ? "+" : "") + fmt(profitLoss), true]].map(([l, v, bold]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: l === "Profit / Loss" ? "1px solid #e5e7eb" : "none", marginTop: l === "Profit / Loss" ? 4 : 0 }}>
              <span style={{ fontSize: 14, color: "#6b7280", fontWeight: bold ? 700 : 600 }}>{l}</span>
              <span style={{ fontSize: bold ? 16 : 14, fontWeight: 800, color: bold ? (profitLoss >= 0 ? "#059669" : "#dc2626") : "#111827" }}>{v}</span>
            </div>
          ))}
          <Divider />
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Payouts — costs back + 50/50 split</div>
          {[["Justin", justinPaid, justinPaid + profitShare], ["Angela", angelaPaid, angelaPaid + profitShare]].map(([name, paid, pout]) => (
            <div key={name} style={{ padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{name} receives</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{fmt(pout)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{fmt(paid)} back + {fmt(profitShare)} profit share</div>
            </div>
          ))}
        </div>
      )}
      <Btn full variant="blue" onClick={handleSave} disabled={!valid} loading={saving}>{Icons.check()} Confirm Sale</Btn>
    </Shell>
  );
};

// ─── Edit Car ─────────────────────────────────────────────────────────────────
const EditCarScreen = ({ car, onBack, onSave }) => {
  const [form, setForm] = useState({
    model: car.model || "",
    rego: car.rego || "",
    purchase_price: car.purchase_price || "",
    purchase_date: car.purchase_date || "",
    photo: car.photo || null,
    sell_price: car.sell_price || "",
    sold_date: car.sold_date || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.model && form.rego && form.purchase_price;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };
  return (
    <Shell title="Edit Car" onBack={onBack}>
      <Field label="Car Model" req><Inp placeholder="e.g. 2018 Toyota Camry" value={form.model} onChange={e => set("model", e.target.value)} /></Field>
      <Field label="Rego Number" req><Inp placeholder="e.g. ABC123" value={form.rego} onChange={e => set("rego", e.target.value.toUpperCase())} /></Field>
      <Field label="Purchase Price" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} /></Field>
      <Field label="Purchase Date"><Inp type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} /></Field>
      {car.status === "sold" && (
        <>
          <Field label="Sell Price"><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.sell_price} onChange={e => set("sell_price", e.target.value)} /></Field>
          <Field label="Sold Date"><Inp type="date" value={form.sold_date} onChange={e => set("sold_date", e.target.value)} /></Field>
        </>
      )}
      <Field label="Car Photo"><PhotoUpload value={form.photo} onChange={v => set("photo", v)} /></Field>
      <div style={{ marginTop: 8 }}><Btn full onClick={handleSave} disabled={!valid} loading={saving}>{Icons.check()} Save Changes</Btn></div>
    </Shell>
  );
};

// ─── Edit Expense ─────────────────────────────────────────────────────────────
const EditExpenseScreen = ({ car, expense, onBack, onSave }) => {
  const [form, setForm] = useState({
    date: expense.date || new Date().toISOString().slice(0, 10),
    type: expense.type || "Parts",
    description: expense.description || "",
    amount: expense.amount || "",
    paid_by: expense.paid_by || "Justin",
    receipt: expense.receipt || null,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.date && form.amount && Number(form.amount) > 0;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };
  return (
    <Shell title="Edit Expense" onBack={onBack}>
      <div style={{ background: "#f3f4f6", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Editing expense for</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{car.model} — {car.rego}</div>
      </div>
      <Field label="Date" req><Inp type="date" value={form.date} onChange={e => set("date", e.target.value)} /></Field>
      <Field label="Expense Type" req><Sel value={form.type} onChange={e => set("type", e.target.value)}>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</Sel></Field>
      <Field label="Description"><Inp placeholder="What was this for?" value={form.description} onChange={e => set("description", e.target.value)} /></Field>
      <Field label="Amount" req><Inp type="number" placeholder="0.00" inputMode="decimal" value={form.amount} onChange={e => set("amount", e.target.value)} /></Field>
      <Field label="Paid By" req>
        <div style={{ display: "flex", gap: 10 }}>
          {PAYERS.map(p => (
            <button key={p} onClick={() => set("paid_by", p)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid", borderColor: form.paid_by === p ? "#111827" : "#e5e7eb", background: form.paid_by === p ? "#111827" : "#fff", color: form.paid_by === p ? "#fff" : "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>{p}</button>
          ))}
        </div>
      </Field>
      <Field label="Receipt / Photo"><PhotoUpload value={form.receipt} onChange={v => set("receipt", v)} label="Tap to update receipt photo" /></Field>
      <div style={{ marginTop: 8 }}><Btn full onClick={handleSave} disabled={!valid} loading={saving}>{Icons.check()} Save Changes</Btn></div>
    </Shell>
  );
};

// ─── Sales History Screen ─────────────────────────────────────────────────────
const SalesHistoryScreen = ({ cars, expenses, onBack }) => {
  const sold = cars.filter(c => c.status === "sold").sort((a, b) => (b.sold_date || "").localeCompare(a.sold_date || ""));

  const downloadCSV = () => {
    const rows = [
      ["Car", "Rego", "Purchase Date", "Sold Date", "Purchase Price", "Total Expenses", "Total Cost", "Sell Price", "Profit/Loss", "Justin Paid", "Angela Paid", "Justin Payout", "Angela Payout"]
    ];
    sold.forEach(car => {
      const carExp = getCarExpenses(expenses, car.id);
      const { totalExpenses, totalCost, justinPaid, angelaPaid } = calcTotals(car, carExp);
      const { profitLoss, justinPayout, angelaPayout } = calcPayout(car, carExp);
      rows.push([
        car.model,
        car.rego,
        car.purchase_date || "",
        car.sold_date || "",
        car.purchase_price,
        totalExpenses.toFixed(2),
        totalCost.toFixed(2),
        car.sell_price || "",
        profitLoss.toFixed(2),
        justinPaid.toFixed(2),
        angelaPaid.toFixed(2),
        justinPayout.toFixed(2),
        angelaPayout.toFixed(2),
      ]);
    });
    // Add totals row
    const totalProfit = sold.reduce((s, car) => {
      const { profitLoss } = calcPayout(car, getCarExpenses(expenses, car.id));
      return s + profitLoss;
    }, 0);
    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", "", "", "", totalProfit.toFixed(2), "", "", "", ""]);

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracar-sales-history-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalProfit = sold.reduce((s, car) => {
    const { profitLoss } = calcPayout(car, getCarExpenses(expenses, car.id));
    return s + profitLoss;
  }, 0);

  return (
    <Shell title="Sales History" onBack={onBack} action={
      <Btn onClick={downloadCSV} small variant="primary">{Icons.download()} Export CSV</Btn>
    }>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#111827", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cars Sold</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 2 }}>{sold.length}</div>
        </div>
        <div style={{ background: totalProfit >= 0 ? "#d1fae5" : "#fee2e2", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: totalProfit >= 0 ? "#065f46" : "#991b1b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Profit</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: totalProfit >= 0 ? "#059669" : "#dc2626", marginTop: 2 }}>{totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)}</div>
        </div>
      </div>

      {sold.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No sold cars yet</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sold.map(car => {
            const carExp = getCarExpenses(expenses, car.id);
            const { totalExpenses, totalCost, justinPaid, angelaPaid } = calcTotals(car, carExp);
            const { profitLoss, justinPayout, angelaPayout } = calcPayout(car, carExp);
            return (
              <div key={car.id} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                {/* Header */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{car.model}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Rego: <strong style={{ color: "#374151" }}>{car.rego}</strong></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: profitLoss >= 0 ? "#059669" : "#dc2626" }}>{profitLoss >= 0 ? "+" : ""}{fmt(profitLoss)}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>profit / loss</div>
                    </div>
                  </div>
                </div>
                {/* Details grid */}
                <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Buy", value: fmt(car.purchase_price) },
                    { label: "Expenses", value: fmt(totalExpenses) },
                    { label: "Sell", value: fmt(car.sell_price) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginTop: 2 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {/* Dates */}
                <div style={{ padding: "0 16px 10px", display: "flex", gap: 16 }}>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>Bought: <span style={{ color: "#6b7280", fontWeight: 600 }}>{fmtDate(car.purchase_date)}</span></div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>Sold: <span style={{ color: "#6b7280", fontWeight: 600 }}>{fmtDate(car.sold_date)}</span></div>
                </div>
                {/* Payouts */}
                <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 16 }}>
                  {[["Justin", justinPayout], ["Angela", angelaPayout]].map(([name, payout]) => (
                    <div key={name} style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{name} receives</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginTop: 2 }}>{fmt(payout)}</div>
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

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cars, setCars] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [selectedCarId, setSelectedCarId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // Load all data
  const fetchData = async () => {
    const [{ data: carsData }, { data: expData }] = await Promise.all([
      supabase.from("cars").select("*").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
    ]);
    setCars(carsData || []);
    setExpenses(expData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const selectedCar = cars.find(c => c.id === selectedCarId);

  const handleAddCar = async (form) => {
    const { data, error } = await supabase.from("cars").insert([{
      model: form.model,
      rego: form.rego,
      purchase_price: Number(form.purchase_price),
      purchase_date: form.purchase_date || null,
      photo: form.photo || null,
      status: "instock",
    }]).select().single();
    if (!error && data) {
      setCars(prev => [data, ...prev]);
      setSelectedCarId(data.id);
      setScreen("car");
    }
  };

  const handleAddExpense = async (form) => {
    const { data, error } = await supabase.from("expenses").insert([{
      car_id: selectedCarId,
      date: form.date,
      type: form.type,
      description: form.description || null,
      amount: Number(form.amount),
      paid_by: form.paid_by,
      receipt: form.receipt || null,
    }]).select().single();
    if (!error && data) {
      setExpenses(prev => [data, ...prev]);
      setScreen("car");
    }
  };

  const handleMarkSold = async (form) => {
    const { data, error } = await supabase.from("cars").update({
      status: "sold",
      sell_price: Number(form.sell_price),
      sold_date: form.sold_date || null,
    }).eq("id", selectedCarId).select().single();
    if (!error && data) {
      setCars(prev => prev.map(c => c.id === selectedCarId ? data : c));
      setScreen("car");
    }
  };

  const handleDeleteExpense = async (expId) => {
    await supabase.from("expenses").delete().eq("id", expId);
    setExpenses(prev => prev.filter(e => e.id !== expId));
  };

  const handleEditCar = async (form) => {
    const { data, error } = await supabase.from("cars").update({
      model: form.model,
      rego: form.rego,
      purchase_price: Number(form.purchase_price),
      purchase_date: form.purchase_date || null,
      photo: form.photo || null,
      ...(form.sell_price ? { sell_price: Number(form.sell_price) } : {}),
      ...(form.sold_date ? { sold_date: form.sold_date } : {}),
    }).eq("id", selectedCarId).select().single();
    if (!error && data) {
      setCars(prev => prev.map(c => c.id === selectedCarId ? data : c));
      setScreen("car");
    }
  };

  const handleEditExpense = async (form) => {
    const { data, error } = await supabase.from("expenses").update({
      date: form.date,
      type: form.type,
      description: form.description || null,
      amount: Number(form.amount),
      paid_by: form.paid_by,
      receipt: form.receipt || null,
    }).eq("id", editingExpense.id).select().single();
    if (!error && data) {
      setExpenses(prev => prev.map(e => e.id === editingExpense.id ? data : e));
      setEditingExpense(null);
      setScreen("car");
    }
  };

  const handleDeleteCar = async () => {
    if (!window.confirm("Delete this car and all its expenses?")) return;
    await supabase.from("expenses").delete().eq("car_id", selectedCarId);
    await supabase.from("cars").delete().eq("id", selectedCarId);
    setCars(prev => prev.filter(c => c.id !== selectedCarId));
    setExpenses(prev => prev.filter(e => e.car_id !== selectedCarId));
    setScreen("home");
  };

  if (screen === "add-car") return <AddCarScreen onBack={() => setScreen("home")} onSave={handleAddCar} />;
  if (screen === "add-expense" && selectedCar) return <AddExpenseScreen car={selectedCar} onBack={() => setScreen("car")} onSave={handleAddExpense} />;
  if (screen === "sell" && selectedCar) return <MarkSoldScreen car={selectedCar} expenses={expenses} onBack={() => setScreen("car")} onSave={handleMarkSold} />;
  if (screen === "edit-car" && selectedCar) return <EditCarScreen car={selectedCar} onBack={() => setScreen("car")} onSave={handleEditCar} />;
  if (screen === "edit-expense" && selectedCar && editingExpense) return <EditExpenseScreen car={selectedCar} expense={editingExpense} onBack={() => { setEditingExpense(null); setScreen("car"); }} onSave={handleEditExpense} />;
  if (screen === "car" && selectedCar) return <CarDetailScreen car={selectedCar} expenses={expenses} onBack={() => setScreen("home")} onAddExpense={() => setScreen("add-expense")} onMarkSold={() => setScreen("sell")} onDeleteExpense={handleDeleteExpense} onDeleteCar={handleDeleteCar} onEditCar={() => setScreen("edit-car")} onEditExpense={(exp) => { setEditingExpense(exp); setScreen("edit-expense"); }} />;
  if (screen === "history") return <SalesHistoryScreen cars={cars} expenses={expenses} onBack={() => setScreen("home")} />;
  return <HomeScreen cars={cars} expenses={expenses} loading={loading} onSelectCar={(car) => { setSelectedCarId(car.id); setScreen("car"); }} onAddCar={() => setScreen("add-car")} onHistory={() => setScreen("history")} />;
}
