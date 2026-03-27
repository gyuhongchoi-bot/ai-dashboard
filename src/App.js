/* eslint-disable */
import React, { useState, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

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

// ── CSV Parser (handles metadata header rows, BOM, TSV/CSV) ──
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var lines = text.trim().split("\n").filter(function(l) { return l.trim(); });
  if (lines.length < 2) return { headers: [], rows: [] };
  var knownHeaders = ["광고 세트 이름", "총 지출", "노출수", "클릭", "노출", "지출 금액", "보고 시작", "시작일"];
  var headerIdx = 0;
  for (var i = 0; i < Math.min(lines.length, 15); i++) {
    var found = false;
    for (var j = 0; j < knownHeaders.length; j++) {
      if (lines[i].indexOf(knownHeaders[j]) !== -1) { found = true; break; }
    }
    if (found) { headerIdx = i; break; }
  }
  lines = lines.slice(headerIdx);
  if (lines.length < 2) return { headers: [], rows: [] };
  var parseLine = function(line) {
    var result = []; var current = ""; var inQuotes = false;
    for (var k = 0; k < line.length; k++) {
      var ch = line[k];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if ((ch === "," || ch === "\t") && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };
  var headers = parseLine(lines[0]);
  var rows = [];
  for (var r = 1; r < lines.length; r++) {
    var vals = parseLine(lines[r]);
    var obj = {};
    for (var c = 0; c < headers.length; c++) { obj[headers[c]] = vals[c] || ""; }
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function num(v) {
  if (v === "" || v === undefined || v === null) return 0;
  var cleaned = String(v).replace(/[$,%\s"]/g, "");
  var n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

// ── Unified mapper: extracts common metrics from either platform ──
// LinkedIn cols: 광고 세트 이름, 총 지출, 노출수, 클릭, 클릭률, 평균 CPC, 평균 CPM, 총 참여, 랜딩 페이지 클릭
// Meta cols:     광고 세트 이름, 지출 금액 (USD), 노출, 클릭(전체), CTR(전체), CPC(전체) (USD), 도달, 링크 클릭, 웹사이트 랜딩 페이지 조회수
// LinkedIn CSV has daily rows per ad set → aggregate by name
function mapRows(rows, platform) {
  // Normalize LinkedIn names to Meta standard
  var toMetaName = function(n) {
    return n.replace(/\/운영관리\s*/g, "/운영 ").replace(/기획세트/g, "기획 세트").replace(/ - [A-Z].+$/, "").replace(/\s+/g, " ").trim();
  };
  if (platform === "linkedin") {
    var grouped = {};
    rows.forEach(function(r) {
      var rawName = r["광고 세트 이름"] || "";
      if (!rawName) return;
      var name = toMetaName(rawName);
      if (!grouped[name]) grouped[name] = { name: name, spend: 0, imp: 0, click: 0, eng: 0, lp: 0, conv: 0 };
      grouped[name].spend += num(r["총 지출"]);
      grouped[name].imp += num(r["노출수"]);
      grouped[name].click += num(r["클릭"]);
      grouped[name].eng += num(r["총 참여"]);
      grouped[name].lp += num(r["랜딩 페이지 클릭"]);
      grouped[name].conv += num(r["전환"]);
    });
    return Object.keys(grouped).map(function(key) {
      var d = grouped[key];
      return {
        name: d.name,
        spend: d.spend,
        imp: d.imp,
        click: d.click,
        ctr: d.imp > 0 ? (d.click / d.imp * 100) : 0,
        cpc: d.click > 0 ? (d.spend / d.click) : 0,
        cpm: d.imp > 0 ? (d.spend / d.imp * 1000) : 0,
        eng: d.eng,
        lp: d.lp,
        conv: d.conv,
      };
    });
  } else {
    return rows.map(function(r) {
      var name = r["광고 세트 이름"] || "";
      if (!name) return null;
      var spend = num(r["지출 금액 (USD)"]);
      var imp = num(r["노출"]);
      return {
        name: name,
        spend: spend,
        imp: imp,
        reach: num(r["도달"]),
        click: num(r["클릭(전체)"]),
        ctr: num(r["CTR(전체)"]),
        cpc: num(r["CPC(전체) (USD)"]),
        cpm: imp > 0 ? (spend / imp * 1000) : 0,
        linkClick: num(r["링크 클릭"]),
        lpView: num(r["웹사이트 랜딩 페이지 조회수"]),
      };
    }).filter(function(d) { return d && d.name; });
  }
}

// ── Default sample data (shared metrics) ──
var DEF_LI = [
  { name: "디자이너 세트", spend: 23.97, imp: 4591, click: 33, ctr: 0.72, cpc: 0.73, cpm: 5.22, conv: 0 },
  { name: "마케터 세트", spend: 32.30, imp: 3012, click: 17, ctr: 0.56, cpc: 1.90, cpm: 10.72, conv: 0 },
  { name: "개발자 세트", spend: 28.86, imp: 1965, click: 43, ctr: 2.19, cpc: 0.67, cpm: 14.69, conv: 0 },
  { name: "경영지원/운영 세트", spend: 27.87, imp: 1224, click: 16, ctr: 1.31, cpc: 1.74, cpm: 22.77, conv: 0 },
  { name: "기획 세트", spend: 32.08, imp: 1160, click: 9, ctr: 0.78, cpc: 3.56, cpm: 27.65, conv: 0 },
  { name: "세일즈 세트", spend: 27.54, imp: 1510, click: 15, ctr: 0.99, cpc: 1.84, cpm: 18.24, conv: 0 },
  { name: "지원자 모집", spend: 55.78, imp: 3744, click: 107, ctr: 2.86, cpc: 0.52, cpm: 14.90, conv: 0 },
];
var DEF_META = [
  { name: "디자이너 세트", spend: 4.20, imp: 1030, reach: 929, click: 54, ctr: 5.24, cpc: 0.078, cpm: 4.08, linkClick: 50, lpView: 43 },
  { name: "마케터 세트", spend: 4.09, imp: 992, reach: 910, click: 39, ctr: 3.93, cpc: 0.105, cpm: 4.12, linkClick: 37, lpView: 33 },
  { name: "개발자 세트", spend: 3.51, imp: 1117, reach: 985, click: 29, ctr: 2.60, cpc: 0.121, cpm: 3.14, linkClick: 26, lpView: 25 },
  { name: "기획 세트", spend: 3.91, imp: 1217, reach: 1129, click: 43, ctr: 3.53, cpc: 0.091, cpm: 3.21, linkClick: 41, lpView: 34 },
  { name: "세일즈 세트", spend: 3.35, imp: 849, reach: 800, click: 24, ctr: 2.83, cpc: 0.140, cpm: 3.95, linkClick: 23, lpView: 22 },
];
var DEF_GA4 = [
  { label: "Meta 광고", source: "instagram / paid", sessions: 156, users: 138, newUsers: 125, dur: 120, bounce: 35, conv: 8 },
  { label: "LinkedIn 광고", source: "linkedin / paid", sessions: 89, users: 72, newUsers: 65, dur: 95, bounce: 42, conv: 3 },
  { label: "구글 자연검색", source: "google / organic", sessions: 340, users: 295, newUsers: 210, dur: 85, bounce: 48, conv: 12 },
  { label: "직접 유입", source: "(direct) / (none)", sessions: 180, users: 155, newUsers: 90, dur: 70, bounce: 52, conv: 5 },
  { label: "구글 광고", source: "google / cpc", sessions: 45, users: 38, newUsers: 35, dur: 110, bounce: 38, conv: 2 },
];

// ── GA4 mapper ──
function mapGA4(rows) {
  return rows.map(function(r) {
    var source = r["세션 소스/매체"] || r["source_medium"] || r["소스/매체"] || r["Session source / medium"] || "";
    var campaign = r["세션 캠페인"] || r["campaign"] || r["Campaign"] || "";
    var label = source;
    if (source.indexOf("instagram") !== -1 || source.indexOf("facebook") !== -1) label = "Meta 광고" + (campaign ? " - " + campaign : "");
    else if (source.indexOf("linkedin") !== -1) label = "LinkedIn 광고" + (campaign ? " - " + campaign : "");
    else if (source.indexOf("google") !== -1 && source.indexOf("organic") !== -1) label = "구글 자연검색";
    else if (source.indexOf("direct") !== -1) label = "직접 유입";
    else if (source.indexOf("google") !== -1 && (source.indexOf("cpc") !== -1 || source.indexOf("paid") !== -1)) label = "구글 광고";
    return {
      label: label, source: source,
      sessions: num(r["세션수"] || r["sessions"] || r["Sessions"]),
      users: num(r["사용자"] || r["users"] || r["Total users"]),
      newUsers: num(r["신규 사용자"] || r["new_users"] || r["New users"]),
      dur: num(r["평균 세션 시간"] || r["avg_session_duration"] || r["평균 참여 시간"] || r["Average engagement time"]),
      bounce: num(r["이탈률"] || r["bounce_rate"] || r["Bounce rate"]),
      conv: num(r["전환수"] || r["conversions"] || r["전환"] || r["Conversions"]),
    };
  }).filter(function(d) { return d.sessions > 0; });
}

// ── UI Components ──
var _showGlobalTip = null;
var _hideGlobalTip = null;

var InfoTip = function(props) {
  var handleEnter = function(e) {
    if (!_showGlobalTip) return;
    var rect = e.currentTarget.getBoundingClientRect();
    _showGlobalTip(props.text, rect.left - 40, rect.bottom + 8);
  };
  return (
    <span style={{ display: "inline-flex", marginLeft: 4, cursor: "help" }}
      onMouseEnter={handleEnter} onMouseLeave={function() { if (_hideGlobalTip) _hideGlobalTip(); }}>
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: C.border, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: C.textMute, flexShrink: 0 }}>?</span>
    </span>
  );
};

var GlobalTooltip = function() {
  var s = useState(null); var tip = s[0]; var setTip = s[1];
  _showGlobalTip = useCallback(function(text, x, y) { setTip({ text: text, x: x, y: y }); }, []);
  _hideGlobalTip = useCallback(function() { setTip(null); }, []);
  if (!tip) return null;
  return (
    <div style={{ position: "fixed", left: Math.min(tip.x, window.innerWidth - 260), top: tip.y, background: "#0D0E14", border: "1px solid " + C.border, borderRadius: 10, padding: "10px 14px", fontSize: 11, color: C.textSec, lineHeight: 1.6, width: 240, zIndex: 99999, boxShadow: "0 12px 40px rgba(0,0,0,0.9)", whiteSpace: "normal", pointerEvents: "none" }}>{tip.text}</div>
  );
};

var KPI = function(p) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "22px 24px", border: "1px solid " + C.border, flex: 1, minWidth: 170, transition: "border-color 0.2s" }}
      onMouseEnter={function(e) { e.currentTarget.style.borderColor = p.color; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; }}>
      <div style={{ fontSize: 11, color: C.textMute, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center" }}>
        {p.label}{p.tip && <InfoTip text={p.tip} />}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: p.color, letterSpacing: -1 }}>{p.value}</div>
      {p.sub && <div style={{ fontSize: 12, color: C.textMute, marginTop: 8 }}>{p.sub}</div>}
    </div>
  );
};

var Crd = function(p) {
  return (
    <div style={Object.assign({ background: C.card, borderRadius: 14, border: "1px solid " + C.border }, p.style || {})}>
      {p.title && <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: -0.3, display: "flex", alignItems: "center" }}>
          {p.title}{p.tip && <InfoTip text={p.tip} />}
        </span>
        {p.badge && <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: p.badge.bg, color: p.badge.color }}>{p.badge.text}</span>}
      </div>}
      <div style={{ padding: "14px 20px 20px" }}>{p.children}</div>
    </div>
  );
};

