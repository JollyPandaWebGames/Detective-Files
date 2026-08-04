/**
 * CityMap
 *
 * Purpose:
 *   Interactive investigation map. Shows every case location as a
 *   pixel-art marker on a pannable, zoomable canvas. Connects
 *   directly to Evidence Database, CCTV Viewer, and Messenger.
 *
 * Layout:
 *   Desktop  — left filters | center canvas | right details
 *   Tablet   — collapsible sidebars
 *   Phone    — fullscreen map + bottom sheet for details
 *
 * Data:
 *   Locations loaded per case by MapManager (data/cases/{id}/map/locations.json).
 *   Notes, zoom, center, and selection persisted via StorageManager.
 *
 * Events consumed:
 *   investigationChanged — load map for the new investigation (Epic 01.1)
 *   map:loaded         — render markers
 *   map:focus-request  — highlight and centre on a location
 *
 * Events emitted:
 *   map:location-selected — user selected a marker   { location }
 *   map:location-focused  — marker centred on screen { locationId }
 *   map:note-updated      — via MapManager
 */

import BaseApp    from '../../core/BaseApp.js';
import EventBus   from '../../core/EventBus.js';
import MapManager from '../../managers/MapManager.js';

// ── Marker definitions ────────────────────────────────────────────
const MARKER_TYPES = {
    'Crime Scene':      { emoji: '🔴', label: 'Crime Scene'    },
    'CCTV Camera':      { emoji: '📹', label: 'CCTV Camera'    },
    'Evidence Location':{ emoji: '🔍', label: 'Evidence'       },
    'Witness Location': { emoji: '👤', label: 'Witness'        },
    'Suspect Location': { emoji: '🟠', label: 'Suspect'        },
    'Police Station':   { emoji: '🏛️', label: 'Police Station' },
    'Laboratory':       { emoji: '🧪', label: 'Laboratory'     },
};

const DEFAULT_MARKER = { emoji: '📍', label: 'Location' };

// ── Zoom constraints ──────────────────────────────────────────────
const ZOOM_MIN   = 0.4;
const ZOOM_MAX   = 3.0;
const ZOOM_STEP  = 0.2;
const NOTES_DELAY = 800;

class CityMap extends BaseApp {

