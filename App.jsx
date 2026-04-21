import { useState, useRef, useMemo } from "react";

const COLORS = [
  '#e53935','#d81b60','#8e24aa','#5e35b1','#1e88e5',
  '#00897b','#43a047','#f4511e','#fb8c00','#b8860b',
  '#6d4c41','#546e7a','#00acc1','#7cb342','#c0ca33',
  '#039be5','#3949ab','#ec407a','#26a69a','#ff8f00',
  '#ef5350','#ab47bc','#42a5f5','#26c6da','#66bb6a',
  '#ff7043','#8d6e63','#78909c','#ffa726','#558b2f',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 席・テーブルの基本サイズ（固定）
const SW = 40, SH = 28;
const TW = 150, TH = 48;

// 実際に使われている範囲だけを返す（余白最小化）
function calcViewBox(seats, tables) {
  const allX = [], allY = [];
  seats.forEach(s => { allX.push(s.x, s.x+SW); allY.push(s.y, s.y+SH); });
  tables.forEach(t => {
    if(t.type==='round') { const r=t.r||40; allX.push(t.x-r,t.x+r); allY.push(t.y-r,t.y+r); }
    else { allX.push(t.x, t.x+(t.w||TW)); allY.push(t.y, t.y+(t.h||TH)); }
  });
  if(allX.length===0) return { minX:0, minY:0, W:600, H:300 };
  const PAD = 24;
  const minX = Math.min(...allX)-PAD, minY = Math.min(...allY)-PAD;
  const W = Math.max(...allX)-minX+PAD*2;
  const H = Math.max(...allY)-minY+PAD*2;
  return { minX, minY, W: Math.max(W,200), H: Math.max(H,120) };
}

// エディタ用（絶対サイズ）
function calcSvgSize(seats) {
  if (!seats || seats.length === 0) return { W: 600, H: 300 };
  const maxX = Math.max(...seats.map(s => s.x + SW)) + 40;
  const maxY = Math.max(...seats.map(s => s.y + SH)) + 40;
  return { W: Math.max(600, maxX), H: Math.max(260, maxY) };
}

// ── プリセット生成（人数に応じて自動スケール）──
function makePreset(type, people) {
  const cols = people <= 8 ? 1 : people <= 16 ? 2 : people <= 24 ? 3 : 4;

  if (type === 'long') {
    const tables = [], seats = [];
    const tCount = Math.ceil(people / 8);
    const COLS = Math.min(tCount, 2);
    const GAP_X = TW + 80, GAP_Y = SH * 2 + TH + 60;
    let sid = 1;
    for (let t = 0; t < tCount; t++) {
      const col = t % COLS, row = Math.floor(t / COLS);
      const tx = 40 + col * GAP_X, ty = 50 + row * GAP_Y;
      tables.push({ id: t, type: 'long', x: tx, y: ty + SH + 10 });
      const sp = TW / 4;
      for (let side = 0; side < 2; side++)
        for (let pos = 0; pos < 4 && sid <= people; pos++)
          seats.push({ id: sid++, x: tx + sp*pos + sp/2 - SW/2, y: side===0 ? ty : ty + SH + 10 + TH + 10 });
    }
    return { tables, seats };
  }

  if (type === 'round') {
    const tables = [], seats = [];
    const tCount = Math.ceil(people / 6);
    const COLS = Math.min(tCount, 3);
    const R = 40, SEAT_R = R + SW + 8;
    const GAP_X = SEAT_R * 2 + 60, GAP_Y = SEAT_R * 2 + 60;
    let sid = 1;
    for (let t = 0; t < tCount; t++) {
      const col = t % COLS, row = Math.floor(t / COLS);
      const cx = SEAT_R + 20 + col * GAP_X, cy = SEAT_R + 20 + row * GAP_Y;
      tables.push({ id: t, type: 'round', x: cx, y: cy, r: R });
      for (let pos = 0; pos < 6 && sid <= people; pos++) {
        const angle = (pos/6)*Math.PI*2 - Math.PI/2;
        seats.push({ id: sid++, x: cx + Math.cos(angle)*SEAT_R - SW/2, y: cy + Math.sin(angle)*SEAT_R - SH/2 });
      }
    }
    return { tables, seats };
  }

  if (type === 'u') {
    const perSide = Math.ceil(people / 3);
    const leftCount = Math.floor((people - perSide) / 2);
    const rightCount = people - perSide - leftCount;
    const W = Math.max(perSide * (SW + 8), 240), H = Math.max(Math.max(leftCount, rightCount) * (SH + 8), 200);
    const ox = 50, oy = 50;
    const tables = [
      { id:0, type:'u-h', x: ox, y: oy, w: W, h: 16 },
      { id:1, type:'u-v', x: ox - 16, y: oy + 16, w: 16, h: H },
      { id:2, type:'u-v', x: ox + W, y: oy + 16, w: 16, h: H },
    ];
    const seats = [];
    let sid = 1;
    const sp_top = W / perSide;
    for(let i=0;i<perSide&&sid<=people;i++) seats.push({id:sid++, x:ox+sp_top*i+sp_top/2-SW/2, y:oy-SH-8});
    const sp_v = H / Math.max(leftCount,1);
    for(let i=0;i<leftCount&&sid<=people;i++) seats.push({id:sid++, x:ox-16-SW-8, y:oy+16+sp_v*i+sp_v/2-SH/2});
    const sp_r = H / Math.max(rightCount,1);
    for(let i=0;i<rightCount&&sid<=people;i++) seats.push({id:sid++, x:ox+W+16+8, y:oy+16+sp_r*i+sp_r/2-SH/2});
    return { tables, seats };
  }

  if (type === 'island') {
    const tables = [], seats = [];
    const tCount = Math.ceil(people / 4);
    const COLS = Math.min(tCount, Math.ceil(Math.sqrt(tCount * 1.5)));
    const GAP_X = TW + 80, GAP_Y = TH + SH*2 + 60;
    let sid = 1;
    for (let t = 0; t < tCount; t++) {
      const col = t % COLS, row = Math.floor(t / COLS);
      const tx = 40 + col * GAP_X, ty = 50 + row * GAP_Y;
      tables.push({ id:t, type:'island', x:tx, y:ty+SH+8 });
      const pos4 = [
        [tx+TW/4-SW/2, ty], [tx+3*TW/4-SW/2, ty],
        [tx+TW/4-SW/2, ty+SH+8+TH+8], [tx+3*TW/4-SW/2, ty+SH+8+TH+8]
      ];
      for(let p=0;p<4&&sid<=people;p++) seats.push({id:sid++, x:pos4[p][0], y:pos4[p][1]});
    }
    return { tables, seats };
  }

  return { tables:[], seats:[] };
}

// ── 座席SVG ──
function SeatSVG({ seat, assignment, highlight, selected, onPointerDown }) {
  const a = assignment;
  const hi = highlight === seat.id;
  const sel = selected;
  const col = a ? COLORS[(a.person-1)%COLORS.length] : '#fff';
  return (
    <g onPointerDown={e=>{e.stopPropagation();onPointerDown&&onPointerDown(e,seat.id)}}
       style={{cursor:onPointerDown?'grab':'default',touchAction:'none'}}>
      {(hi||sel)&&<rect x={seat.x-5} y={seat.y-5} width={SW+10} height={SH+10} rx={7}
        fill={sel?"#5c6bc022":"none"} stroke={hi?'#f44336':'#5c6bc0'} strokeWidth={sel?3:2.5}>
        {hi&&<animate attributeName="opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite"/>}
      </rect>}
      <rect x={seat.x} y={seat.y} width={SW} height={SH} rx={5}
        fill={col} stroke={a?col:sel?'#5c6bc0':'#c5cae9'} strokeWidth={sel?2.5:1.5}
        style={{transition:'fill 0.3s'}}/>
      <text x={seat.x+SW/2} y={seat.y+SH/2+4.5} textAnchor="middle"
        fill={a?'#fff':'#9fa8da'} fontSize={10} fontWeight={700} fontFamily="monospace">
        {a?`P${a.person}`:seat.id}
      </text>
    </g>
  );
}

// ── テーブルSVG ──
function TableBodySVG({ table, selected, onPointerDown }) {
  const props = { onPointerDown, style:{cursor:onPointerDown?'grab':'default',touchAction:'none'} };
  const fill = selected ? '#dde3fa' : '#eef0fb';
  const stroke = selected ? '#5c6bc0' : '#9fa8da';
  const sw = selected ? 3 : 1.5;
  if (table.type==='long') return (
    <g {...props}>
      <rect x={table.x} y={table.y} width={TW} height={TH} rx={8} fill={fill} stroke={stroke} strokeWidth={sw}/>
      <text x={table.x+TW/2} y={table.y+TH/2+5} textAnchor="middle" fill="#7986cb" fontSize={13} fontFamily="monospace" fontWeight={700}>LONG</text>
    </g>
  );
  if (table.type==='round') return (
    <g {...props}>
      <circle cx={table.x} cy={table.y} r={table.r||40} fill={fill} stroke={stroke} strokeWidth={sw}/>
      <text x={table.x} y={table.y+5} textAnchor="middle" fill="#7986cb" fontSize={13} fontFamily="monospace" fontWeight={700}>RND</text>
    </g>
  );
  if (table.type==='island') return (
    <g {...props}>
      <rect x={table.x} y={table.y} width={TW} height={TH} rx={8} fill={fill} stroke={stroke} strokeWidth={sw}/>
      <text x={table.x+TW/2} y={table.y+TH/2+5} textAnchor="middle" fill="#7986cb" fontSize={12} fontFamily="monospace" fontWeight={700}>ISL</text>
    </g>
  );
  if (table.type==='u-h') return <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={6} fill="#eef0fb" stroke="#9fa8da" strokeWidth={1.5}/>;
  if (table.type==='u-v') return <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={6} fill="#eef0fb" stroke="#9fa8da" strokeWidth={1.5}/>;
  return null;
}

// ── カスタム配置エディタ ──
function LayoutEditor({ tables, seats, setTables, setSeats, people }) {
  const [selSeats, setSelSeats] = useState(new Set());
  const [selTables, setSelTables] = useState(new Set());
  const [multiMode, setMultiMode] = useState(false); // 複数選択モード（スマホ対応）
  const [dragging, setDragging] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const svgRef = useRef();
  const totalSeats = seats.length;

  const { W: SVG_W, H: SVG_H } = useMemo(() => calcSvgSize(seats), [seats]);

  function svgCoords(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const cx = e.clientX ?? e.pageX;
    const cy = e.clientY ?? e.pageY;
    // width属性とBoundingRectの比率でスケール
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    return { x:(cx-rect.left)*scaleX, y:(cy-rect.top)*scaleY };
  }

  // プリセットをカスタムとして読み込み
  function loadPreset(type) {
    if (totalSeats > 0) {
      if (!window.confirm('現在の配置をリセットしてプリセットを読み込みますか？')) return;
    }
    const { tables: pt, seats: ps } = makePreset(type, people);
    setTables(pt); setSeats(ps);
    setSelSeats(new Set()); setSelTables(new Set());
  }

  function addTable(type) {
    if (totalSeats >= people) return;
    const id = Date.now();
    const count = Math.min(type==='long'?8:type==='round'?6:4, people-totalSeats);
    let startId = totalSeats+1;
    const newSeats = [];
    if (type==='long') {
      const tx=60,ty=SH+10+50; setTables(prev=>[...prev,{id,type:'long',x:tx,y:ty}]);
      const sp=TW/4;
      for(let side=0;side<2;side++) for(let pos=0;pos<4&&newSeats.length<count;pos++)
        newSeats.push({id:startId++,x:tx+sp*pos+sp/2-SW/2,y:side===0?50:ty+TH+10});
    } else if (type==='round') {
      const R=40, cx=R+SW+30, cy=R+SW+30;
      setTables(prev=>[...prev,{id,type:'round',x:cx,y:cy,r:R}]);
      for(let pos=0;pos<count;pos++){const angle=(pos/6)*Math.PI*2-Math.PI/2;newSeats.push({id:startId++,x:cx+Math.cos(angle)*(R+SW+8)-SW/2,y:cy+Math.sin(angle)*(R+SW+8)-SH/2});}
    } else {
      const tx=60,ty=SH+8+50; setTables(prev=>[...prev,{id,type:'island',x:tx,y:ty}]);
      const p4=[[tx+TW/4-SW/2,50],[tx+3*TW/4-SW/2,50],[tx+TW/4-SW/2,ty+TH+8],[tx+3*TW/4-SW/2,ty+TH+8]];
      for(let p=0;p<count;p++) newSeats.push({id:startId++,x:p4[p][0],y:p4[p][1]});
    }
    let sid=1; setSeats([...seats,...newSeats].map(s=>({...s,id:sid++})));
  }

  function addSeat() {
    if(totalSeats>=people) return;
    let sid=1; setSeats([...seats,{id:0,x:60,y:60}].map(s=>({...s,id:sid++})));
  }

  function deleteSelected() {
    const newSeats = seats.filter(s=>!selSeats.has(s.id));
    const newTables = tables.filter(t=>!selTables.has(t.id));
    let sid=1; setSeats(newSeats.map(s=>({...s,id:sid++})));
    setTables(newTables);
    setSelSeats(new Set()); setSelTables(new Set());
  }

  function selectAll() {
    setSelSeats(new Set(seats.map(s=>s.id)));
    setSelTables(new Set(tables.map(t=>t.id)));
  }
  function clearSelection() { setSelSeats(new Set()); setSelTables(new Set()); }

  // 矢印移動（選択済みの席＆テーブルをまとめて移動）
  function moveSelected(dx, dy) {
    if(selSeats.size>0) setSeats(prev=>prev.map(s=>selSeats.has(s.id)?{...s,x:Math.max(0,s.x+dx),y:Math.max(0,s.y+dy)}:s));
    if(selTables.size>0) setTables(prev=>prev.map(t=>selTables.has(t.id)?{...t,x:Math.max(0,t.x+dx),y:Math.max(0,t.y+dy)}:t));
  }

  // ポインタダウン
  function onSvgPointerDown(e) {
    const {x,y} = svgCoords(e);
    const multi = multiMode || e.shiftKey; // モードON or Shift

    // 席ヒット
    for(let i=seats.length-1;i>=0;i--) {
      const s=seats[i];
      if(x>=s.x-6&&x<=s.x+SW+6&&y>=s.y-6&&y<=s.y+SH+6) {
        if(multi) {
          const next = new Set(selSeats);
          next.has(s.id) ? next.delete(s.id) : next.add(s.id);
          setSelSeats(next);
        } else {
          if(!selSeats.has(s.id)) { setSelSeats(new Set([s.id])); setSelTables(new Set()); }
        }
        setDragging({startX:x, startY:y});
        setDragStart({ seats: seats.map(s=>({...s})), tables: tables.map(t=>({...t})) });
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // テーブルヒット
    for(let i=tables.length-1;i>=0;i--) {
      const t=tables[i];
      const hit = t.type==='round'
        ? Math.hypot(x-t.x,y-t.y)<=(t.r||40)+14
        : x>=t.x-8&&x<=t.x+(t.w||TW)+8&&y>=t.y-8&&y<=t.y+(t.h||TH)+8;
      if(hit) {
        if(multi) {
          const next = new Set(selTables);
          next.has(t.id) ? next.delete(t.id) : next.add(t.id);
          setSelTables(next);
        } else {
          if(!selTables.has(t.id)) { setSelTables(new Set([t.id])); setSelSeats(new Set()); }
        }
        setDragging({startX:x, startY:y});
        setDragStart({ seats: seats.map(s=>({...s})), tables: tables.map(t=>({...t})) });
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    if(!multi) { setSelSeats(new Set()); setSelTables(new Set()); }
  }

  function onSvgPointerMove(e) {
    if(!dragging || !dragStart) return;
    const {x,y} = svgCoords(e);
    const dx = x - dragging.startX, dy = y - dragging.startY;
    // スナップショットから相対移動
    setSeats(prev=>prev.map(s=>{
      const orig = dragStart.seats.find(o=>o.id===s.id);
      return orig && selSeats.has(s.id) ? {...s, x:Math.max(0,orig.x+dx), y:Math.max(0,orig.y+dy)} : s;
    }));
    setTables(prev=>prev.map(t=>{
      const orig = dragStart.tables.find(o=>o.id===t.id);
      return orig && selTables.has(t.id) ? {...t, x:Math.max(0,orig.x+dx), y:Math.max(0,orig.y+dy)} : t;
    }));
  }

  function onSvgPointerUp() { setDragging(null); setDragStart(null); }

  const hasSelection = selSeats.size > 0 || selTables.size > 0;
  const STEP = 16;

  return (
    <div>
      {/* プリセット読み込みバー */}
      <div style={{marginBottom:10,padding:'8px 10px',background:'#f0f4ff',borderRadius:10,border:'1.5px solid #e8eaf6'}}>
        <div style={{fontSize:11,color:'#90a4ae',marginBottom:6,fontWeight:700}}>プリセットから読み込む</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[['long','⬛ 長テーブル'],['round','⭕ 丸テーブル'],['u','🔲 コの字'],['island','🟦 島テーブル']].map(([type,label])=>(
            <button key={type} onClick={()=>loadPreset(type)}
              style={{padding:'5px 10px',borderRadius:8,fontSize:12,fontWeight:700,
                background:'#fff',color:'#5c6bc0',border:'1.5px solid #c5cae9'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ツールバー */}
      <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:11,color:'#90a4ae'}}>追加:</span>
        {[['long','⬛ 長'],['round','⭕ 丸'],['island','🟦 島']].map(([type,label])=>(
          <button key={type} onClick={()=>addTable(type)} disabled={totalSeats>=people}
            style={{padding:'5px 9px',borderRadius:8,fontSize:12,fontWeight:700,
              background:totalSeats>=people?'#f5f5f5':'#e8eaf6',
              color:totalSeats>=people?'#bdbdbd':'#5c6bc0',border:'1.5px solid #c5cae9'}}>
            {label}
          </button>
        ))}
        <button onClick={addSeat} disabled={totalSeats>=people}
          style={{padding:'5px 9px',borderRadius:8,fontSize:12,fontWeight:700,
            background:totalSeats>=people?'#f5f5f5':'#e8f5e9',
            color:totalSeats>=people?'#bdbdbd':'#43a047',border:'1.5px solid #c8e6c9'}}>
          ＋ 席
        </button>
        <div style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:totalSeats===people?'#43a047':'#f57c00'}}>
          {totalSeats}/{people}席
        </div>
      </div>

      {/* 複数選択モードトグル */}
      <div style={{marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
        <button onClick={()=>{setMultiMode(m=>!m); if(multiMode){setSelSeats(new Set());setSelTables(new Set());}}}
          style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:700,
            background:multiMode?'#3949ab':'#f0f4ff',
            color:multiMode?'#fff':'#7986cb',
            border:`2px solid ${multiMode?'#3949ab':'#c5cae9'}`,
            boxShadow:multiMode?'0 2px 8px #3949ab44':'none'}}>
          {multiMode ? '✅ 複数選択モードON' : '☑️ 複数選択モード'}
        </button>
        {multiMode && <span style={{fontSize:11,color:'#5c6bc0'}}>タップで追加選択</span>}
        {!multiMode && <span style={{fontSize:11,color:'#b0bec5'}}>タップで1つ選択</span>}
      </div>

      {/* SVGキャンバス - スクロール可能 */}
      <div style={{borderRadius:12,border:'2px solid #c5cae9',background:'#f8f9ff',overflow:'scroll',maxHeight:440,WebkitOverflowScrolling:'touch',position:'relative'}}>
        <svg ref={svgRef}
          width={SVG_W} height={SVG_H}
          style={{display:'block',cursor:dragging?'grabbing':'default',touchAction:dragging?'none':'auto'}}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerLeave={onSvgPointerUp}>
          <defs><pattern id="egrid" width={20} height={20} patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8eaf6" strokeWidth={0.5}/>
          </pattern></defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#egrid)"/>
          {tables.length===0&&seats.length===0&&(
            <text x={SVG_W/2} y={SVG_H/2} textAnchor="middle" fill="#c5cae9" fontSize={14}>上のボタンでテーブルを追加 or プリセットを読み込み</text>
          )}
          {tables.map(t=>(
            <TableBodySVG key={t.id} table={t} selected={selTables.has(t.id)}
              onPointerDown={e=>{
                e.stopPropagation();
                const{x,y}=svgCoords(e);
                const multi = multiMode || e.shiftKey;
                if(multi){
                  const next=new Set(selTables);
                  next.has(t.id)?next.delete(t.id):next.add(t.id);
                  setSelTables(next);
                } else if(!selTables.has(t.id)){
                  setSelTables(new Set([t.id]));setSelSeats(new Set());
                }
                setDragging({startX:x,startY:y});
                setDragStart({seats:seats.map(s=>({...s})),tables:tables.map(tb=>({...tb}))});
                e.currentTarget.closest('svg').setPointerCapture(e.pointerId);
              }}/>
          ))}
          {seats.map(s=>(
            <SeatSVG key={s.id} seat={s} assignment={null} highlight={null}
              selected={selSeats.has(s.id)}
              onPointerDown={(e,id)=>{
                const{x,y}=svgCoords(e);
                const multi = multiMode || e.shiftKey;
                if(multi){
                  const next=new Set(selSeats);
                  next.has(id)?next.delete(id):next.add(id);
                  setSelSeats(next);
                } else if(!selSeats.has(id)){
                  setSelSeats(new Set([id]));setSelTables(new Set());
                }
                setDragging({startX:x,startY:y});
                setDragStart({seats:seats.map(s=>({...s})),tables:tables.map(t=>({...t}))});
              }}/>
          ))}
        </svg>
      </div>

      {/* 操作パネル */}
      <div style={{marginTop:8,background:'#f0f4ff',borderRadius:12,padding:'8px 12px',border:'1.5px solid #e8eaf6',minHeight:52}}>
        {!hasSelection && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{color:'#b0bec5',fontSize:12}}>タップで選択</span>
            {(seats.length>0||tables.length>0)&&<button onClick={selectAll} style={{...smBtn,background:'#e8eaf6',color:'#5c6bc0'}}>全選択</button>}
          </div>
        )}
        {hasSelection && (
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:700,color:'#5c6bc0'}}>
              {selSeats.size+selTables.size}個選択中
            </span>
            {/* 矢印パッド */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,32px)',gridTemplateRows:'repeat(3,32px)',gap:2}}>
              <div/><button onPointerDown={()=>moveSelected(0,-STEP)} style={arrowBtn}>▲</button><div/>
              <button onPointerDown={()=>moveSelected(-STEP,0)} style={arrowBtn}>◀</button>
              <div style={{background:'#e8eaf6',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#9fa8da'}}>移動</div>
              <button onPointerDown={()=>moveSelected(STEP,0)} style={arrowBtn}>▶</button>
              <div/><button onPointerDown={()=>moveSelected(0,STEP)} style={arrowBtn}>▼</button><div/>
            </div>
            <button onClick={clearSelection} style={{...smBtn,background:'#e8eaf6',color:'#5c6bc0'}}>解除</button>
            <button onClick={deleteSelected} style={{...smBtn,background:'#ffebee',color:'#e53935',border:'1px solid #ffcdd2'}}>🗑 削除</button>
          </div>
        )}
      </div>
      <div style={{fontSize:11,color:'#90a4ae',marginTop:4,textAlign:'center'}}>
        💡 ドラッグで移動 / 複数選択モードONでタップ追加選択
      </div>
    </div>
  );
}

const arrowBtn = {width:32,height:32,borderRadius:7,background:'#5c6bc0',color:'#fff',fontSize:13,fontWeight:700,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'};
const smBtn = {padding:'5px 10px',borderRadius:8,fontSize:12,fontWeight:700,border:'1px solid #c5cae9',cursor:'pointer'};

// ── 配置図（余白なし・ぴったりフィット）──
function RouletteMap({ tables, seats, assignments, highlight, large }) {
  const { minX, minY, W, H } = useMemo(() => calcViewBox(seats, tables), [seats, tables]);
  return (
    <div style={{background:'#f8f9ff', borderRadius:10, overflow:'hidden'}}>
      <svg viewBox={`${minX} ${minY} ${W} ${H}`}
        style={{ width:'100%', display:'block' }}>
        <defs><pattern id="rgrid" width={20} height={20} patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8eaf6" strokeWidth={0.5}/>
        </pattern></defs>
        <rect x={minX} y={minY} width={W} height={H} fill="url(#rgrid)"/>
        {tables.map(t=><TableBodySVG key={t.id} table={t} selected={false}/>)}
        {seats.map(s=>(
          <SeatSVG key={s.id} seat={s}
            assignment={assignments.find(a=>a.seat===s.id)||null}
            highlight={highlight} selected={false}/>
        ))}
      </svg>
    </div>
  );
}

// ── メインアプリ ──
export default function App() {
  const [screen, setScreen] = useState('setup');
  const [people, setPeople] = useState(8);
  const [layoutMode, setLayoutMode] = useState('preset');
  const [presetType, setPresetType] = useState('long');
  const [customTables, setCustomTables] = useState([]);
  const [customSeats, setCustomSeats] = useState([]);
  const [currentPerson, setCurrentPerson] = useState(1);
  const [assignments, setAssignments] = useState([]);
  const [remainingSeats, setRemainingSeats] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [displaySeat, setDisplaySeat] = useState(null);
  const [finalSeat, setFinalSeat] = useState(null);
  const [rouletteTables, setRouletteTables] = useState([]);
  const [rouletteSeats, setRouletteSeats] = useState([]);
  const iRef = useRef(null);

  const preset = makePreset(presetType, people);
  const previewTables = layoutMode==='preset' ? preset.tables : customTables;
  const previewSeats  = layoutMode==='preset' ? preset.seats  : customSeats;
  const totalCustomSeats = customSeats.length;
  const canStart = layoutMode==='preset' || totalCustomSeats===people;

  function startRoulette() {
    const t = layoutMode==='preset' ? preset.tables : customTables;
    const s = layoutMode==='preset' ? preset.seats  : customSeats;
    setRouletteTables(t); setRouletteSeats(s);
    setRemainingSeats(shuffle(s.map(x=>x.id)));
    setAssignments([]); setCurrentPerson(1);
    setDisplaySeat(null); setFinalSeat(null);
    setScreen('roulette');
  }

  function backToSetup() { clearInterval(iRef.current); setSpinning(false); setScreen('setup'); }

  function spin() {
    if(spinning||finalSeat) return;
    setSpinning(true);
    let count = 0;
    const total = 10 + Math.floor(Math.random() * 6);
    let interval = 80;
    function tick() {
      setDisplaySeat(remainingSeats[count % remainingSeats.length]);
      count++;
      if(count >= total) {
        const picked = remainingSeats[(count-1) % remainingSeats.length];
        setDisplaySeat(picked); setFinalSeat(picked); setSpinning(false);
      } else {
        const progress = count / total;
        interval = progress > 0.6 ? 80 + (progress - 0.6) * 600 : 80;
        setTimeout(tick, interval);
      }
    }
    setTimeout(tick, interval);
  }

  function next() {
    const newA = [...assignments, {person:currentPerson, seat:finalSeat}];
    const newR = remainingSeats.filter(s=>s!==finalSeat);
    setAssignments(newA); setRemainingSeats(newR);
    if(currentPerson >= people) { setScreen('result'); }
    else { setCurrentPerson(p=>p+1); setDisplaySeat(null); setFinalSeat(null); }
  }

  const pColor = COLORS[(currentPerson-1) % COLORS.length];

  const C = {
    root:{minHeight:'100vh',background:'#f0f4ff',display:'flex',justifyContent:'center',padding:'16px',fontFamily:"'Noto Sans JP',sans-serif"},
    page:{width:'100%',maxWidth:540,display:'flex',flexDirection:'column',gap:12},
    card:{background:'#fff',borderRadius:16,padding:'14px 16px',boxShadow:'0 2px 12px #3949ab0d',border:'1px solid #e8eaf6'},
    lbl:{fontWeight:700,fontSize:13,color:'#7986cb',marginBottom:6},
  };

  return (
    <div style={C.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&family=Noto+Sans+JP:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:#f0f4ff;}
        button{cursor:pointer;border:none;font-family:inherit;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        .fade-up{animation:fadeUp 0.35s ease forwards;}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#5c6bc0;cursor:pointer;box-shadow:0 2px 6px #5c6bc055;}
      `}</style>

      {/* ── SETUP ── */}
      {screen==='setup' && (
        <div style={C.page}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:34}}>🍺</span>
            <div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:'#3949ab'}}>SEAT ROULETTE</div>
              <div style={{fontSize:11,color:'#90a4ae'}}>飲み会の座席をランダム決定</div>
            </div>
          </div>

          <div style={C.card}>
            <div style={C.lbl}>👥 参加人数</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:52,color:'#3949ab',lineHeight:1.1}}>
              {people}<span style={{fontSize:16,color:'#90a4ae',marginLeft:4}}>人</span>
            </div>
            <input type="range" min={2} max={30} value={people}
              style={{width:'100%',marginTop:8,background:`linear-gradient(90deg,#5c6bc0 ${(people-2)/28*100}%,#e8eaf6 ${(people-2)/28*100}%)`}}
              onChange={e=>{setPeople(Number(e.target.value));setCustomTables([]);setCustomSeats([]);}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#b0bec5',marginTop:3}}><span>2人</span><span>30人</span></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:10}}>
              {[4,6,8,10,12,16,20,24,30].map(n=>(
                <button key={n} onClick={()=>{setPeople(n);setCustomTables([]);setCustomSeats([]);}}
                  style={{padding:'5px 12px',borderRadius:20,fontSize:13,fontWeight:700,
                    background:people===n?'#5c6bc0':'#f0f4ff',color:people===n?'#fff':'#7986cb',
                    border:`1.5px solid ${people===n?'#5c6bc0':'#e8eaf6'}`}}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={C.card}>
            <div style={C.lbl}>🪑 テーブル配置</div>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              {[['preset','🗂️ プリセット'],['custom','✏️ カスタム']].map(([m,label])=>(
                <button key={m} onClick={()=>setLayoutMode(m)}
                  style={{flex:1,padding:'8px 0',borderRadius:10,fontWeight:700,fontSize:13,
                    background:layoutMode===m?'#5c6bc0':'#f0f4ff',color:layoutMode===m?'#fff':'#90a4ae',
                    border:`1.5px solid ${layoutMode===m?'#5c6bc0':'#e8eaf6'}`}}>
                  {label}
                </button>
              ))}
            </div>
            {layoutMode==='preset' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{id:'long',icon:'⬛',name:'長テーブル',desc:'両サイドに席'},{id:'round',icon:'⭕',name:'丸テーブル',desc:'6人囲み'},{id:'u',icon:'🔲',name:'コの字',desc:'U字型'},{id:'island',icon:'🟦',name:'島テーブル',desc:'4人テーブル'}].map(p=>(
                  <button key={p.id} onClick={()=>setPresetType(p.id)}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'10px 6px',borderRadius:12,fontFamily:'inherit',
                      background:presetType===p.id?'#dde3fa':'#f8f9ff',border:`2px solid ${presetType===p.id?'#5c6bc0':'#e8eaf6'}`}}>
                    <span style={{fontSize:22}}>{p.icon}</span>
                    <span style={{fontSize:12,fontWeight:700,color:presetType===p.id?'#5c6bc0':'#455a64'}}>{p.name}</span>
                    <span style={{fontSize:10,color:'#90a4ae'}}>{p.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {layoutMode==='custom' && (
              <LayoutEditor tables={customTables} seats={customSeats}
                setTables={setCustomTables} setSeats={setCustomSeats} people={people}/>
            )}
          </div>

          {/* 配置プレビュー（人数に応じて拡縮） */}
          {(layoutMode==='preset' || totalCustomSeats>0) && (
            <div style={C.card}>
              <div style={C.lbl}>📐 配置プレビュー</div>
              <div style={{marginTop:8}}>
                <RouletteMap tables={previewTables} seats={previewSeats} assignments={[]} highlight={null}/>
              </div>
            </div>
          )}

          <button onClick={startRoulette} disabled={!canStart}
            style={{background:'linear-gradient(135deg,#5c6bc0,#7986cb)',color:'#fff',fontWeight:900,fontSize:18,padding:'16px 0',borderRadius:14,boxShadow:'0 4px 20px #5c6bc044',fontFamily:"'Nunito',sans-serif",opacity:canStart?1:0.5,cursor:canStart?'pointer':'not-allowed'}}>
            {!canStart ? `⚠️ あと ${people-totalCustomSeats} 席追加` : '🎲 スタート！'}
          </button>
        </div>
      )}

      {/* ── ROULETTE ── */}
      {screen==='roulette' && (
        <div style={C.page}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={backToSetup}
              style={{padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:700,background:'#f0f4ff',color:'#7986cb',border:'1.5px solid #c5cae9'}}>
              ← 最初に戻る
            </button>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:'#455a64'}}>
              {currentPerson}<span style={{color:'#b0bec5',fontSize:13}}>/{people}人</span>
            </div>
          </div>

          <div style={{fontSize:11,color:'#90a4ae',fontWeight:700,letterSpacing:'0.1em'}}>NOW DECIDING</div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontSize:36,fontWeight:900,color:pColor,lineHeight:1,marginTop:-4}}>
            Person {currentPerson}
          </div>

          <div style={{height:5,background:'#e8eaf6',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:3,transition:'width 0.5s',width:`${(currentPerson-1)/people*100}%`,background:pColor}}/>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {Array.from({length:people},(_,i)=>(
              <div key={i} style={{width:10,height:10,borderRadius:'50%',flexShrink:0,transition:'all 0.2s',
                background:i<currentPerson-1?COLORS[i%COLORS.length]:i===currentPerson-1?pColor:'#e8eaf6',
                transform:i===currentPerson-1?'scale(1.5)':'scale(1)',
                boxShadow:i===currentPerson-1?`0 0 8px ${pColor}88`:'none'}}/>
            ))}
          </div>

          <div style={{height:150,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:20,
            border:`2px solid ${finalSeat?pColor:'#e8eaf6'}`,
            background:finalSeat?pColor+'0d':'#fff',
            boxShadow:finalSeat?`0 4px 24px ${pColor}22`:'0 2px 12px #0001',transition:'all 0.3s'}}>
            {!displaySeat && <div style={{color:'#c5cae9',fontWeight:700,fontSize:15}}>▼ スピン！</div>}
            {displaySeat && (
              <div key={`${displaySeat}-${!spinning}`} style={{fontFamily:"'Nunito',sans-serif",fontSize:84,fontWeight:900,
                color:finalSeat?pColor:'#455a64',lineHeight:1,
                animation:finalSeat?'popIn 0.4s cubic-bezier(.34,1.4,.64,1) forwards':undefined,
                filter:spinning?'blur(1px)':'none',transition:'color 0.15s,filter 0.1s'}}>
                {displaySeat}<span style={{fontSize:16,color:finalSeat?pColor+'99':'#b0bec5',marginLeft:2}}>番</span>
              </div>
            )}
          </div>

          {!finalSeat
            ? <button onClick={spin} disabled={spinning} style={{fontWeight:900,fontSize:18,padding:'15px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",color:'#fff',background:spinning?'#e0e0e0':pColor,boxShadow:spinning?'none':`0 4px 16px ${pColor}55`,transition:'all 0.2s'}}>
                {spinning ? 'スピン中...' : '🎲 スピン！'}
              </button>
            : <button onClick={next} style={{fontWeight:900,fontSize:18,padding:'15px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",background:'#fff',border:`2px solid ${pColor}`,color:pColor,boxShadow:`0 4px 16px ${pColor}22`}}>
                {currentPerson>=people ? '✅ 結果を見る' : '次の人へ →'}
              </button>
          }

          <div style={C.card}>
            <div style={C.lbl}>📐 テーブル配置</div>
            <div style={{marginTop:4,borderRadius:10,overflow:'hidden'}}>
              <RouletteMap tables={rouletteTables} seats={rouletteSeats} assignments={assignments} highlight={finalSeat} large/>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {screen==='result' && (
        <div style={C.page}>
          <div style={{textAlign:'center',paddingTop:4}}>
            <div style={{fontSize:40}}>🎉</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:30,color:'#3949ab'}}>座席決定！</div>
          </div>
          <div style={C.card}>
            <div style={C.lbl}>📐 テーブル配置図</div>
            <RouletteMap tables={rouletteTables} seats={rouletteSeats} assignments={assignments} highlight={null}/>
          </div>
          <div style={C.card}>
            <div style={C.lbl}>📋 割り当て一覧</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:8,maxHeight:280,overflowY:'auto'}}>
              {assignments.map((a,i)=>(
                <div key={i} className="fade-up" style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'8px 12px',borderRadius:10,opacity:0,
                  background:COLORS[(a.person-1)%COLORS.length]+'18',
                  border:`1.5px solid ${COLORS[(a.person-1)%COLORS.length]}44`,
                  animationDelay:`${i*25}ms`}}>
                  <span style={{fontWeight:900,fontSize:13,color:COLORS[(a.person-1)%COLORS.length]}}>P{a.person}</span>
                  <span style={{fontSize:10,color:'#90a4ae'}}>→</span>
                  <span style={{fontWeight:900,fontSize:16,color:'#37474f',fontFamily:"'Nunito',sans-serif"}}>{a.seat}番</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setScreen('setup');setCustomTables([]);setCustomSeats([]);}}
              style={{flex:1,fontWeight:900,fontSize:14,padding:'13px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",background:'#f0f4ff',color:'#5c6bc0',border:'1.5px solid #c5cae9'}}>
              🔄 最初から
            </button>
            <button onClick={()=>{setCurrentPerson(1);setAssignments([]);setDisplaySeat(null);setFinalSeat(null);setRemainingSeats(shuffle(rouletteSeats.map(s=>s.id)));setScreen('roulette');}}
              style={{flex:1,fontWeight:900,fontSize:14,padding:'13px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",background:'#5c6bc0',color:'#fff'}}>
              🎲 もう一度
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
