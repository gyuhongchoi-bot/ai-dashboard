import React, { useState, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart, Line } from "recharts";

const C = {
  bg: "#08090D", surface: "#11131A", card: "#161922", border: "#252A3A",
  text: "#EAEDF4", textSec: "#9BA1B7", textMute: "#636A82",
  linkedin: "#0A66C2", linkedinSoft: "#0A66C220",
  meta: "#00C9A7", metaSoft: "#00C9A720",
  ga4: "#F09300", ga4Soft: "#F0930020",
  accent: "#7C6AEF", accentSoft: "#7C6AEF18",
  up: "#34D399", upSoft: "#34D39918",
  down: "#F87171", downSoft: "#F8717118",
  warn: "#FBBF24", warnSoft: "#FBBF2418",
};

// ── CSV Parser ──
function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const result = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if ((ch === "," || ch === "\t") && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

function autoNum(v) {
  if (v === "" || v === undefined || v === null) return 0;
  const cleaned = String(v).replace(/[$,%\s]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

// ── CSV → Dashboard Data Mappers ──
function mapLinkedIn(rows) {
  return rows.map(r => {
    const name = r["광고 세트 이름"] || r["ad_set"] || r["name"] || "Unknown";
    return {
      name, spend: autoNum(r["총 지출"] || r["spend"] || r["지출"]),
      imp: autoNum(r["노출수"] || r["impressions"] || r["노출"]),
      click: autoNum(r["클릭"] || r["clicks"] || r["클릭수"]),
      ctr: autoNum(r["클릭률"] || r["ctr"] || r["CTR"]),
      cpc: autoNum(r["평균 CPC"] || r["cpc"] || r["CPC"]),
      cpm: autoNum(r["평균 CPM"] || r["cpm"] || r["CPM"]),
      lp: autoNum(r["랜딩 페이지 클릭"] || r["lp"] || r["랜딩페이지 클릭"]),
      eng: autoNum(r["총 참여"] || r["engagements"] || r["참여수"]),
    };
  }).filter(d => d.name !== "Unknown" || d.spend > 0);
}

function mapMeta(rows) {
  return rows.map(r => {
    const name = r["광고 세트 이름"] || r["ad_set"] || r["name"] || "Unknown";
    return {
      name, spend: autoNum(r["지출 금액 (USD)"] || r["spend"] || r["지출"]),
      imp: autoNum(r["노출"] || r["impressions"] || r["노출수"]),
      reach: autoNum(r["도달"] || r["reach"]),
      click: autoNum(r["클릭(전체)"] || r["clicks"] || r["클릭수"]),
      ctr: autoNum(r["CTR(전체)"] || r["ctr"] || r["CTR"]),
      cpc: autoNum(r["CPC(전체) (USD)"] || r["cpc"] || r["CPC"]),
      link: autoNum(r["링크 클릭"] || r["link_clicks"] || r["링크클릭"]),
      lp: autoNum(r["웹사이트 랜딩 페이지 조회수"] || r["landing_page_views"] || r["LP조회"]),
    };
  }).filter(d => d.name !== "Unknown" || d.spend > 0);
}

function mapGA4(rows) {
  return rows.map(r => {
    const source = r["세션 소스/매체"] || r["source_medium"] || r["소스/매체"] || r["Session source / medium"] || "";
    const campaign = r["세션 캠페인"] || r["campaign"] || r["Campaign"] || "";
    let label = source;
    if (source.includes("instagram") || source.includes("facebook")) label = `Meta 광고${campaign ? " - " + campaign : ""}`;
    else if (source.includes("linkedin")) label = `LinkedIn 광고${campaign ? " - " + campaign : ""}`;
    else if (source.includes("google") && source.includes("organic")) label = "구글 자연검색";
    else if (source.includes("direct")) label = "직접 유입";
    else if (source.includes("google") && (source.includes("cpc") || source.includes("paid"))) label = "구글 광고";
    return {
      label, source,
      sessions: autoNum(r["세션수"] || r["sessions"] || r["세션"] || r["Sessions"]),
      users: autoNum(r["사용자"] || r["users"] || r["총 사용자 수"] || r["Total users"]),
      newUsers: autoNum(r["신규 사용자"] || r["new_users"] || r["새 사용자 수"] || r["New users"]),
      pps: autoNum(r["세션당 페이지수"] || r["pages_per_session"] || r["사용자당 조회수"] || r["Views per session"]),
      dur: autoNum(r["평균 세션 시간"] || r["avg_session_duration"] || r["평균 참여 시간"] || r["Average engagement time"]),
      bounce: autoNum(r["이탈률"] || r["bounce_rate"] || r["Bounce rate"]),
      conv: autoNum(r["전환수"] || r["conversions"] || r["전환"] || r["Conversions"]),
    };
  }).filter(d => d.sessions > 0);
}

// ── Default Data ──
const DEF_LI = [
  { name: "디자이너 세트", spend: 12.18, imp: 356, click: 3, ctr: 0.84, cpc: 4.06, cpm: 34.20, lp: 3, eng: 10 },
  { name: "마케터 세트", spend: 12.24, imp: 217, click: 4, ctr: 1.84, cpc: 3.06, cpm: 56.39, lp: 4, eng: 11 },
  { name: "개발자 세트", spend: 11.62, imp: 416, click: 8, ctr: 1.92, cpc: 1.45, cpm: 27.94, lp: 8, eng: 20 },
  { name: "경영지원/운영 세트", spend: 11.23, imp: 252, click: 5, ctr: 1.98, cpc: 2.25, cpm: 44.56, lp: 5, eng: 12 },
  { name: "기획 세트", spend: 11.56, imp: 251, click: 5, ctr: 1.99, cpc: 2.31, cpm: 46.06, lp: 5, eng: 16 },
  { name: "세일즈 세트", spend: 11.54, imp: 256, click: 4, ctr: 1.56, cpc: 2.89, cpm: 45.09, lp: 4, eng: 9 },
  { name: "지원자 모집", spend: 33.06, imp: 2850, click: 83, ctr: 2.91, cpc: 0.40, cpm: 11.60, lp: 83, eng: 196 },
];
const DEF_META = [
  { name: "디자이너 세트", spend: 4.20, imp: 1030, reach: 929, click: 54, ctr: 5.24, cpc: 0.078, link: 50, lp: 43 },
  { name: "마케터 세트", spend: 4.09, imp: 992, reach: 910, click: 39, ctr: 3.93, cpc: 0.105, link: 37, lp: 33 },
  { name: "개발자 세트", spend: 3.51, imp: 1117, reach: 985, click: 29, ctr: 2.60, cpc: 0.121, link: 26, lp: 25 },
  { name: "기획 세트", spend: 3.91, imp: 1217, reach: 1129, click: 43, ctr: 3.53, cpc: 0.091, link: 41, lp: 34 },
  { name: "세일즈 세트", spend: 3.35, imp: 849, reach: 800, click: 24, ctr: 2.83, cpc: 0.140, link: 23, lp: 22 },
];
const DEF_GA4 = [
  { label: "Meta 광고", source: "instagram / paid", sessions: 156, users: 138, newUsers: 125, pps: 3.1, dur: 120, bounce: 35, conv: 8 },
  { label: "LinkedIn 광고", source: "linkedin / paid", sessions: 89, users: 72, newUsers: 65, pps: 2.4, dur: 95, bounce: 42, conv: 3 },
  { label: "구글 자연검색", source: "google / organic", sessions: 340, users: 295, newUsers: 210, pps: 2.1, dur: 85, bounce: 48, conv: 12 },
  { label: "직접 유입", source: "(direct) / (none)", sessions: 180, users: 155, newUsers: 90, pps: 1.8, dur: 70, bounce: 52, conv: 5 },
  { label: "구글 광고", source: "google / cpc", sessions: 45, users: 38, newUsers: 35, pps: 2.8, dur: 110, bounce: 38, conv: 2 },
];

// ── UI Components ──
// Global tooltip context - managed at Dashboard level, InfoTip just triggers it
let _showGlobalTip = null;
let _hideGlobalTip = null;

const InfoTip = ({ text }) => {
  const handleEnter = (e) => {
    if (!_showGlobalTip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    _showGlobalTip(text, rect.left - 40, rect.bottom + 8);
  };
  const handleLeave = () => { if (_hideGlobalTip) _hideGlobalTip(); };
  return (
    <span style={{ display: "inline-flex", marginLeft: 4, cursor: "help" }}
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: C.border, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: C.textMute, flexShrink: 0 }}>?</span>
    </span>
  );
};

const GlobalTooltip = () => {
  const [tip, setTip] = useState(null);
  _showGlobalTip = useCallback((text, x, y) => setTip({ text, x, y }), []);
  _hideGlobalTip = useCallback(() => setTip(null), []);
  if (!tip) return null;
  return (
    <div style={{
      position: "fixed", left: Math.min(tip.x, window.innerWidth - 260), top: tip.y,
      background: "#0D0E14", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px",
      fontSize: 11, color: C.textSec, lineHeight: 1.6, width: 240, zIndex: 99999,
      boxShadow: "0 12px 40px rgba(0,0,0,0.9)", whiteSpace: "normal",
      pointerEvents: "none", letterSpacing: 0, fontWeight: 400, textTransform: "none",
    }}>{tip.text}</div>
  );
};

const KPI = ({ label, value, sub, color, tip }) => (
  <div style={{ background: C.card, borderRadius: 12, padding: "18px 20px", border: `1px solid ${C.border}`, flex: 1, minWidth: 148, transition: "border-color 0.2s" }}
    onMouseEnter={e => e.currentTarget.style.borderColor = color} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
    <div style={{ fontSize: 10, color: C.textMute, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center" }}>
      {label}{tip && <InfoTip text={tip} />}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.textMute, marginTop: 6 }}>{sub}</div>}
  </div>
);
const Crd = ({ children, style = {}, title, badge, tip }) => (
  <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, ...style }}>
    {title && <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: -0.3, display: "flex", alignItems: "center" }}>
        {title}{tip && <InfoTip text={tip} />}
      </span>
      {badge && <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.text}</span>}
    </div>}
    <div style={{ padding: "14px 20px 20px" }}>{children}</div>
  </div>
);
const Bdg = ({ p }) => {
  const m = { LinkedIn: { bg: C.linkedinSoft, c: C.linkedin }, Meta: { bg: C.metaSoft, c: C.meta } };
  const s = m[p] || { bg: C.ga4Soft, c: C.ga4 };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: s.bg, color: s.c }}>{p}</span>;
};
const TTC = { contentStyle: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" } };

export default function Dashboard() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");
  const [liData, setLiData] = useState(DEF_LI);
  const [metaData, setMetaData] = useState(DEF_META);
  const [ga4Data, setGa4Data] = useState(DEF_GA4);
  const [lastUpd, setLastUpd] = useState({ li: "2026-03-25", meta: "2026-03-25", ga4: "샘플" });

  const [editSrc, setEditSrc] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [msg, setMsg] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleParse = () => {
    try {
      const { headers, rows } = parseCSV(csvText);
      if (rows.length === 0) throw new Error("데이터 행이 없습니다");
      let mapped;
      if (editSrc === "li") mapped = mapLinkedIn(rows);
      else if (editSrc === "meta") mapped = mapMeta(rows);
      else mapped = mapGA4(rows);
      if (mapped.length === 0) throw new Error("매핑된 데이터가 없습니다. 컬럼명을 확인해주세요.");
      setPreview({ headers, rowCount: rows.length, mapped, sample: mapped.slice(0, 3) });
      setMsg({ type: "success", text: `${rows.length}행 파싱 완료 → ${mapped.length}개 데이터 인식됨. 미리보기를 확인하고 '적용' 버튼을 눌러주세요.` });
    } catch (e) {
      setMsg({ type: "error", text: `파싱 오류: ${e.message}` });
      setPreview(null);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const now = new Date().toLocaleDateString("ko-KR");
    if (editSrc === "li") setLiData(preview.mapped);
    else if (editSrc === "meta") setMetaData(preview.mapped);
    else setGa4Data(preview.mapped);
    setLastUpd(prev => ({ ...prev, [editSrc]: now }));
    setMsg({ type: "success", text: `${editSrc.toUpperCase()} 데이터가 성공적으로 반영되었습니다!` });
    setTimeout(() => { setEditSrc(null); setMsg(null); setPreview(null); setCsvText(""); }, 1500);
  };

  const short = n => n.replace(" 세트", "").replace("/운영", "");
  const TLi = { spend: liData.reduce((s,d) => s+d.spend,0), imp: liData.reduce((s,d) => s+d.imp,0), click: liData.reduce((s,d) => s+d.click,0), lp: liData.reduce((s,d) => s+d.lp,0), eng: liData.reduce((s,d) => s+d.eng,0) };
  const TMeta = { spend: metaData.reduce((s,d) => s+d.spend,0), imp: metaData.reduce((s,d) => s+d.imp,0), click: metaData.reduce((s,d) => s+d.click,0), link: metaData.reduce((s,d) => s+d.link,0), lp: metaData.reduce((s,d) => s+d.lp,0) };
  const TGa4 = { sessions: ga4Data.reduce((s,d) => s+d.sessions,0), users: ga4Data.reduce((s,d) => s+d.users,0), conv: ga4Data.reduce((s,d) => s+d.conv,0) };
  const totalSpend = TLi.spend + TMeta.spend;
  const totalImp = TLi.imp + TMeta.imp;
  const totalClick = TLi.click + TMeta.click;
  const adSets = liData.map(li => ({ name: li.name, li, meta: metaData.find(m => m.name === li.name) || null }));
  const filtered = filter === "meta" ? adSets.filter(d => d.meta) : adSets;

  // ── Data Manager ──
  const renderDataManager = () => {
    const sources = [
      { key: "li", label: "LinkedIn", color: C.linkedin, icon: "🔗", updated: lastUpd.li, count: liData.length,
        placeholder: `LinkedIn CSV를 여기에 붙여넣으세요.\n\n예시 (탭 구분):\n광고 세트 이름\t총 지출\t노출수\t클릭\t클릭률\t평균 CPC\t평균 CPM\t랜딩 페이지 클릭\t총 참여\n디자이너 세트\t12.18\t356\t3\t0.84%\t4.06\t34.20\t3\t10` },
      { key: "meta", label: "Meta", color: C.meta, icon: "📘", updated: lastUpd.meta, count: metaData.length,
        placeholder: `Meta CSV를 여기에 붙여넣으세요.\n\n예시 (쉼표 구분):\n광고 세트 이름,지출 금액 (USD),노출,도달,클릭(전체),CTR(전체),CPC(전체) (USD),링크 클릭,웹사이트 랜딩 페이지 조회수\n디자이너 세트,4.20,1030,929,54,5.24,0.078,50,43` },
      { key: "ga4", label: "GA4", color: C.ga4, icon: "📊", updated: lastUpd.ga4, count: ga4Data.length,
        placeholder: `GA4 탐색 보고서 CSV를 여기에 붙여넣으세요.\n\n예시 (쉼표 구분):\n세션 소스/매체,세션 캠페인,세션수,사용자,신규 사용자,세션당 페이지수,평균 세션 시간,이탈률,전환수\ninstagram / paid,designer,156,138,125,3.1,120,35,8` },
    ];

    return (
      <>
        <Crd title="데이터 업데이트" badge={{ text: "CSV 직접 붙여넣기", bg: C.accentSoft, color: C.accent }} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 16, lineHeight: 1.7 }}>
            광고 관리자 또는 GA4에서 <strong style={{ color: C.text }}>CSV를 다운로드</strong>한 후, 파일을 열어 <strong style={{ color: C.text }}>전체 선택(Ctrl+A) → 복사(Ctrl+C)</strong> 하고 아래 편집기에 <strong style={{ color: C.text }}>붙여넣기(Ctrl+V)</strong> 하면 됩니다.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {sources.map(src => (
              <div key={src.key} style={{ background: C.surface, borderRadius: 12, border: `1px solid ${editSrc === src.key ? src.color : C.border}`, padding: "18px 16px", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{src.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: src.color }}>{src.label}</span>
                </div>
                <div style={{ fontSize: 10, color: C.textMute, marginBottom: 2 }}>최종 업데이트</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{src.updated}</div>
                <div style={{ fontSize: 10, color: C.textMute, marginBottom: 14 }}>{src.count}개 {src.key === "ga4" ? "소스" : "광고세트"}</div>
                <button onClick={() => { setEditSrc(src.key); setCsvText(""); setMsg(null); setPreview(null); }} style={{
                  width: "100%", padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
                  background: editSrc === src.key ? src.color : `${src.color}30`, color: editSrc === src.key ? "#fff" : src.color,
                  fontSize: 12, fontWeight: 700, transition: "all 0.2s",
                }}>
                  {editSrc === src.key ? "편집 중..." : "CSV 붙여넣기"}
                </button>
              </div>
            ))}
          </div>
        </Crd>

        {editSrc && (
          <Crd title={`${sources.find(s=>s.key===editSrc).label} CSV 입력`}
            badge={{ text: "CSV 또는 TSV", bg: sources.find(s=>s.key===editSrc).color + "20", color: sources.find(s=>s.key===editSrc).color }}
            style={{ marginBottom: 16 }}>
            <textarea value={csvText} onChange={e => { setCsvText(e.target.value); setPreview(null); setMsg(null); }}
              placeholder={sources.find(s=>s.key===editSrc).placeholder}
              style={{
                width: "100%", height: 220, background: C.bg, color: C.text, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: 14, fontSize: 11, fontFamily: "'Fira Code', 'Courier New', monospace",
                lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
            />

            {msg && (
              <div style={{
                marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: msg.type === "success" ? C.upSoft : C.downSoft,
                color: msg.type === "success" ? C.up : C.down,
                border: `1px solid ${msg.type === "success" ? C.up : C.down}33`,
              }}>{msg.text}</div>
            )}

            {preview && (
              <div style={{ marginTop: 12, padding: 14, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>미리보기 ({preview.mapped.length}건)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead><tr>{Object.keys(preview.sample[0] || {}).map(k => (
                      <th key={k} style={{ padding: "6px 8px", textAlign: "left", color: C.textMute, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{k}</th>
                    ))}</tr></thead>
                    <tbody>{preview.sample.map((row, i) => (
                      <tr key={i}>{Object.values(row).map((v, j) => (
                        <td key={j} style={{ padding: "6px 8px", color: C.textSec, borderBottom: `1px solid ${C.border}22`, whiteSpace: "nowrap" }}>{typeof v === "number" ? (v % 1 === 0 ? v : v.toFixed(3)) : String(v)}</td>
                      ))}</tr>
                    ))}
                    {preview.mapped.length > 3 && <tr><td colSpan={99} style={{ padding: "6px 8px", color: C.textMute, fontStyle: "italic" }}>... 외 {preview.mapped.length - 3}건</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleParse} disabled={!csvText.trim()} style={{
                padding: "10px 24px", borderRadius: 8, border: "none", cursor: csvText.trim() ? "pointer" : "not-allowed",
                background: C.accent, color: "#fff", fontSize: 12, fontWeight: 700, opacity: csvText.trim() ? 1 : 0.4,
              }}>파싱하기</button>
              {preview && <button onClick={handleApply} style={{
                padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                background: C.up, color: "#fff", fontSize: 12, fontWeight: 700,
              }}>대시보드에 적용</button>}
              <button onClick={() => { setEditSrc(null); setMsg(null); setPreview(null); setCsvText(""); }} style={{
                padding: "10px 24px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer",
                background: "transparent", color: C.textSec, fontSize: 12, fontWeight: 600,
              }}>취소</button>
              <button onClick={() => {
                const d = { li: DEF_LI, meta: DEF_META, ga4: DEF_GA4 };
                if (editSrc === "li") setLiData(d.li);
                if (editSrc === "meta") setMetaData(d.meta);
                if (editSrc === "ga4") setGa4Data(d.ga4);
                setLastUpd(prev => ({ ...prev, [editSrc]: "샘플 복원" }));
                setMsg({ type: "success", text: "기본 샘플 데이터로 복원되었습니다." });
                setPreview(null);
              }} style={{
                padding: "10px 16px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer",
                background: "transparent", color: C.textMute, fontSize: 11, fontWeight: 600, marginLeft: "auto",
              }}>기본값 복원</button>
            </div>
          </Crd>
        )}

        <Crd title="사용 방법" badge={{ text: "3단계", bg: C.warnSoft, color: C.warn }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { step: "1", title: "CSV 다운로드", desc: "LinkedIn 캠페인 관리자\nMeta 광고 관리자\nGA4 탐색 보고서\n에서 CSV 내보내기", color: C.accent },
              { step: "2", title: "CSV 열고 복사", desc: "다운받은 CSV 파일을 열고\nCtrl+A (전체 선택)\nCtrl+C (복사)", color: C.warn },
              { step: "3", title: "붙여넣기 & 적용", desc: "위 편집기에 Ctrl+V\n'파싱하기' → 미리보기 확인\n'대시보드에 적용' 클릭", color: C.up },
            ].map((item, i) => (
              <div key={i} style={{ padding: "16px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: item.color + "20", color: item.color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 15, fontWeight: 800 }}>{item.step}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.textSec, whiteSpace: "pre-line", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Crd>
      </>
    );
  };

  // ── Overview ──
  const renderOverview = () => (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="총 광고비" value={`$${totalSpend.toFixed(2)}`} sub="LinkedIn + Meta" color={C.accent} tip="LinkedIn과 Meta에 실제로 지출된 광고 비용의 합계입니다." />
        <KPI label="총 노출수" value={totalImp.toLocaleString()} color={C.up} tip="광고가 사용자 화면에 표시된 횟수입니다. 한 사람이 여러 번 볼 수 있어 도달(Reach)과 다릅니다." />
        <KPI label="총 클릭수" value={totalClick.toLocaleString()} sub={`CTR ${totalImp > 0 ? (totalClick/totalImp*100).toFixed(2) : 0}%`} color={C.warn} tip="광고를 클릭한 총 횟수입니다. 프로필 클릭, 링크 클릭 등 모든 클릭을 포함합니다." />
        <KPI label="GA4 세션" value={TGa4.sessions.toLocaleString()} sub={`${TGa4.users}명 방문`} color={C.ga4} tip="웹사이트 방문 횟수입니다. 한 사용자가 여러 세션을 가질 수 있습니다. 30분 이상 비활성 시 새 세션으로 집계됩니다." />
        <KPI label="전환" value={TGa4.conv.toString()} sub={`전환율 ${TGa4.sessions > 0 ? (TGa4.conv/TGa4.sessions*100).toFixed(1) : 0}%`} color={C.up} tip="GA4에서 설정한 목표 행동(지원서 제출, 버튼 클릭 등)을 완료한 횟수입니다. 전환율 = 전환수 ÷ 세션수." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, marginBottom: 14 }}>
        <Crd title="플랫폼별 지출" tip="LinkedIn과 Meta 각각의 광고비 비중입니다. 어느 플랫폼에 예산이 더 집중되었는지 확인할 수 있습니다.">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart><Pie data={[{ name: "LinkedIn", value: TLi.spend },{ name: "Meta", value: TMeta.spend }]} cx="50%" cy="50%" innerRadius={48} outerRadius={74} dataKey="value" stroke="none">
              <Cell fill={C.linkedin} /><Cell fill={C.meta} />
            </Pie><Tooltip {...TTC} formatter={v => `$${v.toFixed(2)}`} /></PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, color: C.textSec }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.linkedin, marginRight: 5 }}/>LinkedIn ${TLi.spend.toFixed(0)}</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.meta, marginRight: 5 }}/>Meta ${TMeta.spend.toFixed(0)}</span>
          </div>
        </Crd>
        <Crd title="광고 세트별 지출 비교" badge={{ text: "USD", bg: C.accentSoft, color: C.accent }} tip="각 광고 세트(타겟 직군)별로 LinkedIn과 Meta에서 얼마나 지출했는지 비교합니다. 막대가 길수록 지출이 많습니다.">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={adSets.map(d => ({ name: short(d.name), LinkedIn: d.li.spend, Meta: d.meta ? d.meta.spend : 0 }))} layout="vertical" margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: C.textSec, fontSize: 11 }} width={65} axisLine={false} tickLine={false} />
              <Tooltip {...TTC} formatter={v => `$${v.toFixed(2)}`} />
              <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[0,4,4,0]} barSize={10} />
              <Bar dataKey="Meta" fill={C.meta} radius={[0,4,4,0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </Crd>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Crd title="광고 세트별 CTR 비교" badge={{ text: "%", bg: C.upSoft, color: C.up }} tip="CTR(Click-Through Rate) = 클릭수 ÷ 노출수. 광고를 본 사람 중 몇 %가 클릭했는지를 나타냅니다. 높을수록 광고 소재가 효과적입니다.">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={adSets.filter(d => d.meta).map(d => ({ name: short(d.name), LinkedIn: d.li.ctr, Meta: d.meta.ctr }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TTC} formatter={v => `${v.toFixed(2)}%`} />
              <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[4,4,0,0]} barSize={18} />
              <Bar dataKey="Meta" fill={C.meta} radius={[4,4,0,0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Crd>
        <Crd title="전체 퍼널 (광고 → 전환)" badge={{ text: "FULL FUNNEL", bg: C.warnSoft, color: C.warn }} tip="광고 노출부터 최종 전환까지의 단계별 수치입니다. 각 단계에서 얼마나 이탈하는지 확인하여 병목 구간을 파악할 수 있습니다.">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { stage: "노출", value: totalImp },{ stage: "클릭", value: totalClick },
              { stage: "링크클릭", value: TLi.click + TMeta.link },{ stage: "LP조회", value: TLi.lp + TMeta.lp },
              { stage: "GA4 세션", value: TGa4.sessions },{ stage: "전환", value: TGa4.conv },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TTC} />
              <Bar dataKey="value" name="수치" radius={[6,6,0,0]} barSize={32}
                label={{ position: "top", fill: C.textSec, fontSize: 10, fontWeight: 600, formatter: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v }}>
                {[C.textMute, C.accent, C.meta, C.linkedin, C.ga4, C.up].map((c,i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Crd>
      </div>
    </>
  );

  // ── Ad Detail ──
  const renderAdDetail = () => (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["all","전체"],["linkedin","LinkedIn만"],["meta","Meta만"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${filter===k ? C.accent : C.border}`, background: filter===k ? C.accentSoft : "transparent", color: filter===k ? C.accent : C.textMute, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      <Crd style={{ marginBottom: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr>{[
            { h: "광고 세트", tip: "타겟 직군별 광고 그룹" },
            { h: "플랫폼", tip: "LinkedIn 또는 Meta(Instagram/Facebook)" },
            { h: "지출", tip: "해당 기간 동안 실제 소진된 광고비 (USD)" },
            { h: "노출수", tip: "광고가 화면에 표시된 횟수. 같은 사람에게 여러 번 노출 가능" },
            { h: "클릭수", tip: "광고의 모든 클릭 합계 (링크, 프로필, 좋아요 등 포함)" },
            { h: "CTR", tip: "Click-Through Rate. 클릭수 ÷ 노출수 × 100. 광고 소재의 매력도 지표. 업종 평균 1~3%" },
            { h: "CPC", tip: "Cost Per Click. 클릭 1회당 비용. 지출 ÷ 클릭수. 낮을수록 효율적" },
            { h: "CPM", tip: "Cost Per Mille. 1,000회 노출당 비용. 지출 ÷ 노출수 × 1000. 브랜드 인지도 캠페인에서 중요" },
            { h: "링크클릭", tip: "광고 내 외부 링크(랜딩페이지 URL)를 클릭한 횟수. 전체 클릭 중 실제 사이트 유입에 기여한 클릭" },
            { h: "LP조회", tip: "Landing Page View. 링크 클릭 후 랜딩페이지가 실제로 로드된 횟수. 링크클릭보다 적을 수 있음 (로딩 전 이탈)" },
            { h: "참여수", tip: "좋아요, 댓글, 공유, 클릭 등 모든 상호작용 합계. LinkedIn에서만 집계" },
          ].map(({ h, tip }) => (
            <th key={h} style={{ padding: "12px 10px", textAlign: "left", color: C.textMute, fontWeight: 700, fontSize: 10, letterSpacing: 1, borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>{h}<InfoTip text={tip} /></span>
            </th>
          ))}</tr></thead>
          <tbody>{filtered.map((d, i) => (<>
            {(filter === "all" || filter === "linkedin") && <tr key={`li-${i}`} style={{ borderBottom: `1px solid ${C.border}22` }}>
              <td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>{d.name}</td>
              <td style={{ padding: "10px" }}><Bdg p="LinkedIn" /></td>
              <td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>${d.li.spend.toFixed(2)}</td>
              <td style={{ padding: "10px", color: C.textSec }}>{d.li.imp.toLocaleString()}</td>
              <td style={{ padding: "10px", color: C.text }}>{d.li.click}</td>
              <td style={{ padding: "10px", color: d.li.ctr > 2 ? C.up : C.textSec, fontWeight: 600 }}>{d.li.ctr.toFixed(2)}%</td>
              <td style={{ padding: "10px", color: d.li.cpc < 1 ? C.up : d.li.cpc > 3.5 ? C.down : C.text }}>${d.li.cpc.toFixed(2)}</td>
              <td style={{ padding: "10px", color: C.textSec }}>${d.li.cpm.toFixed(2)}</td>
              <td style={{ padding: "10px", color: C.textMute }}>—</td>
              <td style={{ padding: "10px", color: C.textSec }}>{d.li.lp}</td>
              <td style={{ padding: "10px", color: C.textSec }}>{d.li.eng}</td>
            </tr>}
            {d.meta && (filter === "all" || filter === "meta") && <tr key={`m-${i}`} style={{ borderBottom: `1px solid ${C.border}33`, background: filter === "all" ? C.surface + "60" : "transparent" }}>
              <td style={{ padding: "10px", color: C.textMute }}>{filter !== "all" ? d.name : ""}</td>
              <td style={{ padding: "10px" }}><Bdg p="Meta" /></td>
              <td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>${d.meta.spend.toFixed(2)}</td>
              <td style={{ padding: "10px", color: C.textSec }}>{d.meta.imp.toLocaleString()}</td>
              <td style={{ padding: "10px", color: C.text }}>{d.meta.click}</td>
              <td style={{ padding: "10px", color: d.meta.ctr > 3.5 ? C.up : C.textSec, fontWeight: 600 }}>{d.meta.ctr.toFixed(2)}%</td>
              <td style={{ padding: "10px", color: C.up, fontWeight: 600 }}>${d.meta.cpc.toFixed(3)}</td>
              <td style={{ padding: "10px", color: C.textSec }}>${(d.meta.spend/d.meta.imp*1000).toFixed(2)}</td>
              <td style={{ padding: "10px", color: C.text }}>{d.meta.link}</td>
              <td style={{ padding: "10px", color: C.textSec }}>{d.meta.lp}</td>
              <td style={{ padding: "10px", color: C.textMute }}>—</td>
            </tr>}
          </>))}</tbody>
        </table>
      </Crd>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Crd title="성과 레이더 (CTR)" tip="각 광고 세트의 CTR을 레이더 형태로 비교합니다. 면적이 넓을수록 전반적으로 CTR이 높습니다. 플랫폼 간 강점이 다른 세트를 한눈에 파악할 수 있습니다.">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={adSets.filter(d => d.meta).map(d => ({ name: short(d.name), "Meta CTR": d.meta.ctr, "LinkedIn CTR": d.li.ctr }))}>
              <PolarGrid stroke={C.border} /><PolarAngleAxis dataKey="name" tick={{ fill: C.textSec, fontSize: 10 }} />
              <PolarRadiusAxis tick={{ fill: C.textMute, fontSize: 9 }} />
              <Radar name="Meta CTR" dataKey="Meta CTR" stroke={C.meta} fill={C.meta} fillOpacity={0.12} strokeWidth={2} />
              <Radar name="LinkedIn CTR" dataKey="LinkedIn CTR" stroke={C.linkedin} fill={C.linkedin} fillOpacity={0.12} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip {...TTC} />
            </RadarChart>
          </ResponsiveContainer>
        </Crd>
        <Crd title="CPC 비교 (USD)" badge={{ text: "낮을수록 효율적", bg: C.upSoft, color: C.up }} tip="CPC(Cost Per Click)는 클릭 1회당 비용입니다. 막대가 짧을수록 같은 예산으로 더 많은 클릭을 얻을 수 있어 효율적입니다.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={adSets.map(d => ({ name: short(d.name), LinkedIn: d.li.cpc, Meta: d.meta ? d.meta.cpc : 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TTC} formatter={v => `$${v.toFixed(3)}`} />
              <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[4,4,0,0]} barSize={16} />
              <Bar dataKey="Meta" fill={C.meta} radius={[4,4,0,0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Crd>
      </div>
    </>
  );

  // ── GA4 ──
  const renderGA4 = () => {
    const ts = TGa4.sessions || 1, tu = TGa4.users, tc = TGa4.conv;
    const ab = (ga4Data.reduce((s,d) => s+d.bounce*d.sessions,0)/ts).toFixed(1);
    const ad = ga4Data.reduce((s,d) => s+d.dur*d.sessions,0)/ts;
    const colors = [C.meta, C.linkedin, C.up, C.textMute, C.warn, C.accent, C.down];
    return (
      <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <KPI label="총 세션" value={ts.toLocaleString()} color={C.ga4} tip="웹사이트 방문 횟수입니다. 한 사용자가 시간 간격을 두고 재방문하면 별도 세션으로 카운트됩니다." />
          <KPI label="총 사용자" value={tu.toLocaleString()} sub={`신규 ${ga4Data.reduce((s,d)=>s+d.newUsers,0)}명`} color={C.ga4} tip="방문한 고유 사용자 수입니다. 같은 사람이 여러 번 방문해도 1명으로 집계됩니다." />
          <KPI label="평균 이탈률" value={`${ab}%`} color={Number(ab) > 45 ? C.down : C.up} tip="페이지를 1개만 보고 떠난 세션 비율입니다. 낮을수록 좋으며, 40% 이하면 우수입니다." />
          <KPI label="평균 체류시간" value={`${Math.floor(ad/60)}분 ${Math.round(ad%60)}초`} color={C.up} tip="사용자가 사이트에 머문 평균 시간입니다. 길수록 콘텐츠에 관심을 보인다는 의미입니다." />
          <KPI label="전환" value={tc.toString()} sub={`전환율 ${(tc/ts*100).toFixed(1)}%`} color={C.up} tip="GA4에서 설정한 전환 이벤트(지원서 제출 등)가 발생한 횟수입니다." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, marginBottom: 14 }}>
          <Crd title="트래픽 소스 비중" tip="어떤 경로로 사이트에 유입되었는지 비율을 보여줍니다. 광고(paid)와 자연유입(organic)의 비중을 비교할 수 있습니다.">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={ga4Data.map(d => ({ name: d.label, value: d.sessions }))} cx="50%" cy="50%" innerRadius={42} outerRadius={72} dataKey="value" stroke="none">
                {ga4Data.map((_,i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie><Tooltip {...TTC} /></PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: C.textSec }}>
              {ga4Data.map((d,i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{d.label}</span>
                <span style={{ fontWeight: 600, color: C.text }}>{d.sessions}</span>
              </div>))}
            </div>
          </Crd>
          <Crd title="소스별 세션 & 이탈률" tip="각 유입 소스별 세션수(막대)와 이탈률(빨간 선)을 함께 봅니다. 세션은 많지만 이탈률이 높으면 랜딩페이지 개선이 필요합니다.">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={ga4Data.map(d => ({ name: d.label, 세션: d.sessions, 사용자: d.users, 이탈률: d.bounce }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0,70]} />
                <Tooltip {...TTC} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="세션" fill={C.ga4} radius={[4,4,0,0]} barSize={20} />
                <Bar yAxisId="left" dataKey="사용자" fill={C.ga4+"66"} radius={[4,4,0,0]} barSize={20} />
                <Line yAxisId="right" type="monotone" dataKey="이탈률" stroke={C.down} strokeWidth={2} dot={{ r: 4, fill: C.down }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Crd>
        </div>
        <Crd title="광고 트래픽 품질 비교" tip="유료 광고로 유입된 트래픽의 품질을 비교합니다. 이탈률이 낮고 체류시간이 길수록 광고가 적합한 타겟에게 도달했다는 의미입니다.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {ga4Data.filter(d => d.source.includes("paid") || d.source.includes("cpc")).map((d,i) => {
              const q = d.bounce < 40 ? { l: "우수", c: C.up } : d.bounce < 45 ? { l: "양호", c: C.warn } : { l: "보통", c: C.textMute };
              const pc = d.label.includes("Meta") ? C.meta : d.label.includes("LinkedIn") ? C.linkedin : C.warn;
              return (<div key={i} style={{ padding: "14px 16px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: pc, fontSize: 12 }}>{d.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: q.c+"20", color: q.c }}>{q.l}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[{ l: "세션", v: d.sessions },{ l: "이탈률", v: `${d.bounce}%` },{ l: "체류시간", v: `${Math.floor(d.dur/60)}분 ${d.dur%60}초` },{ l: "전환", v: d.conv }].map((m,j) => (
                    <div key={j}><div style={{ fontSize: 9, color: C.textMute, marginBottom: 2 }}>{m.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{m.v}</div></div>
                  ))}
                </div>
              </div>);
            })}
          </div>
        </Crd>
      </>
    );
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Outfit', 'Pretendard', -apple-system, sans-serif" }}>
      <GlobalTooltip />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", margin: "0 auto", padding: "20px 40px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.meta})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>A</div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>AI Impact Maker <span style={{ color: C.textMute, fontWeight: 400, fontSize: 14 }}>대시보드</span></h1>
            </div>
            <div style={{ fontSize: 11, color: C.textMute, marginLeft: 42 }}>팀스파르타 · LinkedIn {lastUpd.li} / Meta {lastUpd.meta} / GA4 {lastUpd.ga4}</div>
          </div>
          <div style={{ display: "flex", gap: 3, background: C.surface, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
            {[["종합 대시보드",C.accent],["광고 성과 상세",C.linkedin],["GA4 웹분석",C.ga4],["데이터 관리","#FF6B9D"]].map(([label,color],i) => (
              <button key={i} onClick={() => setPage(i)} style={{
                padding: "9px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, transition: "all 0.25s",
                background: page===i ? color : "transparent", color: page===i ? "#fff" : C.textMute,
              }}>{label}</button>
            ))}
          </div>
        </div>
        {page===0 && renderOverview()}
        {page===1 && renderAdDetail()}
        {page===2 && renderGA4()}
        {page===3 && renderDataManager()}
        <div style={{ textAlign: "center", fontSize: 10, color: C.textMute+"66", marginTop: 28 }}>
          AI Impact Maker 통합 대시보드 · 데이터 관리 탭에서 CSV 붙여넣기로 업데이트
        </div>
      </div>
    </div>
  );
}