    constructor( config ) {
        super( config );

        /** @type {string|null} */
        this._activeCaseId    = null;
        /** @type {string|null} */
        this._selectedId      = null;
        /** @type {string}      */
        this._searchQuery     = '';
        /** @type {Set<string>} Active filter types */
        this._activeFilters   = new Set( Object.keys( MARKER_TYPES ) );

        // Canvas / viewport state.
        this._zoom    = 1;
        this._offsetX = 0;   // Canvas origin offset in screen px.
        this._offsetY = 0;

        // Panning state.
        this._isPanning    = false;
        this._panStartX    = 0;
        this._panStartY    = 0;
        this._panOriginX   = 0;
        this._panOriginY   = 0;

        // Touch pinch state.
        this._lastPinchDist = null;

        // DOM refs.
        this._filterListEl  = null;
        this._searchInputEl = null;
        this._canvasEl      = null;
        this._ctx            = null;
        this._detailEl       = null;
        this._notesEl        = null;

        // Bound handlers.
        this._onInvestigationChanged = ( { investigation } ) => this._syncInvestigation( investigation );
        this._onMapLoaded     = ()               => this._renderMap();
        this._onFocusRequest  = ( { locationId } ) => this._focusLocation( locationId );
        this._notesTimer      = null;

        // Bound canvas handlers (stored for removal).
        this._onMouseDown  = ( e ) => this._handleMouseDown( e );
        this._onMouseMove  = ( e ) => this._handleMouseMove( e );
        this._onMouseUp    = ()    => this._handleMouseUp();
        this._onWheel      = ( e ) => this._handleWheel( e );
        this._onDblClick   = ( e ) => this._handleDblClick( e );
        this._onTouchStart = ( e ) => this._handleTouchStart( e );
        this._onTouchMove  = ( e ) => this._handleTouchMove( e );
        this._onTouchEnd   = ()    => this._handleTouchEnd();
        this._onResize     = ()    => this._resizeCanvas();

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {
        contentEl.classList.add( 'citymap' );
        this._buildLayout( contentEl );
    }

    open() {
        EventBus.on( 'investigationChanged', this._onInvestigationChanged );
        EventBus.on( 'map:loaded',         this._onMapLoaded    );
        EventBus.on( 'map:focus-request',  this._onFocusRequest );

        window.addEventListener( 'resize', this._onResize );
        this._resizeCanvas();

        this._syncInvestigation( this.context.getActiveInvestigation() );
    }

    close() {
        this._saveViewState();
        EventBus.off( 'investigationChanged', this._onInvestigationChanged );
        EventBus.off( 'map:loaded',        this._onMapLoaded    );
        EventBus.off( 'map:focus-request', this._onFocusRequest );
        window.removeEventListener( 'resize', this._onResize );
        clearTimeout( this._notesTimer );
    }

    minimize() { this._saveViewState(); }
    restore()  { this._resizeCanvas(); this._renderMap(); }

    destroy() {
        clearTimeout( this._notesTimer );
        window.removeEventListener( 'resize', this._onResize );
        this._canvasEl    = null;
        this._ctx          = null;
        this._filterListEl = null;
        this._detailEl     = null;
        this._notesEl      = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    _buildLayout( contentEl ) {

        // ── Left — filters + search ───────────────────────────────
        const left = document.createElement( 'div' );
        left.className = 'citymap__left';

        const searchWrap = document.createElement( 'div' );
        searchWrap.className = 'citymap__search-wrap';

        this._searchInputEl = document.createElement( 'input' );
        this._searchInputEl.type        = 'text';
        this._searchInputEl.className   = 'citymap__search-input';
        this._searchInputEl.placeholder = 'Search locations...';
        this._searchInputEl.setAttribute( 'aria-label', 'Search map locations' );
        this._searchInputEl.addEventListener( 'input', () => {
            this._searchQuery = this._searchInputEl.value;
            this._renderMap();
        } );
        searchWrap.appendChild( this._searchInputEl );

        const filterHeader = document.createElement( 'div' );
        filterHeader.className   = 'citymap__panel-header';
        filterHeader.textContent = 'Filter Markers';

        this._filterListEl = document.createElement( 'div' );
        this._filterListEl.className = 'citymap__filter-list';
        this._buildFilterList();

        const navHeader = document.createElement( 'div' );
        navHeader.className   = 'citymap__panel-header';
        navHeader.textContent = 'Navigation';

        const navBtns = document.createElement( 'div' );
        navBtns.className = 'citymap__nav-btns';

        const zoomInBtn  = this._makeNavBtn( '+', 'Zoom in',    () => this._adjustZoom( ZOOM_STEP )  );
        const zoomOutBtn = this._makeNavBtn( '−', 'Zoom out',   () => this._adjustZoom( -ZOOM_STEP ) );
        const resetBtn   = this._makeNavBtn( '⌖', 'Reset view', () => this._resetView()              );

        navBtns.appendChild( zoomInBtn );
        navBtns.appendChild( zoomOutBtn );
        navBtns.appendChild( resetBtn );

        left.appendChild( searchWrap );
        left.appendChild( filterHeader );
        left.appendChild( this._filterListEl );
        left.appendChild( navHeader );
        left.appendChild( navBtns );

        // ── Center — canvas ───────────────────────────────────────
        const center = document.createElement( 'div' );
        center.className = 'citymap__center';

        this._canvasEl = document.createElement( 'canvas' );
        this._canvasEl.className = 'citymap__canvas';
        this._canvasEl.setAttribute( 'aria-label', 'Investigation map' );
        this._ctx = this._canvasEl.getContext( '2d' );

        this._bindCanvasEvents();
        center.appendChild( this._canvasEl );

        // ── Right — location details ──────────────────────────────
        const right = document.createElement( 'div' );
        right.className = 'citymap__right';

        this._detailEl = document.createElement( 'div' );
        this._detailEl.className = 'citymap__detail';
        this._renderEmptyDetail();

        right.appendChild( this._detailEl );

        contentEl.appendChild( left );
        contentEl.appendChild( center );
        contentEl.appendChild( right );

    }

    _buildFilterList() {

        if ( !this._filterListEl ) return;
        this._filterListEl.innerHTML = '';

        Object.entries( MARKER_TYPES ).forEach( ( [ type, def ] ) => {

            const row = document.createElement( 'label' );
            row.className = 'citymap__filter-row';

            const cb = document.createElement( 'input' );
            cb.type    = 'checkbox';
            cb.checked = this._activeFilters.has( type );
            cb.className = 'citymap__filter-cb';
            cb.addEventListener( 'change', () => {
                if ( cb.checked ) this._activeFilters.add( type );
                else              this._activeFilters.delete( type );
                this._renderMap();
            } );

            const emoji = document.createElement( 'span' );
            emoji.className   = 'citymap__filter-emoji';
            emoji.textContent = def.emoji;

            const label = document.createElement( 'span' );
            label.className   = 'citymap__filter-label';
            label.textContent = def.label;

            row.appendChild( cb );
            row.appendChild( emoji );
            row.appendChild( label );
            this._filterListEl.appendChild( row );

        } );

    }

    _makeNavBtn( symbol, title, onClick ) {
        const btn = document.createElement( 'button' );
        btn.className   = 'citymap__nav-btn';
        btn.textContent = symbol;
        btn.setAttribute( 'type', 'button' );
        btn.setAttribute( 'title', title );
        btn.addEventListener( 'click', onClick );
        return btn;
    }

    // ─────────────────────────────────────────────────────────────
    // Case Handling
    // ─────────────────────────────────────────────────────────────

    _syncInvestigation( investigation ) {

        if ( !investigation ) {
            this._activeCaseId = null;
            this._renderEmptyDetail();
            this._drawNoCaseMessage();
            return;
        }

        if ( this._activeCaseId === investigation.caseId ) {
            this._renderMap();
            return;
        }

        this._activeCaseId = investigation.caseId;
        this._selectedId   = null;
        this._renderEmptyDetail();
        this._drawNoCaseMessage();
        MapManager.loadForCase( investigation.caseId ).then( () => {
            const saved = MapManager.getViewState();
            this._zoom    = Math.max( ZOOM_MIN, Math.min( saved.zoom, ZOOM_MAX ) );
            this._selectedId = saved.selected;
            this._centreViewOn( saved.center.x, saved.center.y );
            this._renderMap();
        } );
    }

    // ─────────────────────────────────────────────────────────────
    // Canvas Rendering
    // ─────────────────────────────────────────────────────────────

    _resizeCanvas() {
        if ( !this._canvasEl ) return;
        const parent = this._canvasEl.parentElement;
        if ( !parent ) return;
        this._canvasEl.width  = parent.clientWidth;
        this._canvasEl.height = parent.clientHeight;
        this._renderMap();
    }

    _renderMap() {

        const ctx = this._ctx;
        if ( !ctx || !this._canvasEl ) return;

        const W = this._canvasEl.width;
        const H = this._canvasEl.height;

        // ── Background ────────────────────────────────────────────
        ctx.clearRect( 0, 0, W, H );
        ctx.fillStyle = '#08111a';
        ctx.fillRect( 0, 0, W, H );

        const locations = MapManager.getAllLocations();

        if ( locations.length === 0 ) {
            this._drawNoCaseMessage();
            return;
        }

        const { width: mapW, height: mapH } = MapManager.getMapDimensions();

        ctx.save();
        ctx.translate( this._offsetX, this._offsetY );
        ctx.scale( this._zoom, this._zoom );

        // ── Grid ──────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba( 45, 168, 255, 0.04 )';
        ctx.lineWidth   = 1 / this._zoom;

        for ( let x = 0; x <= mapW; x += 100 ) {
            ctx.beginPath(); ctx.moveTo( x, 0 ); ctx.lineTo( x, mapH ); ctx.stroke();
        }
        for ( let y = 0; y <= mapH; y += 100 ) {
            ctx.beginPath(); ctx.moveTo( 0, y ); ctx.lineTo( mapW, y ); ctx.stroke();
        }

        // ── District Labels ───────────────────────────────────────
        this._drawDistrictLabels( ctx );

        // ── Road Network ──────────────────────────────────────────
        this._drawRoads( ctx );

        // ── Filtered locations ────────────────────────────────────
        const query     = this._searchQuery.toLowerCase().trim();
        const matched   = query
            ? MapManager.search( this._searchQuery ).map( l => l.id )
            : null;

        locations.forEach( loc => {
            if ( !this._activeFilters.has( loc.type ) ) return;
            if ( matched && !matched.includes( loc.id ) ) return;
            this._drawMarker( ctx, loc );
        } );

        ctx.restore();

        // ── Zoom indicator ────────────────────────────────────────
        ctx.fillStyle = 'rgba( 45, 168, 255, 0.5 )';
        ctx.font      = '10px monospace';
        ctx.fillText( `${ Math.round( this._zoom * 100 ) }%`, 8, H - 8 );

    }

    _drawDistrictLabels( ctx ) {

        const labels = [
            { text: 'WESTSIDE',           x: 180,  y: 130 },
            { text: 'CITY CENTRE',        x: 420,  y: 200 },
            { text: 'INDUSTRIAL DISTRICT',x: 580,  y: 180 },
            { text: 'RESEARCH QUARTER',   x: 700,  y: 420 },
        ];

        ctx.font      = 'bold 11px monospace';
        ctx.fillStyle = 'rgba( 45, 168, 255, 0.08 )';
        ctx.letterSpacing = '2px';

        labels.forEach( l => {
            ctx.fillText( l.text, l.x, l.y );
        } );

        ctx.letterSpacing = '0px';

    }

    _drawRoads( ctx ) {

        ctx.strokeStyle = 'rgba( 77, 92, 114, 0.35 )';
        ctx.lineWidth   = 6 / this._zoom;
        ctx.lineCap     = 'round';

        const roads = [
            [ [0, 420], [1200, 420] ],        // Holloway Lane (horizontal)
            [ [280, 0], [280, 800] ],           // City Centre Ave (vertical)
            [ [620, 0], [620, 800] ],           // Ashcroft St (vertical)
            [ [0, 240], [400, 240] ],           // Ravenwood St (horizontal)
            [ [750, 300], [1200, 300] ],         // Fogwood St (horizontal, right)
        ];

        roads.forEach( road => {
            ctx.beginPath();
            ctx.moveTo( road[ 0 ][ 0 ], road[ 0 ][ 1 ] );
            road.slice( 1 ).forEach( pt => ctx.lineTo( pt[ 0 ], pt[ 1 ] ) );
            ctx.stroke();
        } );

    }

    _drawMarker( ctx, loc ) {

        const def         = MARKER_TYPES[ loc.type ] ?? DEFAULT_MARKER;
        const isSelected  = loc.id === this._selectedId;
        const markerSize  = isSelected ? 22 : 18;

        // ── Pulse ring for selected ───────────────────────────────
        if ( isSelected ) {
            ctx.strokeStyle = '#2DA8FF';
            ctx.lineWidth   = 2 / this._zoom;
            ctx.beginPath();
            ctx.arc( loc.x, loc.y, markerSize + 4, 0, Math.PI * 2 );
            ctx.stroke();
        }

        // ── Background circle ─────────────────────────────────────
        ctx.fillStyle = isSelected ? 'rgba( 45, 168, 255, 0.3 )' : 'rgba( 11, 17, 24, 0.8 )';
        ctx.beginPath();
        ctx.arc( loc.x, loc.y, markerSize, 0, Math.PI * 2 );
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#2DA8FF' : '#4D5C72';
        ctx.lineWidth   = 1.5 / this._zoom;
        ctx.stroke();

        // ── Emoji icon ────────────────────────────────────────────
        ctx.font      = `${ Math.round( 14 / Math.max( this._zoom, 0.5 ) * this._zoom ) }px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText( def.emoji, loc.x, loc.y );

        // ── Name label ────────────────────────────────────────────
        ctx.font      = `${ Math.max( 9, Math.round( 10 * Math.min( this._zoom, 1.5 ) ) ) }px monospace`;
        ctx.fillStyle = isSelected ? '#2DA8FF' : '#9FB2C7';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelY = loc.y + markerSize + 4;
        ctx.fillText( loc.name, loc.x, labelY );

        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';

    }

    _drawNoCaseMessage() {

        const ctx = this._ctx;
        if ( !ctx || !this._canvasEl ) return;

        const W = this._canvasEl.width;
        const H = this._canvasEl.height;

        ctx.clearRect( 0, 0, W, H );
        ctx.fillStyle = '#08111a';
        ctx.fillRect( 0, 0, W, H );

        ctx.fillStyle    = 'rgba( 45, 168, 255, 0.15 )';
        ctx.font         = '13px monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText( 'No active investigation.', W / 2, H / 2 - 10 );
        ctx.fillText( 'Open Case Management and start an investigation.', W / 2, H / 2 + 12 );
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';

    }

    // ─────────────────────────────────────────────────────────────
    // Location Selection / Detail
    // ─────────────────────────────────────────────────────────────

    _selectLocation( locationId ) {

        const loc = MapManager.getById( locationId );
        if ( !loc ) return;

        this._selectedId = locationId;
        this._renderMap();
        this._renderDetail( loc );

        EventBus.emit( 'map:location-selected', { location: loc } );

    }

    _focusLocation( locationId ) {

        const loc = MapManager.getById( locationId );
        if ( !loc ) return;

        this._selectLocation( locationId );
        this._centreViewOn( loc.x, loc.y );
        this._renderMap();

        EventBus.emit( 'map:location-focused', { locationId } );

    }

    _renderDetail( loc ) {

        if ( !this._detailEl ) return;

        const def = MARKER_TYPES[ loc.type ] ?? DEFAULT_MARKER;

        this._detailEl.innerHTML = `
            <div class="citymap__detail-thumb">${ def.emoji }</div>
            <div class="citymap__detail-name">${ this._escape( loc.name ) }</div>
            <div class="citymap__detail-type">${ this._escape( loc.type ) }</div>
            <div class="citymap__detail-address">${ this._escape( loc.address ?? '' ) }</div>
            <div class="citymap__detail-description"></div>

            <div class="citymap__detail-section">Related Evidence</div>
            <div class="citymap__detail-links" id="ev-links"></div>

            <div class="citymap__detail-section">Related Cameras</div>
            <div class="citymap__detail-links" id="cam-links"></div>

            <div class="citymap__detail-section">Investigation Notes</div>
            <textarea class="citymap__notes" placeholder="Notes for this location..."></textarea>
        `;

        this._detailEl.querySelector( '.citymap__detail-description' ).textContent = loc.description ?? '';

        // Related evidence links.
        const evLinks = this._detailEl.querySelector( '#ev-links' );
        if ( loc.relatedEvidence?.length ) {
            loc.relatedEvidence.forEach( evId => {
                evLinks.appendChild( this._makeActionLink( `🔍 ${ evId }`, () => {
                    EventBus.emit( 'application:requested', { appId: 'evidence' } );
                    setTimeout( () => EventBus.emit( 'evidence:focus-request', { evidenceId: evId } ), 300 );
                } ) );
            } );
        }
        else {
            evLinks.innerHTML = '<span class="citymap__empty-field">None</span>';
        }

        // Related camera links.
        const camLinks = this._detailEl.querySelector( '#cam-links' );
        if ( loc.relatedCameras?.length ) {
            loc.relatedCameras.forEach( camId => {
                camLinks.appendChild( this._makeActionLink( `📹 ${ camId }`, () => {
                    EventBus.emit( 'application:requested', { appId: 'cctv' } );
                    setTimeout( () => EventBus.emit( 'cctv:focus-request', { cameraId: camId, timestamp: 0 } ), 300 );
                } ) );
            } );
        }
        else {
            camLinks.innerHTML = '<span class="citymap__empty-field">None</span>';
        }

        // Notes.
        const notesEl = this._detailEl.querySelector( '.citymap__notes' );
        notesEl.value = MapManager.getNotes( loc.id );
        notesEl.addEventListener( 'input', () => {
            clearTimeout( this._notesTimer );
            this._notesTimer = setTimeout( () => {
                MapManager.saveNotes( loc.id, notesEl.value );
            }, NOTES_DELAY );
        } );

        this._notesEl = notesEl;

    }

    _renderEmptyDetail() {

        if ( !this._detailEl ) return;

        this._detailEl.innerHTML = `
            <div class="citymap__detail-empty">
                <div class="citymap__detail-empty-emoji">🗺️</div>
                <div class="citymap__detail-empty-text">Click a marker to view location details</div>
            </div>
        `;

    }

    _makeActionLink( label, onClick ) {

        const btn = document.createElement( 'button' );
        btn.className   = 'citymap__action-link';
        btn.textContent = label;
        btn.setAttribute( 'type', 'button' );
        btn.addEventListener( 'click', onClick );
        return btn;

    }

    // ─────────────────────────────────────────────────────────────
    // Canvas Events
    // ─────────────────────────────────────────────────────────────

    _bindCanvasEvents() {

        const el = this._canvasEl;
        el.addEventListener( 'mousedown',  this._onMouseDown  );
        el.addEventListener( 'mousemove',  this._onMouseMove  );
        el.addEventListener( 'mouseup',    this._onMouseUp    );
        el.addEventListener( 'mouseleave', this._onMouseUp    );
        el.addEventListener( 'wheel',      this._onWheel, { passive: false } );
        el.addEventListener( 'dblclick',   this._onDblClick   );
        el.addEventListener( 'touchstart', this._onTouchStart, { passive: false } );
        el.addEventListener( 'touchmove',  this._onTouchMove,  { passive: false } );
        el.addEventListener( 'touchend',   this._onTouchEnd   );

    }

    _handleMouseDown( e ) {

        if ( e.button !== 0 ) return;

        // Check if a marker was clicked first.
        const hit = this._hitTestMarker( e.offsetX, e.offsetY );

        if ( hit ) {
            this._selectLocation( hit.id );
            return;
        }

        // Begin pan.
        this._isPanning  = true;
        this._panStartX  = e.clientX;
        this._panStartY  = e.clientY;
        this._panOriginX = this._offsetX;
        this._panOriginY = this._offsetY;
        this._canvasEl.style.cursor = 'grabbing';

    }

    _handleMouseMove( e ) {

        if ( !this._isPanning ) return;

        this._offsetX = this._panOriginX + ( e.clientX - this._panStartX );
        this._offsetY = this._panOriginY + ( e.clientY - this._panStartY );
        this._renderMap();

    }

    _handleMouseUp() {

        if ( this._isPanning ) {
            this._isPanning = false;
            this._canvasEl.style.cursor = 'grab';
            this._saveViewState();
        }

    }

    _handleWheel( e ) {

        e.preventDefault();

        const delta     = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const prevZoom  = this._zoom;
        const nextZoom  = Math.max( ZOOM_MIN, Math.min( this._zoom + delta, ZOOM_MAX ) );

        // Zoom towards mouse cursor.
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        const scale  = nextZoom / prevZoom;

        this._offsetX = mouseX - scale * ( mouseX - this._offsetX );
        this._offsetY = mouseY - scale * ( mouseY - this._offsetY );
        this._zoom    = nextZoom;

        this._renderMap();

    }

    _handleDblClick( e ) {

        // Double-click centres map at clicked position.
        const mapX = ( e.offsetX - this._offsetX ) / this._zoom;
        const mapY = ( e.offsetY - this._offsetY ) / this._zoom;
        this._centreViewOn( mapX, mapY );
        this._renderMap();

    }

    // ── Touch events ──────────────────────────────────────────────

    _handleTouchStart( e ) {

        if ( e.touches.length === 1 ) {
            this._isPanning  = true;
            this._panStartX  = e.touches[ 0 ].clientX;
            this._panStartY  = e.touches[ 0 ].clientY;
            this._panOriginX = this._offsetX;
            this._panOriginY = this._offsetY;
            this._lastPinchDist = null;
        }
        else if ( e.touches.length === 2 ) {
            this._isPanning     = false;
            this._lastPinchDist = this._pinchDist( e );
        }

    }

    _handleTouchMove( e ) {

        e.preventDefault();

        if ( e.touches.length === 1 && this._isPanning ) {
            this._offsetX = this._panOriginX + ( e.touches[ 0 ].clientX - this._panStartX );
            this._offsetY = this._panOriginY + ( e.touches[ 0 ].clientY - this._panStartY );
            this._renderMap();
        }
        else if ( e.touches.length === 2 && this._lastPinchDist !== null ) {
            const dist  = this._pinchDist( e );
            const scale = dist / this._lastPinchDist;
            this._zoom  = Math.max( ZOOM_MIN, Math.min( this._zoom * scale, ZOOM_MAX ) );
            this._lastPinchDist = dist;
            this._renderMap();
        }

    }

    _handleTouchEnd() {
        this._isPanning     = false;
        this._lastPinchDist = null;
        this._saveViewState();
    }

    _pinchDist( e ) {
        const dx = e.touches[ 0 ].clientX - e.touches[ 1 ].clientX;
        const dy = e.touches[ 0 ].clientY - e.touches[ 1 ].clientY;
        return Math.sqrt( dx * dx + dy * dy );
    }

    // ─────────────────────────────────────────────────────────────
    // Hit Testing
    // ─────────────────────────────────────────────────────────────

    _hitTestMarker( screenX, screenY ) {

        const mapX = ( screenX - this._offsetX ) / this._zoom;
        const mapY = ( screenY - this._offsetY ) / this._zoom;

        const locations = MapManager.getAllLocations();
        const hitRadius = 24 / this._zoom;

        for ( const loc of locations ) {
            if ( !this._activeFilters.has( loc.type ) ) continue;
            const dx = mapX - loc.x;
            const dy = mapY - loc.y;
            if ( dx * dx + dy * dy <= hitRadius * hitRadius ) return loc;
        }

        return null;

    }

    // ─────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────

    _centreViewOn( mapX, mapY ) {

        if ( !this._canvasEl ) return;

        const W = this._canvasEl.width;
        const H = this._canvasEl.height;

        this._offsetX = W / 2 - mapX * this._zoom;
        this._offsetY = H / 2 - mapY * this._zoom;

    }

    _adjustZoom( delta ) {

        const prev = this._zoom;
        this._zoom  = Math.max( ZOOM_MIN, Math.min( this._zoom + delta, ZOOM_MAX ) );

        // Keep centre of canvas fixed.
        if ( this._canvasEl ) {
            const W     = this._canvasEl.width;
            const H     = this._canvasEl.height;
            const scale = this._zoom / prev;
            this._offsetX = W / 2 - scale * ( W / 2 - this._offsetX );
            this._offsetY = H / 2 - scale * ( H / 2 - this._offsetY );
        }

        this._renderMap();

    }

    _resetView() {

        this._zoom    = 1;
        this._offsetX = 0;
        this._offsetY = 0;
        this._renderMap();

    }

    _saveViewState() {

        if ( !this._activeCaseId ) return;

        if ( !this._canvasEl ) return;

        const W    = this._canvasEl.width;
        const H    = this._canvasEl.height;
        const cx   = ( W / 2 - this._offsetX ) / this._zoom;
        const cy   = ( H / 2 - this._offsetY ) / this._zoom;

        MapManager.saveViewState( this._zoom, { x: cx, y: cy }, this._selectedId );

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default CityMap;
