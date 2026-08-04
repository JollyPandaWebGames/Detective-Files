import BaseApp from '../../core/BaseApp.js';
import EventBus from '../../core/EventBus.js';
import BoardManager from '../../managers/BoardManager.js';
import EvidenceManager from '../../managers/EvidenceManager.js';
import PeopleManager from '../../managers/PeopleManager.js';
import MapManager from '../../managers/MapManager.js';
import CctvManager from '../../managers/CctvManager.js';
import MessengerManager from '../../managers/MessengerManager.js';
import ForensicsManager from '../../managers/ForensicsManager.js';
import ResolutionWizard from './ResolutionWizard.js';

const NODE_TYPES = {
    evidence:    { emoji:'🔍', color:'#1a3a2a', border:'#37D67A', label:'Evidence'   },
    person:      { emoji:'👤', color:'#2a1a1a', border:'#FF5D5D', label:'Person'     },
    location:    { emoji:'📍', color:'#1a2a3a', border:'#2DA8FF', label:'Location'   },
    camera:      { emoji:'📹', color:'#1a1a2a', border:'#9B59B6', label:'Camera'     },
    conversation:{ emoji:'💬', color:'#2a2a1a', border:'#FFC94A', label:'Chat'       },
    email:       { emoji:'✉️', color:'#1a2a2a', border:'#2DA8FF', label:'Email'      },
    report:      { emoji:'🧪', color:'#1a2a1a', border:'#37D67A', label:'Report'     },
    note:        { emoji:'📝', color:'#2a2010', border:'#FFC94A', label:'Note'       },
    theory:      { emoji:'💡', color:'#2a1a2a', border:'#FF9500', label:'Theory'     },
};

const RELATION_TYPES = ['Unknown','Owns','Visited','Seen With','Called','Threatened','Family','Friend','Business','DNA Match','Fingerprint Match','Weapon Used','Custom'];
const ZOOM_MIN=0.2, ZOOM_MAX=3.0, ZOOM_STEP=0.15;
const NW=140, NH=72, HH=24;

class InvestigationBoard extends BaseApp {
    constructor(config) {
        super(config);
        this._canvas=null; this._ctx=null;
        this._zoom=1; this._offsetX=0; this._offsetY=0;
        this._selNodeId=null; this._selConnId=null;
        this._dragId=null; this._dragOX=0; this._dragOY=0;
        this._panning=false; this._panSX=0; this._panSY=0; this._panOX=0; this._panOY=0;
        this._connecting=null; this._pinch=null;
        this._toolboxEl=null; this._inspEl=null; this._availEl=null; this._searchEl=null;
        this._rafId=null; this._dirty=true; this._saveT=null; this._mMapX=0; this._mMapY=0;
        this._activeCaseId=null;
        this._onInvestigationChanged=({investigation})=>this._syncInvestigation(investigation);
        this._onEvidence=()=>this._refreshAvail();
        this._onForensics=()=>this._refreshAvail();
        this._onMD=(e)=>this._md(e); this._onMM=(e)=>this._mm(e); this._onMU=()=>this._mu();
        this._onWheel=(e)=>this._wheel(e); this._onDbl=(e)=>this._dbl(e);
        this._onKey=(e)=>this._key(e); this._onResize=()=>{this._resizeCanvas();this._dirty=true;};
        this._onTS=(e)=>this._ts(e); this._onTM=(e)=>this._tm(e); this._onTE=()=>this._te();
    }

    create(el) { el.classList.add('board'); this._buildLayout(el); this._wizard = new ResolutionWizard(el); }

    open() {
        EventBus.on('investigationChanged',this._onInvestigationChanged);
        EventBus.on('evidence:loaded',this._onEvidence);
        EventBus.on('forensics:collected',this._onForensics);
        window.addEventListener('resize',this._onResize);
        window.addEventListener('keydown',this._onKey);
        this._resizeCanvas(); this._startLoop();
        this._syncInvestigation(this.context.getActiveInvestigation());
    }

    close() {
        EventBus.off('investigationChanged',this._onInvestigationChanged);
        EventBus.off('evidence:loaded',this._onEvidence);
        EventBus.off('forensics:collected',this._onForensics);
        window.removeEventListener('resize',this._onResize);
        window.removeEventListener('keydown',this._onKey);
        this._stopLoop(); this._saveCamera(); clearTimeout(this._saveT);
    }

    minimize() { this._stopLoop(); this._saveCamera(); }
    restore()  { this._resizeCanvas(); this._startLoop(); }