var Bdg = function(p) {
  var m = { LinkedIn: { bg: C.linkedinSoft, c: C.linkedin }, Meta: { bg: C.metaSoft, c: C.meta } };
  var s = m[p.p] || { bg: C.ga4Soft, c: C.ga4 };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: s.bg, color: s.c }}>{p.p}</span>;
};

var TTC = { contentStyle: { background: C.surface, border: "1px solid " + C.border, borderRadius: 10, color: C.text, fontSize: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" } };

// ── Main Dashboard ──
export default function Dashboard() {
  var ps = useState(0); var page = ps[0]; var setPage = ps[1];
  var ls = useState(DEF_LI); var liData = ls[0]; var setLiData = ls[1];
  var ms = useState(DEF_META); var metaData = ms[0]; var setMetaData = ms[1];
  var gs = useState(DEF_GA4); var ga4Data = gs[0]; var setGa4Data = gs[1];
  var us = useState({ li: "샘플", meta: "샘플", ga4: "샘플" }); var lastUpd = us[0]; var setLastUpd = us[1];
  var es = useState(null); var editSrc = es[0]; var setEditSrc = es[1];
  var cs = useState(""); var csvText = cs[0]; var setCsvText = cs[1];
  var mss = useState(null); var msg = mss[0]; var setMsg = mss[1];
  var pvs = useState(null); var preview = pvs[0]; var setPreview = pvs[1];
  var ds = useState(null); var dragOver = ds[0]; var setDragOver = ds[1];

  // Read file with auto-encoding detection
  var handleFileRead = function(file, srcKey) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var buf = e.target.result;
      var arr = new Uint8Array(buf);
      var text;
      if ((arr[0] === 0xFF && arr[1] === 0xFE) || (arr[0] === 0xFE && arr[1] === 0xFF)) {
        text = new TextDecoder("utf-16le").decode(buf);
      } else {
        text = new TextDecoder("utf-8").decode(buf);
      }
      try {
        var parsed = parseCSV(text);
        if (parsed.rows.length === 0) throw new Error("데이터 행이 없습니다");
        var mapped;
        if (srcKey === "li") mapped = mapRows(parsed.rows, "linkedin");
        else if (srcKey === "meta") mapped = mapRows(parsed.rows, "meta");
        else mapped = mapGA4(parsed.rows);
        if (mapped.length === 0) throw new Error("매핑된 데이터가 없습니다. 컬럼명을 확인해주세요.");
        var now = new Date().toLocaleDateString("ko-KR");
        if (srcKey === "li") setLiData(mapped);
        else if (srcKey === "meta") setMetaData(mapped);
        else setGa4Data(mapped);
        setLastUpd(function(prev) { var n = Object.assign({}, prev); n[srcKey] = now; return n; });
        setMsg({ type: "success", text: file.name + " → " + mapped.length + "개 데이터 반영 완료!" });
        setEditSrc(null); setCsvText(""); setPreview(null);
        setTimeout(function() { setMsg(null); }, 3000);
      } catch (err) {
        setMsg({ type: "error", text: "파일 오류: " + err.message });
        setTimeout(function() { setMsg(null); }, 4000);
      }
    };
    reader.onerror = function() {
      setMsg({ type: "error", text: "파일을 읽을 수 없습니다." });
      setTimeout(function() { setMsg(null); }, 4000);
    };
    reader.readAsArrayBuffer(file);
  };

  var handleDrop = function(e, srcKey) {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    var file = e.dataTransfer.files[0];
    if (file) handleFileRead(file, srcKey);
  };
  var handleDragOver = function(e, srcKey) { e.preventDefault(); e.stopPropagation(); setDragOver(srcKey); };
  var handleDragLeave = function(e) { e.preventDefault(); e.stopPropagation(); setDragOver(null); };

  var handleParse = function() {
    try {
      var parsed = parseCSV(csvText);
      if (parsed.rows.length === 0) throw new Error("데이터 행이 없습니다");
      var mapped;
      if (editSrc === "li") mapped = mapRows(parsed.rows, "linkedin");
      else if (editSrc === "meta") mapped = mapRows(parsed.rows, "meta");
      else mapped = mapGA4(parsed.rows);
      if (mapped.length === 0) throw new Error("매핑된 데이터가 없습니다.");
      setPreview({ mapped: mapped, sample: mapped.slice(0, 3) });
      setMsg({ type: "success", text: parsed.rows.length + "행 → " + mapped.length + "개 인식됨. '적용' 버튼을 눌러주세요." });
    } catch (err) {
      setMsg({ type: "error", text: "파싱 오류: " + err.message });
      setPreview(null);
    }
  };

  var handleApply = function() {
    if (!preview) return;
    var now = new Date().toLocaleDateString("ko-KR");
    if (editSrc === "li") setLiData(preview.mapped);
    else if (editSrc === "meta") setMetaData(preview.mapped);
    else setGa4Data(preview.mapped);
    setLastUpd(function(prev) { var n = Object.assign({}, prev); n[editSrc] = now; return n; });
    setMsg({ type: "success", text: "데이터가 반영되었습니다!" });
    setTimeout(function() { setEditSrc(null); setMsg(null); setPreview(null); setCsvText(""); }, 1500);
  };

  // ── Computed totals ──
  var short = function(n) { return n.replace(/ 세트/g, "").replace(/세트/g, "").replace(/\/운영관리/g, "").replace(/\/운영/g, ""); };
  // Normalize: strip spaces, "세트", date suffixes like "- Mar 24, 2026", and unify /운영관리 → /운영
  var normalize = function(n) { return n.replace(/ - .+$/, "").replace(/-[A-Z].+$/, "").replace(/\s/g, "").replace(/세트/g, "").replace(/\/운영관리/g, "/운영"); };
  var findMeta = function(liName) { var key = normalize(liName); return metaData.find(function(x) { return normalize(x.name) === key; }) || null; };
  var findLi = function(metaName) { var key = normalize(metaName); return liData.find(function(x) { return normalize(x.name) === key; }) || null; };
  // Use Meta name as canonical display name
  var canonicalName = function(liName) {
    var m = findMeta(liName);
    return m ? m.name : liName;
  };
  var TLi = { spend: 0, imp: 0, click: 0 };
  liData.forEach(function(d) { TLi.spend += d.spend; TLi.imp += d.imp; TLi.click += d.click; });
  var TMeta = { spend: 0, imp: 0, click: 0 };
  metaData.forEach(function(d) { TMeta.spend += d.spend; TMeta.imp += d.imp; TMeta.click += d.click; });
  var TGa4 = { sessions: 0, users: 0, conv: 0 };
  ga4Data.forEach(function(d) { TGa4.sessions += d.sessions; TGa4.users += d.users; TGa4.conv += d.conv; });
  var totalSpend = TLi.spend + TMeta.spend;
  var totalImp = TLi.imp + TMeta.imp;
  var totalClick = TLi.click + TMeta.click;

  // ── Data Manager ──
  var renderDataManager = function() {
    var sources = [
      { key: "li", label: "LinkedIn", color: C.linkedin, icon: "🔗", updated: lastUpd.li, count: liData.length, note: "UTF-16/TSV 자동 지원" },
      { key: "meta", label: "Meta", color: C.meta, icon: "📘", updated: lastUpd.meta, count: metaData.length, note: "UTF-8/CSV 자동 지원" },
      { key: "ga4", label: "GA4", color: C.ga4, icon: "📊", updated: lastUpd.ga4, count: ga4Data.length, note: "UTF-8/CSV" },
    ];
    return (
      <React.Fragment>
        {msg && (
          <div style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.type === "success" ? C.upSoft : C.downSoft, color: msg.type === "success" ? C.up : C.down, border: "1px solid " + (msg.type === "success" ? C.up : C.down) + "33" }}>{msg.text}</div>
        )}
        <Crd title="데이터 업데이트" badge={{ text: "드래그 앤 드롭", bg: C.accentSoft, color: C.accent }} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 16, lineHeight: 1.7 }}>
            광고 관리자에서 <strong style={{ color: C.text }}>CSV를 다운로드</strong>한 후, 아래 해당 영역에 <strong style={{ color: C.text }}>파일을 드래그 앤 드롭</strong>하면 자동 반영됩니다. LinkedIn UTF-16 인코딩 및 메타 헤더 행도 자동 처리됩니다.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {sources.map(function(src) {
              var isDrag = dragOver === src.key;
              return (
                <div key={src.key} onDrop={function(e) { handleDrop(e, src.key); }} onDragOver={function(e) { handleDragOver(e, src.key); }} onDragLeave={handleDragLeave}
                  style={{ background: isDrag ? src.color + "15" : C.surface, borderRadius: 12, border: (isDrag ? "2px dashed " : "2px solid ") + (isDrag ? src.color : editSrc === src.key ? src.color : C.border), padding: "18px 16px", transition: "all 0.2s", position: "relative", transform: isDrag ? "scale(1.02)" : "scale(1)" }}>
                  {isDrag && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: src.color + "18", zIndex: 2 }}>
                      <span style={{ fontSize: 32, marginBottom: 8 }}>📂</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: src.color }}>여기에 놓으세요</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{src.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: src.color }}>{src.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMute, marginBottom: 2 }}>최종 업데이트</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{src.updated}</div>
                  <div style={{ fontSize: 10, color: C.textMute, marginBottom: 4 }}>{src.count}개 {src.key === "ga4" ? "소스" : "광고세트"}</div>
                  <div style={{ fontSize: 9, color: C.textMute, marginBottom: 10 }}>{src.note}</div>
                  <div style={{ padding: "14px 10px", borderRadius: 8, border: "1px dashed " + src.color + "50", background: src.color + "08", textAlign: "center", marginBottom: 10, cursor: "pointer" }}
                    onClick={function() { var input = document.createElement("input"); input.type = "file"; input.accept = ".csv,.tsv,.txt"; input.onchange = function(ev) { handleFileRead(ev.target.files[0], src.key); }; input.click(); }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>📁</div>
                    <div style={{ fontSize: 11, color: src.color, fontWeight: 600 }}>CSV 파일을 여기에 드래그</div>
                    <div style={{ fontSize: 10, color: C.textMute, marginTop: 2 }}>또는 클릭하여 파일 선택</div>
                  </div>
                  <button onClick={function() { setEditSrc(src.key); setCsvText(""); setMsg(null); setPreview(null); }} style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid " + src.color + "40", cursor: "pointer", background: editSrc === src.key ? src.color : "transparent", color: editSrc === src.key ? "#fff" : src.color, fontSize: 11, fontWeight: 600, transition: "all 0.2s" }}>
                    {editSrc === src.key ? "편집 중..." : "직접 붙여넣기"}
                  </button>
                </div>
              );
            })}
          </div>
        </Crd>
        {editSrc && (
          <Crd title={sources.find(function(s) { return s.key === editSrc; }).label + " CSV 입력"} style={{ marginBottom: 16 }}>
            <textarea value={csvText} onChange={function(e) { setCsvText(e.target.value); setPreview(null); setMsg(null); }}
              placeholder="CSV 또는 TSV 데이터를 여기에 붙여넣으세요"
              style={{ width: "100%", height: 200, background: C.bg, color: C.text, border: "1px solid " + C.border, borderRadius: 10, padding: 14, fontSize: 11, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            {preview && (
              <div style={{ marginTop: 12, padding: 14, background: C.surface, borderRadius: 10, border: "1px solid " + C.border }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>미리보기 ({preview.mapped.length}건)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead><tr>{Object.keys(preview.sample[0] || {}).map(function(k) { return <th key={k} style={{ padding: "6px 8px", textAlign: "left", color: C.textMute, fontWeight: 600, borderBottom: "1px solid " + C.border, whiteSpace: "nowrap" }}>{k}</th>; })}</tr></thead>
                    <tbody>{preview.sample.map(function(row, i) { return <tr key={i}>{Object.values(row).map(function(v, j) { return <td key={j} style={{ padding: "6px 8px", color: C.textSec, whiteSpace: "nowrap" }}>{typeof v === "number" ? (v % 1 === 0 ? v : v.toFixed(3)) : String(v)}</td>; })}</tr>; })}</tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleParse} disabled={!csvText.trim()} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: csvText.trim() ? "pointer" : "not-allowed", background: C.accent, color: "#fff", fontSize: 12, fontWeight: 700, opacity: csvText.trim() ? 1 : 0.4 }}>파싱하기</button>
              {preview && <button onClick={handleApply} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: C.up, color: "#fff", fontSize: 12, fontWeight: 700 }}>대시보드에 적용</button>}
              <button onClick={function() { setEditSrc(null); setMsg(null); setPreview(null); setCsvText(""); }} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid " + C.border, cursor: "pointer", background: "transparent", color: C.textSec, fontSize: 12, fontWeight: 600 }}>취소</button>
            </div>
          </Crd>
        )}
        <Crd title="사용 방법" badge={{ text: "2단계", bg: C.warnSoft, color: C.warn }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ step: "1", title: "CSV 다운로드", desc: "LinkedIn 캠페인 관리자 또는\nMeta 광고 관리자에서\nCSV 내보내기", color: C.accent }, { step: "2", title: "드래그 앤 드롭", desc: "다운받은 CSV 파일을\n위 해당 영역에 끌어다 놓기\n→ 자동 파싱 & 적용!", color: C.up }].map(function(item, i) {
              return (
                <div key={i} style={{ padding: "16px", borderRadius: 10, background: C.surface, border: "1px solid " + C.border, textAlign: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: item.color + "20", color: item.color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 15, fontWeight: 800 }}>{item.step}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: C.textSec, whiteSpace: "pre-line", lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              );
            })}
          </div>
        </Crd>
      </React.Fragment>
    );
  };

  // ── Overview (shared metrics: 지출, 노출, 클릭, CTR, CPC, CPM) ──
  var renderOverview = function() {
    return (
      <React.Fragment>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <KPI label="총 광고비" value={"$" + totalSpend.toFixed(2)} sub="LinkedIn + Meta" color={C.accent} tip="두 플랫폼에 실제 지출된 광고 비용 합계" />
          <KPI label="총 노출수" value={totalImp.toLocaleString()} color={C.up} tip="광고가 사용자 화면에 표시된 총 횟수" />
          <KPI label="총 클릭수" value={totalClick.toLocaleString()} sub={"CTR " + (totalImp > 0 ? (totalClick / totalImp * 100).toFixed(2) : 0) + "%"} color={C.warn} tip="광고를 클릭한 총 횟수 (모든 유형 포함)" />
          <KPI label="GA4 세션" value={TGa4.sessions.toLocaleString()} sub={TGa4.users + "명 방문"} color={C.ga4} tip="웹사이트 방문 횟수" />
          <KPI label="전환" value={String(TGa4.conv)} sub={"전환율 " + (TGa4.sessions > 0 ? (TGa4.conv / TGa4.sessions * 100).toFixed(1) : 0) + "%"} color={C.up} tip="GA4 전환 이벤트 발생 횟수" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginBottom: 14 }}>
          <Crd title="플랫폼별 지출" tip="LinkedIn과 Meta 각각의 광고비 비중">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={[{ name: "LinkedIn", value: TLi.spend }, { name: "Meta", value: TMeta.spend }]} cx="50%" cy="50%" innerRadius={58} outerRadius={90} dataKey="value" stroke="none">
                <Cell fill={C.linkedin} /><Cell fill={C.meta} />
              </Pie><Tooltip {...TTC} formatter={function(v) { return "$" + v.toFixed(2); }} /></PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, color: C.textSec }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.linkedin, marginRight: 5 }} />LinkedIn ${TLi.spend.toFixed(0)}</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.meta, marginRight: 5 }} />Meta ${TMeta.spend.toFixed(0)}</span>
            </div>
          </Crd>
          <Crd title="광고 세트별 지출 비교" badge={{ text: "USD", bg: C.accentSoft, color: C.accent }} tip="각 광고 세트별 LinkedIn과 Meta 지출 비교">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={liData.map(function(li) { var m = findMeta(li.name); return { name: short(canonicalName(li.name)), LinkedIn: li.spend, Meta: m ? m.spend : 0 }; })} layout="vertical" margin={{ left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: C.textSec, fontSize: 11 }} width={70} axisLine={false} tickLine={false} />
                <Tooltip {...TTC} formatter={function(v) { return "$" + v.toFixed(2); }} />
                <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="Meta" fill={C.meta} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Crd>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Crd title="CTR 비교 (%)" badge={{ text: "공통지표", bg: C.upSoft, color: C.up }} tip="CTR = 클릭수 ÷ 노출수. 높을수록 광고 소재가 효과적">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={liData.map(function(li) { var m = findMeta(li.name); return { name: short(canonicalName(li.name)), LinkedIn: li.ctr, Meta: m ? m.ctr : 0 }; }).filter(function(d) { return d.Meta > 0; })}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.textMute, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...TTC} formatter={function(v) { return v.toFixed(2) + "%"; }} />
                <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="Meta" fill={C.meta} radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </Crd>
          <Crd title="CPC 비교 (USD)" badge={{ text: "낮을수록 효율적", bg: C.upSoft, color: C.up }} tip="CPC = 클릭 1회당 비용. 낮을수록 효율적">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={liData.map(function(li) { var m = findMeta(li.name); return { name: short(canonicalName(li.name)), LinkedIn: li.cpc, Meta: m ? m.cpc : 0 }; })}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.textMute, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...TTC} formatter={function(v) { return "$" + v.toFixed(3); }} />
                <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[4, 4, 0, 0]} barSize={22} />
                <Bar dataKey="Meta" fill={C.meta} radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Crd>
        </div>
      </React.Fragment>
    );
  };

  // ── Ad Detail (table with shared metrics) ──
  var renderAdDetail = function() {
    var allSets = liData.map(function(li) { var m = findMeta(li.name); return { name: m ? m.name : li.name, li: li, meta: m || null }; });
    // Also add meta-only sets
    metaData.forEach(function(m) {
      if (!allSets.find(function(x) { return normalize(x.name) === normalize(m.name); })) {
        allSets.push({ name: m.name, li: null, meta: m });
      }
    });

    var cols = [
      { h: "광고 세트", tip: "타겟 직군별 광고 그룹" },
      { h: "플랫폼", tip: "LinkedIn 또는 Meta" },
      { h: "지출 (USD)", tip: "실제 소진된 광고비" },
      { h: "노출수", tip: "광고가 화면에 표시된 횟수" },
      { h: "클릭수", tip: "광고 클릭 횟수" },
      { h: "CTR (%)", tip: "클릭수 ÷ 노출수" },
      { h: "CPC (USD)", tip: "클릭 1회당 비용" },
      { h: "CPM (USD)", tip: "1,000회 노출당 비용" },
    ];

    return (
      <React.Fragment>
        <Crd style={{ marginBottom: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr>{cols.map(function(c) { return <th key={c.h} style={{ padding: "12px 10px", textAlign: "left", color: C.textMute, fontWeight: 700, fontSize: 10, letterSpacing: 1, borderBottom: "2px solid " + C.border, whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", alignItems: "center" }}>{c.h}<InfoTip text={c.tip} /></span></th>; })}</tr></thead>
            <tbody>
              {allSets.map(function(d, i) {
                var rows = [];
                if (d.li) {
                  rows.push(
                    <tr key={"li-" + i} style={{ borderBottom: "1px solid " + C.border + "22" }}>
                      <td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>{d.name}</td>
                      <td style={{ padding: "10px" }}><Bdg p="LinkedIn" /></td>
                      <td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>${d.li.spend.toFixed(2)}</td>
                      <td style={{ padding: "10px", color: C.textSec }}>{d.li.imp.toLocaleString()}</td>
                      <td style={{ padding: "10px", color: C.text }}>{d.li.click}</td>
                      <td style={{ padding: "10px", color: d.li.ctr > 2 ? C.up : C.textSec, fontWeight: 600 }}>{d.li.ctr.toFixed(2)}%</td>
                      <td style={{ padding: "10px", color: d.li.cpc < 1 ? C.up : d.li.cpc > 3 ? C.down : C.text }}>${d.li.cpc.toFixed(2)}</td>
                      <td style={{ padding: "10px", color: C.textSec }}>${d.li.cpm.toFixed(2)}</td>
                    </tr>
                  );
                }
                if (d.meta) {
                  rows.push(
                    <tr key={"m-" + i} style={{ borderBottom: "1px solid " + C.border + "33", background: d.li ? C.surface + "60" : "transparent" }}>
                      <td style={{ padding: "10px", color: d.li ? C.textMute : C.text, fontWeight: d.li ? 400 : 600 }}>{d.li ? "" : d.name}</td>
                      <td style={{ padding: "10px" }}><Bdg p="Meta" /></td>
                      <td style={{ padding: "10px", color: C.text, fontWeight: 600 }}>${d.meta.spend.toFixed(2)}</td>
                      <td style={{ padding: "10px", color: C.textSec }}>{d.meta.imp.toLocaleString()}</td>
                      <td style={{ padding: "10px", color: C.text }}>{d.meta.click}</td>
                      <td style={{ padding: "10px", color: d.meta.ctr > 3.5 ? C.up : C.textSec, fontWeight: 600 }}>{d.meta.ctr.toFixed(2)}%</td>
                      <td style={{ padding: "10px", color: C.up, fontWeight: 600 }}>${d.meta.cpc.toFixed(3)}</td>
                      <td style={{ padding: "10px", color: C.textSec }}>${d.meta.cpm.toFixed(2)}</td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </Crd>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Crd title="CTR 레이더" tip="각 광고 세트의 CTR을 레이더 형태로 비교">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={allSets.filter(function(d) { return d.li && d.meta; }).map(function(d) { return { name: short(d.name), "Meta CTR": d.meta.ctr, "LinkedIn CTR": d.li.ctr }; })}>
                <PolarGrid stroke={C.border} /><PolarAngleAxis dataKey="name" tick={{ fill: C.textSec, fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: C.textMute, fontSize: 9 }} />
                <Radar name="Meta CTR" dataKey="Meta CTR" stroke={C.meta} fill={C.meta} fillOpacity={0.12} strokeWidth={2} />
                <Radar name="LinkedIn CTR" dataKey="LinkedIn CTR" stroke={C.linkedin} fill={C.linkedin} fillOpacity={0.12} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip {...TTC} />
              </RadarChart>
            </ResponsiveContainer>
          </Crd>
          <Crd title="CPM 비교 (USD)" badge={{ text: "1000회 노출 비용", bg: C.warnSoft, color: C.warn }} tip="CPM = 1,000회 노출당 비용. 브랜드 인지도 지표">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={allSets.filter(function(d) { return d.li && d.meta; }).map(function(d) { return { name: short(d.name), LinkedIn: d.li.cpm, Meta: d.meta.cpm }; })}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.textMute, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMute, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...TTC} formatter={function(v) { return "$" + v.toFixed(2); }} />
                <Bar dataKey="LinkedIn" fill={C.linkedin} radius={[4, 4, 0, 0]} barSize={22} />
                <Bar dataKey="Meta" fill={C.meta} radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Crd>
        </div>
      </React.Fragment>
    );
  };

  // ── GA4 ──
  var renderGA4 = function() {
    var ts = TGa4.sessions || 1;
    var ab = 0; var ad = 0;
    ga4Data.forEach(function(d) { ab += d.bounce * d.sessions; ad += d.dur * d.sessions; });
    ab = (ab / ts).toFixed(1); ad = ad / ts;
    var colors = [C.meta, C.linkedin, C.up, C.textMute, C.warn, C.accent, C.down];
    return (
      <React.Fragment>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <KPI label="총 세션" value={ts.toLocaleString()} color={C.ga4} tip="웹사이트 방문 횟수" />
          <KPI label="총 사용자" value={TGa4.users.toLocaleString()} color={C.ga4} tip="고유 사용자 수" />
          <KPI label="평균 이탈률" value={ab + "%"} color={Number(ab) > 45 ? C.down : C.up} tip="1페이지만 보고 떠난 비율" />
          <KPI label="평균 체류시간" value={Math.floor(ad / 60) + "분 " + Math.round(ad % 60) + "초"} color={C.up} tip="사이트 평균 체류 시간" />
          <KPI label="전환" value={String(TGa4.conv)} sub={"전환율 " + (TGa4.conv / ts * 100).toFixed(1) + "%"} color={C.up} tip="전환 이벤트 발생 횟수" />
        </div>
        <Crd title="트래픽 소스 비중" tip="유입 경로별 세션 비율">
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={ga4Data.map(function(d) { return { name: d.label, value: d.sessions }; })} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" stroke="none">
                {ga4Data.map(function(_, i) { return <Cell key={i} fill={colors[i % colors.length]} />; })}
              </Pie><Tooltip {...TTC} /></PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
              {ga4Data.map(function(d, i) { return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, color: C.textSec }}>{d.label}</span>
                  <span style={{ fontWeight: 700, color: C.text }}>{d.sessions}</span>
                  <span style={{ color: C.textMute, fontSize: 10 }}>({(d.sessions / ts * 100).toFixed(1)}%)</span>
                </div>
              ); })}
            </div>
          </div>
        </Crd>
      </React.Fragment>
    );
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'Outfit', 'Pretendard', -apple-system, sans-serif" }}>
      <GlobalTooltip />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", padding: "20px 48px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid " + C.border, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, " + C.accent + ", " + C.meta + ")", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>A</div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>AI Impact Maker <span style={{ color: C.textMute, fontWeight: 400, fontSize: 16 }}>대시보드</span></h1>
            </div>
            <div style={{ fontSize: 11, color: C.textMute, marginLeft: 42 }}>팀스파르타 · LinkedIn {lastUpd.li} / Meta {lastUpd.meta} / GA4 {lastUpd.ga4}</div>
          </div>
          <div style={{ display: "flex", gap: 3, background: C.surface, borderRadius: 10, padding: 3, border: "1px solid " + C.border }}>
            {[["종합 대시보드", C.accent], ["광고 성과 상세", C.linkedin], ["GA4 웹분석", C.ga4], ["데이터 관리", "#FF6B9D"]].map(function(item, i) {
              return <button key={i} onClick={function() { setPage(i); }} style={{ padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.25s", background: page === i ? item[1] : "transparent", color: page === i ? "#fff" : C.textMute }}>{item[0]}</button>;
            })}
          </div>
        </div>
        {page === 0 && renderOverview()}
        {page === 1 && renderAdDetail()}
        {page === 2 && renderGA4()}
        {page === 3 && renderDataManager()}
        <div style={{ textAlign: "center", fontSize: 10, color: C.textMute + "66", marginTop: 28 }}>
          AI Impact Maker 통합 대시보드 · 공통 지표: 지출, 노출, 클릭, CTR, CPC, CPM
        </div>
      </div>
    </div>
  );
}