    destroy() {
        this._stopLoop(); clearTimeout(this._saveT);
        window.removeEventListener('resize',this._onResize);
        window.removeEventListener('keydown',this._onKey);
        this._canvas=null; this._ctx=null; super.destroy();
    }

    _buildLayout(el) {
        this._toolboxEl=document.createElement('div'); this._toolboxEl.className='board__left';
        this._buildToolbox();

        const center=document.createElement('div'); center.className='board__center';
        this._canvas=document.createElement('canvas'); this._canvas.className='board__canvas';
        this._ctx=this._canvas.getContext('2d');
        this._canvas.addEventListener('mousedown',this._onMD);
        this._canvas.addEventListener('mousemove',this._onMM);
        this._canvas.addEventListener('mouseup',this._onMU);
        this._canvas.addEventListener('mouseleave',this._onMU);
        this._canvas.addEventListener('wheel',this._onWheel,{passive:false});
        this._canvas.addEventListener('dblclick',this._onDbl);
        this._canvas.addEventListener('touchstart',this._onTS,{passive:false});
        this._canvas.addEventListener('touchmove',this._onTM,{passive:false});
        this._canvas.addEventListener('touchend',this._onTE);
        center.appendChild(this._canvas);

        this._inspEl=document.createElement('div'); this._inspEl.className='board__right';
        this._emptyInsp();

        el.appendChild(this._toolboxEl); el.appendChild(center); el.appendChild(this._inspEl);
    }

    _buildToolbox() {
        const t=this._toolboxEl; t.innerHTML='';
        const sw=document.createElement('div'); sw.className='board__search-wrap';
        this._searchEl=document.createElement('input'); this._searchEl.type='text';
        this._searchEl.className='board__search-input'; this._searchEl.placeholder='Search board...';
        this._searchEl.addEventListener('input',()=>this._search()); sw.appendChild(this._searchEl); t.appendChild(sw);

        const ah=document.createElement('div'); ah.className='board__tool-header'; ah.textContent='+ Add Node'; t.appendChild(ah);
        Object.entries(NODE_TYPES).forEach(([type,def])=>{
            const b=document.createElement('button'); b.className='board__tool-btn'; b.type='button';
            b.innerHTML=`<span>${def.emoji}</span><span>${def.label}</span>`;
            b.addEventListener('click',()=>this._addEmpty(type)); t.appendChild(b);
        });

        const nh=document.createElement('div'); nh.className='board__tool-header'; nh.textContent='Navigation'; t.appendChild(nh);
        const rb=document.createElement('button'); rb.className='board__tool-btn'; rb.type='button'; rb.textContent='⌖ Reset View';
        rb.addEventListener('click',()=>this._resetView()); t.appendChild(rb);
        const sb=document.createElement('button'); sb.className='board__tool-btn board__tool-btn--solve'; sb.type='button'; sb.textContent='🔎 Solve Case';
        sb.addEventListener('click',()=>this._solveDialog()); t.appendChild(sb);

        const availH=document.createElement('div'); availH.className='board__tool-header'; availH.textContent='Add from Case'; t.appendChild(availH);
        this._availEl=document.createElement('div'); this._availEl.className='board__available'; t.appendChild(this._availEl);
    }

    _refreshAvail() {
        if(!this._availEl) return;
        this._availEl.innerHTML='';
        const add=(emoji,label,fn)=>{
            const b=document.createElement('button'); b.className='board__avail-chip'; b.type='button';
            b.innerHTML=`<span>${emoji}</span><span class="board__avail-label">${this._esc(label)}</span>`;
            b.addEventListener('click',fn); this._availEl.appendChild(b);
        };
        EvidenceManager.getByCategory('all').forEach(ev=>{if(!BoardManager.hasSourceId(ev.id))add('🔍',ev.title,()=>this._import('evidence',ev));});
        PeopleManager.getAll().forEach(p=>{if(!BoardManager.hasSourceId(p.id))add(p.avatarEmoji??'👤',p.name,()=>this._import('person',p));});
        MapManager.getAllLocations().forEach(l=>{if(!BoardManager.hasSourceId(l.id))add('📍',l.name,()=>this._import('location',l));});
        CctvManager.getAll().filter(c=>c.available).forEach(c=>{if(!BoardManager.hasSourceId(c.id))add('📹',c.name,()=>this._import('camera',c));});
        MessengerManager.getAll().forEach(c=>{if(!BoardManager.hasSourceId(c.id))add('💬',c.name,()=>this._import('conversation',c));});
        ForensicsManager.getByStatus('Collected').forEach(a=>{if(!BoardManager.hasSourceId(a.id))add('🧪',`${a.type} Report`,()=>this._import('report',a));});
        if(!this._availEl.children.length) this._availEl.innerHTML='<div class="board__empty-hint">No items yet.</div>';
    }

    _syncInvestigation(investigation) {
        if(!investigation){
            this._activeCaseId=null;
            this._selNodeId=null; this._connecting=null; this._emptyInsp();
            this._availEl && (this._availEl.innerHTML='');
            this._dirty=true;
            return;
        }
        if(this._activeCaseId===investigation.caseId){
            this._refreshAvail(); this._dirty=true;
            return;
        }
        this._activeCaseId=investigation.caseId;
        BoardManager.loadForCase(investigation.caseId);
        const cam=BoardManager.getCamera();
        this._zoom=cam.zoom??1; this._offsetX=cam.x??0; this._offsetY=cam.y??0;
        this._selNodeId=null; this._connecting=null; this._emptyInsp();
        this._refreshAvail(); this._dirty=true;
    }

    _addEmpty(type) {
        const def=NODE_TYPES[type]??NODE_TYPES.note;
        const cx=(this._canvas.width/2-this._offsetX)/this._zoom;
        const cy=(this._canvas.height/2-this._offsetY)/this._zoom;
        const node=BoardManager.addNode({type,title:`New ${def.label}`,x:cx-NW/2+Math.random()*40-20,y:cy-NH/2+Math.random()*40-20,color:def.color});
        this._selNode(node.id); this._dirty=true;
        if(type==='theory') EventBus.emit('board:theory-created',{node});
    }

    _import(type,src) {
        const def=NODE_TYPES[type]??NODE_TYPES.note;
        const cx=(this._canvas.width/2-this._offsetX)/this._zoom;
        const cy=(this._canvas.height/2-this._offsetY)/this._zoom;
        const node=BoardManager.addNode({type,title:src.title??src.name??src.type??'Item',subtitle:src.role??src.category??src.type??'',x:cx-NW/2+Math.random()*60-30,y:cy-NH/2+Math.random()*60-30,color:def.color,sourceId:src.id,data:{id:src.id}});
        this._selNode(node.id); this._refreshAvail(); this._dirty=true;
    }

    _startLoop() { const loop=()=>{if(this._dirty){this._draw();this._dirty=false;}this._rafId=requestAnimationFrame(loop);}; this._rafId=requestAnimationFrame(loop); }
    _stopLoop()  { if(this._rafId!==null){cancelAnimationFrame(this._rafId);this._rafId=null;} }

    _resizeCanvas() {
        if(!this._canvas) return;
        const p=this._canvas.parentElement; if(!p) return;
        this._canvas.width=p.clientWidth; this._canvas.height=p.clientHeight; this._dirty=true;
    }

    _draw() {
        const ctx=this._ctx, W=this._canvas.width, H=this._canvas.height;
        ctx.clearRect(0,0,W,H); ctx.fillStyle='#08111a'; ctx.fillRect(0,0,W,H);
        this._drawGrid(ctx,W,H);
        if(!this._activeCaseId){
            ctx.fillStyle='rgba(45,168,255,0.15)'; ctx.font='13px monospace';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('No active investigation.',W/2,H/2-10);
            ctx.fillText('Open Case Management and start an investigation.',W/2,H/2+12);
            ctx.textAlign='left'; ctx.textBaseline='alphabetic';
            return;
        }
        ctx.save(); ctx.translate(this._offsetX,this._offsetY); ctx.scale(this._zoom,this._zoom);
        BoardManager.getGroups().forEach(g=>this._drawGroup(ctx,g));
        BoardManager.getConnections().forEach(c=>this._drawConn(ctx,c));
        if(this._connecting){
            const from=BoardManager.getNodeById(this._connecting);
            if(from){ctx.strokeStyle='#2DA8FF';ctx.lineWidth=2/this._zoom;ctx.setLineDash([6/this._zoom,4/this._zoom]);ctx.beginPath();ctx.moveTo(from.x+NW/2,from.y+NH/2);ctx.lineTo(this._mMapX,this._mMapY);ctx.stroke();ctx.setLineDash([]);}
        }
        BoardManager.getNodes().forEach(n=>this._drawNode(ctx,n));
        ctx.restore();
        ctx.fillStyle='rgba(45,168,255,0.4)'; ctx.font='10px monospace';
        ctx.fillText(`${Math.round(this._zoom*100)}%`,8,H-8);
        if(this._connecting){ctx.fillStyle='#2DA8FF';ctx.font='11px monospace';ctx.fillText('CONNECTING — click another node',W/2-110,20);}
    }

    _drawGrid(ctx,W,H) {
        const s=80*this._zoom, ox=((this._offsetX%s)+s)%s, oy=((this._offsetY%s)+s)%s;
        ctx.strokeStyle='rgba(45,168,255,0.04)'; ctx.lineWidth=1;
        for(let x=ox;x<W;x+=s){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for(let y=oy;y<H;y+=s){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    }

    _drawGroup(ctx,g) {
        if(!g.nodeIds?.length) return;
        let mx=Infinity,my=Infinity,Mx=-Infinity,My=-Infinity;
        g.nodeIds.forEach(id=>{const n=BoardManager.getNodeById(id);if(!n)return;mx=Math.min(mx,n.x);my=Math.min(my,n.y);Mx=Math.max(Mx,n.x+NW);My=Math.max(My,n.y+NH);});
        const p=20;
        ctx.fillStyle=`${g.color??'#223247'}33`; ctx.strokeStyle=g.color??'#223247'; ctx.lineWidth=1.5/this._zoom;
        ctx.beginPath(); ctx.rect(mx-p,my-p-20,Mx-mx+p*2,My-my+p*2+20); ctx.fill(); ctx.stroke();
        ctx.fillStyle=g.color??'#9FB2C7'; ctx.font=`${Math.max(9,11*Math.min(this._zoom,1))}px monospace`;
        ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(g.title,mx-p+4,my-p-16);
        ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }

    _drawConn(ctx,conn) {
        const from=BoardManager.getNodeById(conn.fromId), to=BoardManager.getNodeById(conn.toId);
        if(!from||!to) return;
        const x1=from.x+NW/2,y1=from.y+NH/2,x2=to.x+NW/2,y2=to.y+NH/2;
        const isSel=conn.id===this._selConnId;
        ctx.strokeStyle=isSel?'#2DA8FF':(conn.color??'#4D5C72'); ctx.lineWidth=(conn.thickness??2)/this._zoom;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        const angle=Math.atan2(y2-y1,x2-x1), as=8/this._zoom;
        ctx.fillStyle=ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(x2,y2);
        ctx.lineTo(x2-as*Math.cos(angle-Math.PI/6),y2-as*Math.sin(angle-Math.PI/6));
        ctx.lineTo(x2-as*Math.cos(angle+Math.PI/6),y2-as*Math.sin(angle+Math.PI/6));
        ctx.closePath(); ctx.fill();
        if(conn.label){ctx.fillStyle='#9FB2C7';ctx.font=`${Math.max(8,10*Math.min(this._zoom,1))}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(conn.label,(x1+x2)/2,(y1+y2)/2-8/this._zoom);ctx.textAlign='left';ctx.textBaseline='alphabetic';}
    }

    _drawNode(ctx,node) {
        const def=NODE_TYPES[node.type]??NODE_TYPES.note, isSel=node.id===this._selNodeId, isCon=node.id===this._connecting;
        const w=node.width??NW, h=node.collapsed?HH:(node.height??NH);
        ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=8/this._zoom; ctx.shadowOffsetX=2/this._zoom; ctx.shadowOffsetY=2/this._zoom;
        ctx.fillStyle=node.color??def.color; ctx.fillRect(node.x,node.y,w,h);
        ctx.shadowColor='transparent';
        ctx.strokeStyle=(isSel||isCon)?'#2DA8FF':(node.pinned?'#FFC94A':(def.border??'#4D5C72'));
        ctx.lineWidth=((isSel||isCon)?2:1.5)/this._zoom; ctx.strokeRect(node.x,node.y,w,h);
        const fs=Math.max(9,11*Math.min(this._zoom,1.5));
        if(node.collapsed){
            ctx.fillStyle='#9FB2C7'; ctx.font=`${fs}px monospace`; ctx.textAlign='left'; ctx.textBaseline='middle';
            ctx.fillText(`${def.emoji} ${node.title}`,node.x+6,node.y+HH/2); ctx.textBaseline='alphabetic'; return;
        }
        ctx.fillStyle=`${def.border}33`; ctx.fillRect(node.x,node.y,w,HH);
        ctx.fillStyle=def.border??'#9FB2C7'; ctx.font=`${Math.max(8,9*Math.min(this._zoom,1.5))}px monospace`;
        ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.fillText(`${def.emoji} ${def.label.toUpperCase()}`,node.x+5,node.y+HH/2);
        if(node.pinned){ctx.fillStyle='#FFC94A';ctx.textAlign='right';ctx.fillText('📌',node.x+w-4,node.y+HH/2);}
        ctx.textAlign='left';
        ctx.fillStyle='#E5EEF7'; ctx.font=`${fs}px monospace`; ctx.textBaseline='top';
        ctx.fillText(this._trunc(node.title,w-10,ctx),node.x+5,node.y+HH+5);
        if(node.subtitle){ctx.fillStyle='#9FB2C7';ctx.font=`${Math.max(8,9*Math.min(this._zoom,1.5))}px monospace`;ctx.fillText(this._trunc(node.subtitle,w-10,ctx),node.x+5,node.y+HH+20);}
        if(node.type==='note'&&node.data?.text){ctx.fillStyle='#9FB2C7';ctx.font=`${Math.max(8,9*Math.min(this._zoom,1.5))}px monospace`;node.data.text.split('\n').slice(0,3).forEach((l,i)=>{ctx.fillText(this._trunc(l,w-10,ctx),node.x+5,node.y+HH+35+i*14);});}
        ctx.textBaseline='alphabetic';
    }

    _s2m(sx,sy){return{mapX:(sx-this._offsetX)/this._zoom,mapY:(sy-this._offsetY)/this._zoom};}

    _hitNode(mx,my) {
        const nodes=[...BoardManager.getNodes()].reverse();
        for(const n of nodes){const w=n.width??NW,h=n.collapsed?HH:(n.height??NH);if(mx>=n.x&&mx<=n.x+w&&my>=n.y&&my<=n.y+h)return n;}
        return null;
    }

    _hitConn(mx,my) {
        const T=8/this._zoom;
        for(const c of BoardManager.getConnections()){
            const f=BoardManager.getNodeById(c.fromId),t=BoardManager.getNodeById(c.toId);
            if(!f||!t) continue;
            const x1=f.x+NW/2,y1=f.y+NH/2,x2=t.x+NW/2,y2=t.y+NH/2;
            const dx=x2-x1,dy=y2-y1,len=dx*dx+dy*dy;
            if(len===0) continue;
            const tt=Math.max(0,Math.min(1,((mx-x1)*dx+(my-y1)*dy)/len));
            if(Math.hypot(mx-(x1+tt*dx),my-(y1+tt*dy))<T) return c;
        }
        return null;
    }

    _md(e) {
        if(e.button!==0) return;
        const {mapX,mapY}=this._s2m(e.offsetX,e.offsetY);
        this._mMapX=mapX; this._mMapY=mapY;
        const hn=this._hitNode(mapX,mapY);
        if(hn){
            if(this._connecting){
                if(hn.id!==this._connecting) BoardManager.addConnection(this._connecting,hn.id,{label:'Unknown'});
                this._connecting=null; this._canvas.style.cursor='default'; this._dirty=true; return;
            }
            this._selNode(hn.id);
            this._dragId=hn.id; this._dragOX=mapX-hn.x; this._dragOY=mapY-hn.y;
            this._canvas.style.cursor='grabbing';
        } else {
            const hc=this._hitConn(mapX,mapY);
            if(hc){this._selConnId=hc.id;this._selNodeId=null;this._renderConnInsp(hc);this._dirty=true;}
            else{
                if(this._connecting){this._connecting=null;this._canvas.style.cursor='default';}
                else{this._selNodeId=null;this._selConnId=null;this._emptyInsp();}
                this._panning=true; this._panSX=e.clientX; this._panSY=e.clientY; this._panOX=this._offsetX; this._panOY=this._offsetY;
                this._canvas.style.cursor='grabbing'; this._dirty=true;
            }
        }
    }

    _mm(e) {
        const {mapX,mapY}=this._s2m(e.offsetX,e.offsetY);
        this._mMapX=mapX; this._mMapY=mapY;
        if(this._dragId){BoardManager.updateNode(this._dragId,{x:mapX-this._dragOX,y:mapY-this._dragOY});this._dirty=true;return;}
        if(this._panning){this._offsetX=this._panOX+(e.clientX-this._panSX);this._offsetY=this._panOY+(e.clientY-this._panSY);this._dirty=true;return;}
        if(this._connecting) this._dirty=true;
    }

    _mu() {
        if(this._dragId){this._schedSave();this._dragId=null;}
        if(this._panning){this._panning=false;this._schedSave();}
        this._canvas.style.cursor=this._connecting?'crosshair':'default';
    }

    _wheel(e) {
        e.preventDefault();
        const delta=e.deltaY>0?-ZOOM_STEP:ZOOM_STEP, prev=this._zoom;
        this._zoom=Math.max(ZOOM_MIN,Math.min(this._zoom+delta,ZOOM_MAX));
        const s=this._zoom/prev;
        this._offsetX=e.offsetX-s*(e.offsetX-this._offsetX);
        this._offsetY=e.offsetY-s*(e.offsetY-this._offsetY);
        this._dirty=true; this._schedSave();
    }

    _dbl(e) {
        const {mapX,mapY}=this._s2m(e.offsetX,e.offsetY);
        const n=this._hitNode(mapX,mapY);
        if(n){BoardManager.updateNode(n.id,{collapsed:!n.collapsed});this._dirty=true;}
    }

    _key(e) {
        if(e.key==='Escape'){this._connecting=null;this._canvas.style.cursor='default';this._dirty=true;}
        if((e.key==='Delete'||e.key==='Backspace')&&this._selNodeId&&(e.target===this._canvas||e.target===document.body)){
            e.preventDefault();
            BoardManager.removeNode(this._selNodeId);
            this._selNodeId=null; this._emptyInsp(); this._refreshAvail(); this._dirty=true;
        }
    }

    _ts(e){if(e.touches.length===1){this._panning=true;this._panSX=e.touches[0].clientX;this._panSY=e.touches[0].clientY;this._panOX=this._offsetX;this._panOY=this._offsetY;this._pinch=null;}else if(e.touches.length===2){this._panning=false;this._pinch=this._pd(e);}}
    _tm(e){e.preventDefault();if(e.touches.length===1&&this._panning){this._offsetX=this._panOX+(e.touches[0].clientX-this._panSX);this._offsetY=this._panOY+(e.touches[0].clientY-this._panSY);this._dirty=true;}else if(e.touches.length===2&&this._pinch!==null){const d=this._pd(e);this._zoom=Math.max(ZOOM_MIN,Math.min(this._zoom*(d/this._pinch),ZOOM_MAX));this._pinch=d;this._dirty=true;}}
    _te(){this._panning=false;this._pinch=null;this._schedSave();}
    _pd(e){const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(dx*dx+dy*dy);}

    _selNode(id) {
        this._selNodeId=id; this._selConnId=null;
        const n=BoardManager.getNodeById(id);
        if(n){this._renderNodeInsp(n);EventBus.emit('board:node-selected',{node:n});}
        this._dirty=true;
    }

    _renderNodeInsp(node) {
        if(!this._inspEl) return;
        const def=NODE_TYPES[node.type]??NODE_TYPES.note;
        const conns=BoardManager.getConnectionsForNode(node.id);
        this._inspEl.innerHTML=`
<div class="board__insp-header"><span class="board__insp-type" style="color:${def.border}">${def.emoji} ${def.label}</span><span class="board__insp-id">${node.id}</span></div>
<div class="board__insp-section">Title</div>
<input class="board__insp-input" type="text" value="${this._esc(node.title)}" data-field="title"/>
<div class="board__insp-section">Subtitle</div>
<input class="board__insp-input" type="text" value="${this._esc(node.subtitle??'')}" data-field="subtitle"/>
${node.type==='note'?`<div class="board__insp-section">Text</div><textarea class="board__insp-textarea" data-field="note-text">${this._esc(node.data?.text??'')}</textarea>`:''}
${node.type==='theory'?`<div class="board__insp-section">Description</div><textarea class="board__insp-textarea" data-field="theory-desc">${this._esc(node.data?.description??'')}</textarea><div class="board__insp-section">Confidence</div><input type="range" class="board__insp-range" min="0" max="100" value="${node.data?.confidence??50}" data-field="confidence"/><div class="board__insp-conf-val">${node.data?.confidence??50}%</div>`:''}
<div class="board__insp-actions">
<button type="button" class="board__insp-btn" data-action="pin">${node.pinned?'📌 Unpin':'📌 Pin'}</button>
<button type="button" class="board__insp-btn" data-action="connect">🔗 Connect</button>
<button type="button" class="board__insp-btn" data-action="collapse">${node.collapsed?'▼ Expand':'▲ Collapse'}</button>
<button type="button" class="board__insp-btn board__insp-btn--danger" data-action="delete">🗑 Delete</button>
</div>
${conns.length?`<div class="board__insp-section">Connections (${conns.length})</div><div class="board__insp-conns"></div>`:''}
<div class="board__insp-section">Quick Actions</div><div class="board__insp-quick-actions"></div>`;

        this._inspEl.querySelectorAll('[data-field]').forEach(el=>{
            el.addEventListener('input',()=>{
                const f=el.dataset.field;
                if(f==='title') BoardManager.updateNode(node.id,{title:el.value});
                else if(f==='subtitle') BoardManager.updateNode(node.id,{subtitle:el.value});
                else if(f==='note-text') BoardManager.updateNode(node.id,{data:{...node.data,text:el.value}});
                else if(f==='theory-desc') BoardManager.updateNode(node.id,{data:{...node.data,description:el.value}});
                else if(f==='confidence'){BoardManager.updateNode(node.id,{data:{...node.data,confidence:Number(el.value)}});const v=this._inspEl.querySelector('.board__insp-conf-val');if(v)v.textContent=`${el.value}%`;}
                this._dirty=true;
            });
        });

        this._inspEl.querySelectorAll('[data-action]').forEach(btn=>{
            btn.addEventListener('click',()=>{
                const a=btn.dataset.action;
                if(a==='pin'){BoardManager.updateNode(node.id,{pinned:!node.pinned});this._renderNodeInsp(BoardManager.getNodeById(node.id));}
                if(a==='connect'){this._connecting=node.id;this._canvas.style.cursor='crosshair';this._dirty=true;}
                if(a==='collapse'){BoardManager.updateNode(node.id,{collapsed:!node.collapsed});this._renderNodeInsp(BoardManager.getNodeById(node.id));}
                if(a==='delete'){BoardManager.removeNode(node.id);this._selNodeId=null;this._emptyInsp();this._refreshAvail();this._dirty=true;}
            });
        });

        const connsEl=this._inspEl.querySelector('.board__insp-conns');
        if(connsEl) conns.forEach(c=>{
            const other=c.fromId===node.id?BoardManager.getNodeById(c.toId):BoardManager.getNodeById(c.fromId);
            const row=document.createElement('div'); row.className='board__insp-conn-row';
            const dir=c.fromId===node.id?'→':'←';
            row.innerHTML=`<span class="board__insp-conn-dir">${dir}</span><span class="board__insp-conn-name">${this._esc(other?.title??'?')}</span><input class="board__insp-conn-label" type="text" placeholder="label" value="${this._esc(c.label??'')}"/><button class="board__insp-conn-del" type="button">×</button>`;
            row.querySelector('.board__insp-conn-label').addEventListener('change',e=>{BoardManager.updateConnection(c.id,{label:e.target.value});this._dirty=true;});
            row.querySelector('.board__insp-conn-del').addEventListener('click',()=>{BoardManager.removeConnection(c.id);this._renderNodeInsp(BoardManager.getNodeById(node.id));this._dirty=true;});
            connsEl.appendChild(row);
        });

        const qa=this._inspEl.querySelector('.board__insp-quick-actions');
        if(qa) this._buildQA(qa,node);
    }

    _buildQA(el,node) {
        const add=(label,fn)=>{const b=document.createElement('button');b.className='board__qa-btn';b.type='button';b.textContent=label;b.addEventListener('click',fn);el.appendChild(b);};
        if(node.type==='evidence'&&node.sourceId) add('🔍 Open Evidence',()=>{EventBus.emit('application:requested',{appId:'evidence'});setTimeout(()=>EventBus.emit('evidence:focus-request',{evidenceId:node.sourceId}),300);});
        if(node.type==='person'&&node.sourceId)   add('🗃️ Open Profile',()=>{EventBus.emit('application:requested',{appId:'criminal-database'});setTimeout(()=>EventBus.emit('person:focus-request',{personId:node.sourceId}),300);});
        if(node.type==='location'&&node.sourceId) add('📍 Open Map',()=>{EventBus.emit('application:requested',{appId:'city-map'});setTimeout(()=>EventBus.emit('map:focus-request',{locationId:node.sourceId}),300);});
        if(node.type==='camera'&&node.sourceId)   add('📹 Open CCTV',()=>{EventBus.emit('application:requested',{appId:'cctv'});setTimeout(()=>EventBus.emit('cctv:focus-request',{cameraId:node.sourceId,timestamp:0}),300);});
        if(node.type==='conversation'&&node.sourceId) add('💬 Open Messenger',()=>{EventBus.emit('application:requested',{appId:'messenger'});setTimeout(()=>EventBus.emit('messenger:focus-request',{convId:node.sourceId}),300);});
        if(node.type==='report'&&node.sourceId) add('🧪 Open Forensics',()=>{EventBus.emit('application:requested',{appId:'forensics'});});
        if(!el.children.length) el.innerHTML='<span class="board__empty-hint">No quick actions</span>';
    }

    _renderConnInsp(conn) {
        if(!this._inspEl) return;
        const from=BoardManager.getNodeById(conn.fromId), to=BoardManager.getNodeById(conn.toId);
        this._inspEl.innerHTML=`
<div class="board__insp-header"><span class="board__insp-type">🔗 Connection</span></div>
<div class="board__insp-section">From → To</div>
<div class="board__insp-value">${this._esc(from?.title??'?')} → ${this._esc(to?.title??'?')}</div>
<div class="board__insp-section">Relation</div>
<select class="board__insp-select" data-field="relation">${RELATION_TYPES.map(r=>`<option ${r===conn.label?'selected':''}>${r}</option>`).join('')}</select>
<div class="board__insp-section">Label</div>
<input class="board__insp-input" type="text" value="${this._esc(conn.label??'')}" data-conn-label/>
<div class="board__insp-actions"><button type="button" class="board__insp-btn board__insp-btn--danger" data-action="del-conn">🗑 Delete</button></div>`;
        this._inspEl.querySelector('[data-field="relation"]').addEventListener('change',e=>{BoardManager.updateConnection(conn.id,{label:e.target.value});this._dirty=true;});
        this._inspEl.querySelector('[data-conn-label]').addEventListener('change',e=>{BoardManager.updateConnection(conn.id,{label:e.target.value});this._dirty=true;});
        this._inspEl.querySelector('[data-action="del-conn"]').addEventListener('click',()=>{BoardManager.removeConnection(conn.id);this._selConnId=null;this._emptyInsp();this._dirty=true;});
    }

    _emptyInsp() {
        if(!this._inspEl) return;
        this._inspEl.innerHTML=`<div class="board__insp-empty"><div class="board__insp-empty-emoji">📌</div><div class="board__insp-empty-text">Click a node to inspect</div></div>`;
    }

    _search() {
        const results=BoardManager.search(this._searchEl?.value??'');
        if(results.length){const n=results[0];this._offsetX=this._canvas.width/2-n.x*this._zoom;this._offsetY=this._canvas.height/2-n.y*this._zoom;this._selNode(n.id);}
    }

    _solveDialog() {
        const nodes=BoardManager.getNodes(), conns=BoardManager.getConnections();
        const theories=nodes.filter(n=>n.type==='theory');
        const connectedIds=new Set(); conns.forEach(c=>{connectedIds.add(c.fromId);connectedIds.add(c.toId);});
        const orphans=nodes.filter(n=>!connectedIds.has(n.id)&&n.type!=='note');
        const dlg=document.createElement('div'); dlg.className='board__solve-overlay';
        dlg.innerHTML=`<div class="board__solve-dialog">
<div class="board__solve-header">🔎 Solve Investigation</div>
<div class="board__solve-section">Summary</div>
<div class="board__solve-stats">
<div class="board__solve-stat"><span>${nodes.length}</span><span>Nodes</span></div>
<div class="board__solve-stat"><span>${conns.length}</span><span>Connections</span></div>
<div class="board__solve-stat"><span>${theories.length}</span><span>Theories</span></div>
<div class="board__solve-stat"><span>${orphans.length}</span><span>Unconnected</span></div>
</div>
<div class="board__solve-section">Theories</div>
<div class="board__solve-theories">${theories.length?theories.map(t=>`<div class="board__solve-theory-row"><div class="board__solve-theory-title">💡 ${this._esc(t.title)}</div><div class="board__solve-theory-conf">Confidence: ${t.data?.confidence??0}%</div><div class="board__solve-theory-desc">${this._esc(t.data?.description??'')}</div></div>`).join(''):'<div class="board__empty-hint">No theories yet.</div>'}</div>
<div class="board__solve-section">Unconnected Nodes</div>
<div class="board__solve-orphans">${orphans.length?orphans.map(n=>`<div class="board__solve-orphan">${NODE_TYPES[n.type]?.emoji??'📌'} ${this._esc(n.title)}</div>`).join(''):'<div class="board__empty-hint">All connected ✅</div>'}</div>
<div class="board__solve-actions">
<button type="button" class="board__solve-close">Cancel</button>
<button type="button" class="board__solve-continue">Continue to Resolution Wizard →</button>
</div>
</div>`;
        dlg.querySelector('.board__solve-close').addEventListener('click',()=>dlg.remove());
        dlg.querySelector('.board__solve-continue').addEventListener('click',()=>{dlg.remove();this._wizard.open();});
        dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.remove();});
        document.body.appendChild(dlg);
    }

    _resetView(){this._zoom=1;this._offsetX=0;this._offsetY=0;this._dirty=true;this._saveCamera();}
    _saveCamera(){BoardManager.saveCamera(this._offsetX,this._offsetY,this._zoom);}
    _schedSave(){clearTimeout(this._saveT);this._saveT=setTimeout(()=>this._saveCamera(),800);}
    _trunc(text,maxW,ctx){if(!text)return'';if(ctx.measureText(text).width<=maxW)return text;let t=text;while(t.length>0&&ctx.measureText(t+'…').width>maxW)t=t.slice(0,-1);return t+'…';}
    _esc(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML;}
}

export default InvestigationBoard;
