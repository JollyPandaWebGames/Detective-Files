/**
 * CCTVViewer
 *
 * Purpose:
 *   Surveillance footage review system. Detectives inspect recordings,
 *   bookmark key moments, write notes, zoom in on details, step frame-
 *   by-frame, and capture frames directly into the Evidence Database.
 *
 * Layout:
 *   Desktop  — left camera list | center player+timeline | right info+bookmarks
 *   Tablet   — collapsible sidebars
 *   Phone    — stacked navigation: list → player → bookmarks
 *
 * Data:
 *   Cameras loaded per case by CctvManager (data/cases/{id}/cctv/).
 *   All mutable state (bookmarks, notes, position, zoom) persists via
 *   StorageManager through CctvManager.
 *
 * Events consumed:
 *   case:selected       — load cameras for the new case
 *   cctv:loaded         — render camera list
 *   cctv:focus-request  — select camera + seek (from mail attachment)
 *   evidence:opened     — (no-op here; kept for future cross-highlight)
 *
 * Events emitted:
 *   cctv:opened           — app opened
 *   cctv:bookmark-added   — via CctvManager
 *   cctv:note-updated     — via CctvManager
 *   cctv:evidence-created — captured frame registered in Evidence Database
 *
 * Rules:
 *   Never access localStorage directly.
 *   Never call other applications directly — use EventBus.
 *   All evidence creation goes through EvidenceManager.registerItem().
 */

import BaseApp         from '../../core/BaseApp.js';
import EventBus        from '../../core/EventBus.js';
import CctvManager     from '../../managers/CctvManager.js';
import EvidenceManager from '../../managers/EvidenceManager.js';

const PLAYBACK_SPEEDS = [ 0.25, 0.5, 1, 2, 4 ];
const ZOOM_LEVELS     = [ 100, 150, 200, 300 ];
const NOTES_DELAY_MS  = 800;
const SKIP_SECONDS    = 10;

class CCTVViewer extends BaseApp {

    constructor( config ) {
        super( config );

        /** @type {string|null} */
        this._activeCaseId  = null;

        /** @type {string|null} */
        this._activeCameraId = null;

        /** @type {number} Current playback speed index */
        this._speedIndex = 2; // 1x default

        /** @type {number} Current zoom level */
        this._zoom = 100;

        /** @type {number} Pan offset X (when zoomed) */
        this._panX = 0;

        /** @type {number} Pan offset Y (when zoomed) */
        this._panY = 0;

        /** @type {boolean} Whether synthetic playback is running */
        this._playing = false;

        /** @type {number} Synthetic playback position in seconds */
        this._position = 0;

        /** @type {number|null} requestAnimationFrame id */
        this._rafId = null;

        /** @type {number|null} Last timestamp for RAF */
        this._lastRafTs = null;

        /** @type {number|null} Notes autosave timer */
        this._notesTimer = null;

        // Panning state.
        this._isPanning  = false;
        this._panStartX  = 0;
        this._panStartY  = 0;
        this._panOriginX = 0;
        this._panOriginY = 0;

        // Bound EventBus handlers.
        this._onCaseSelected   = ( { case: c } ) => this._handleCaseSelected( c );
        this._onCctvLoaded     = ()               => this._renderCameraList();
        this._onFocusRequest   = ( p )            => this._handleFocusRequest( p );

        // Bound RAF handler.
        this._onRaf = ( ts ) => this._tick( ts );

        // DOM refs (populated in create()).
        this._cameraListEl  = null;
        this._playerWrapEl  = null;
        this._playerScreenEl = null;
        this._timelineEl    = null;
        this._timelineHeadEl = null;
        this._infoEl        = null;
        this._bookmarkListEl = null;
        this._notesEl       = null;
        this._currentTimeEl = null;
        this._durationEl    = null;
        this._playBtnEl     = null;
        this._speedBtnEl    = null;
        this._zoomSelectEl  = null;

        // Bound pan handlers (stored for removal).
        this._onPanMove = ( e ) => this._handlePanMove( e );
        this._onPanEnd  = ()    => this._handlePanEnd();

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {

        contentEl.classList.add( 'cctv' );
        this._buildLayout( contentEl );

    }

    open() {

        EventBus.on( 'case:selected',      this._onCaseSelected );
        EventBus.on( 'cctv:loaded',        this._onCctvLoaded   );
        EventBus.on( 'cctv:focus-request', this._onFocusRequest );

        EventBus.emit( 'cctv:opened', {} );

        if ( this._activeCaseId ) {
            this._renderCameraList();
        }
        else {
            this._renderNoCaseMessage();
        }

    }

    close() {

        this._stopPlayback();
        this._savePosition();

        EventBus.off( 'case:selected',      this._onCaseSelected );
        EventBus.off( 'cctv:loaded',        this._onCctvLoaded   );
        EventBus.off( 'cctv:focus-request', this._onFocusRequest );

        document.removeEventListener( 'mousemove', this._onPanMove );
        document.removeEventListener( 'mouseup',   this._onPanEnd  );

        clearTimeout( this._notesTimer );

    }

    minimize() { this._stopPlayback(); }
    restore()  {}

    destroy() {
        this._stopPlayback();
        clearTimeout( this._notesTimer );
        document.removeEventListener( 'mousemove', this._onPanMove );
        document.removeEventListener( 'mouseup',   this._onPanEnd  );
        this._cameraListEl   = null;
        this._playerWrapEl   = null;
        this._playerScreenEl = null;
        this._timelineEl     = null;
        this._timelineHeadEl = null;
        this._infoEl         = null;
        this._bookmarkListEl = null;
        this._notesEl        = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    _buildLayout( contentEl ) {

        // ── Left sidebar — camera list ────────────────────────────
        const leftSidebar = document.createElement( 'div' );
        leftSidebar.className = 'cctv__left';

        const listHeader = document.createElement( 'div' );
        listHeader.className   = 'cctv__panel-header';
        listHeader.textContent = '📹 Cameras';

        this._cameraListEl = document.createElement( 'div' );
        this._cameraListEl.className = 'cctv__camera-list';

        leftSidebar.appendChild( listHeader );
        leftSidebar.appendChild( this._cameraListEl );

        // ── Center — player + timeline ────────────────────────────
        const center = document.createElement( 'div' );
        center.className = 'cctv__center';

        // Screen.
        this._playerWrapEl = document.createElement( 'div' );
        this._playerWrapEl.className = 'cctv__player-wrap';

        this._playerScreenEl = document.createElement( 'div' );
        this._playerScreenEl.className = 'cctv__player-screen';
        this._playerScreenEl.setAttribute( 'aria-label', 'Video player' );
        this._playerScreenEl.innerHTML = `
            <div class="cctv__no-signal">
                <div class="cctv__no-signal-text">NO SIGNAL</div>
                <div class="cctv__no-signal-sub">Select a camera to begin review</div>
            </div>
        `;

        this._playerWrapEl.appendChild( this._playerScreenEl );

        // Controls bar.
        const controls = this._buildControls();

        // Timeline.
        this._timelineEl = document.createElement( 'div' );
        this._timelineEl.className = 'cctv__timeline';
        this._timelineEl.setAttribute( 'role', 'slider' );
        this._timelineEl.setAttribute( 'aria-label', 'Playback timeline' );

        this._timelineHeadEl = document.createElement( 'div' );
        this._timelineHeadEl.className = 'cctv__timeline-head';

        const timelineTrack = document.createElement( 'div' );
        timelineTrack.className = 'cctv__timeline-track';
        timelineTrack.appendChild( this._timelineHeadEl );

        this._timelineEl.appendChild( timelineTrack );
        this._bindTimeline( this._timelineEl );

        center.appendChild( this._playerWrapEl );
        center.appendChild( controls );
        center.appendChild( this._timelineEl );

        // ── Right sidebar — info, bookmarks, notes ────────────────
        const rightSidebar = document.createElement( 'div' );
        rightSidebar.className = 'cctv__right';

        this._infoEl = document.createElement( 'div' );
        this._infoEl.className = 'cctv__info';
        this._infoEl.innerHTML = `<div class="cctv__empty-hint">Select a camera</div>`;

        const bookmarkHeader = document.createElement( 'div' );
        bookmarkHeader.className   = 'cctv__panel-header';
        bookmarkHeader.textContent = '🔖 Bookmarks';

        const addBmBtn = document.createElement( 'button' );
        addBmBtn.className   = 'cctv__add-bookmark-btn';
        addBmBtn.textContent = '+ Add';
        addBmBtn.setAttribute( 'type', 'button' );
        addBmBtn.addEventListener( 'click', () => this._addBookmarkAtCurrent() );
        bookmarkHeader.appendChild( addBmBtn );

        this._bookmarkListEl = document.createElement( 'div' );
        this._bookmarkListEl.className = 'cctv__bookmark-list';

        const notesHeader = document.createElement( 'div' );
        notesHeader.className   = 'cctv__panel-header';
        notesHeader.textContent = '📝 Notes';

        this._notesEl = document.createElement( 'textarea' );
        this._notesEl.className   = 'cctv__notes';
        this._notesEl.placeholder = 'Camera investigation notes...';
        this._notesEl.disabled    = true;
        this._notesEl.addEventListener( 'input', () => this._scheduleNotesSave() );

        rightSidebar.appendChild( this._infoEl );
        rightSidebar.appendChild( bookmarkHeader );
        rightSidebar.appendChild( this._bookmarkListEl );
        rightSidebar.appendChild( notesHeader );
        rightSidebar.appendChild( this._notesEl );

        // ── Bind player screen pan ────────────────────────────────
        this._playerScreenEl.addEventListener( 'mousedown', ( e ) => this._handlePanStart( e ) );

        // ── Assemble ──────────────────────────────────────────────
        contentEl.appendChild( leftSidebar );
        contentEl.appendChild( center );
        contentEl.appendChild( rightSidebar );

    }

    // ─────────────────────────────────────────────────────────────
    // Controls Bar
    // ─────────────────────────────────────────────────────────────

    _buildControls() {

        const bar = document.createElement( 'div' );
        bar.className = 'cctv__controls';

        // Rewind 10s.
        const rewBtn = this._makeCtrlBtn( '⏪', 'Back 10s', () => this._skip( -SKIP_SECONDS ) );

        // Prev frame.
        const prevFrBtn = this._makeCtrlBtn( '◀', 'Previous frame', () => this._stepFrame( -1 ) );

        // Play/pause.
        this._playBtnEl = this._makeCtrlBtn( '▶', 'Play', () => this._togglePlayback() );
        this._playBtnEl.classList.add( 'cctv__ctrl-play' );

        // Next frame.
        const nextFrBtn = this._makeCtrlBtn( '▶', 'Next frame', () => this._stepFrame( 1 ) );
        nextFrBtn.querySelector?.( 'span' );

        // Forward 10s.
        const fwdBtn = this._makeCtrlBtn( '⏩', 'Forward 10s', () => this._skip( SKIP_SECONDS ) );

        // Timecode.
        const timecode = document.createElement( 'div' );
        timecode.className = 'cctv__timecode';
        this._currentTimeEl = document.createElement( 'span' );
        this._currentTimeEl.textContent = '00:00';
        const sep = document.createElement( 'span' );
        sep.textContent = ' / ';
        sep.className = 'cctv__timecode-sep';
        this._durationEl = document.createElement( 'span' );
        this._durationEl.textContent = '00:00';
        timecode.appendChild( this._currentTimeEl );
        timecode.appendChild( sep );
        timecode.appendChild( this._durationEl );

        // Speed.
        this._speedBtnEl = document.createElement( 'button' );
        this._speedBtnEl.className   = 'cctv__ctrl-speed';
        this._speedBtnEl.textContent = '1×';
        this._speedBtnEl.setAttribute( 'type', 'button' );
        this._speedBtnEl.setAttribute( 'title', 'Cycle playback speed' );
        this._speedBtnEl.addEventListener( 'click', () => this._cycleSpeed() );

        // Zoom.
        this._zoomSelectEl = document.createElement( 'select' );
        this._zoomSelectEl.className = 'cctv__ctrl-zoom';
        this._zoomSelectEl.setAttribute( 'aria-label', 'Zoom level' );
        ZOOM_LEVELS.forEach( z => {
            const opt = document.createElement( 'option' );
            opt.value = String( z );
            opt.textContent = `${ z }%`;
            this._zoomSelectEl.appendChild( opt );
        } );
        this._zoomSelectEl.addEventListener( 'change', () => {
            this._setZoom( Number( this._zoomSelectEl.value ) );
        } );

        // Capture evidence.
        const captureBtn = document.createElement( 'button' );
        captureBtn.className   = 'cctv__ctrl-capture';
        captureBtn.textContent = '📷 Capture';
        captureBtn.setAttribute( 'type', 'button' );
        captureBtn.setAttribute( 'title', 'Create evidence from current frame' );
        captureBtn.addEventListener( 'click', () => this._captureFrame() );

        bar.appendChild( rewBtn );
        bar.appendChild( prevFrBtn );
        bar.appendChild( this._playBtnEl );
        bar.appendChild( nextFrBtn );
        bar.appendChild( fwdBtn );
        bar.appendChild( timecode );
        bar.appendChild( this._speedBtnEl );
        bar.appendChild( this._zoomSelectEl );
        bar.appendChild( captureBtn );

        return bar;

    }

    _makeCtrlBtn( label, title, onClick ) {

        const btn = document.createElement( 'button' );
        btn.className   = 'cctv__ctrl-btn';
        btn.textContent = label;
        btn.setAttribute( 'type', 'button' );
        btn.setAttribute( 'title', title );
        btn.addEventListener( 'click', onClick );
        return btn;

    }

    // ─────────────────────────────────────────────────────────────
    // Case / Camera Selection
    // ─────────────────────────────────────────────────────────────

    _handleCaseSelected( c ) {

        this._stopPlayback();
        this._savePosition();

        this._activeCaseId   = c.id;
        this._activeCameraId = null;
        this._position       = 0;

        this._renderNoCameraSelected();
        this._renderCameraList();
        this._updateTimeline();

        CctvManager.loadForCase( c.id );

    }

    _renderCameraList() {

        if ( !this._cameraListEl ) return;

        const cameras = CctvManager.getAll();
        this._cameraListEl.innerHTML = '';

        if ( cameras.length === 0 ) {
            this._cameraListEl.innerHTML = `<div class="cctv__empty-hint">No cameras for this case.</div>`;
            return;
        }

        cameras.forEach( cam => {
            const item = document.createElement( 'div' );
            item.className   = 'cctv__camera-item';
            item.dataset.camId = cam.id;
            item.setAttribute( 'tabindex', '0' );
            item.setAttribute( 'role', 'button' );

            const unavailableClass = cam.available ? '' : 'cctv__camera-item--unavailable';
            if ( !cam.available ) item.classList.add( 'cctv__camera-item--unavailable' );

            const bookmarkCount = CctvManager.getBookmarks( cam.id ).length;

            item.innerHTML = `
                <div class="cctv__camera-thumb">${ cam.available ? '📹' : '❌' }</div>
                <div class="cctv__camera-info">
                    <div class="cctv__camera-name">${ this._escape( cam.name ) }</div>
                    <div class="cctv__camera-meta">${ this._formatTime( cam.duration ) } ${ bookmarkCount > 0 ? `• 🔖 ${ bookmarkCount }` : '' }</div>
                    ${ !cam.available ? '<div class="cctv__camera-unavail">UNAVAILABLE</div>' : '' }
                </div>
            `;

            item.addEventListener( 'click', () => {
                if ( cam.available ) this._selectCamera( cam.id );
            } );
            item.addEventListener( 'keydown', ( e ) => {
                if ( ( e.key === 'Enter' || e.key === ' ' ) && cam.available ) {
                    e.preventDefault();
                    this._selectCamera( cam.id );
                }
            } );

            this._cameraListEl.appendChild( item );
        } );

    }

    _selectCamera( cameraId ) {

        this._stopPlayback();
        this._savePosition();

        const cam = CctvManager.getById( cameraId );
        if ( !cam ) return;

        this._activeCameraId = cameraId;
        this._position       = CctvManager.getLastPosition( cameraId );
        this._zoom           = CctvManager.getZoom( cameraId );
        this._panX           = 0;
        this._panY           = 0;
        this._speedIndex     = 2; // Reset to 1×.

        // Update camera list selection.
        this._cameraListEl.querySelectorAll( '.cctv__camera-item' ).forEach( el => {
            el.classList.toggle( 'cctv__camera-item--selected', el.dataset.camId === cameraId );
        } );

        // Show the player with recording info.
        this._renderPlayerForCamera( cam );
        this._renderInfo( cam );
        this._renderBookmarks();
        this._updateTimeline();
        this._updateZoomUI();
        this._updateSpeedUI();
        this._updateTimecode();

        // Enable notes.
        if ( this._notesEl ) {
            this._notesEl.disabled = false;
            this._notesEl.value    = CctvManager.getNotes( cameraId );
        }

        if ( this._zoomSelectEl ) {
            this._zoomSelectEl.value = String( this._zoom );
        }

    }

    _renderPlayerForCamera( cam ) {

        if ( !this._playerScreenEl ) return;

        if ( this._zoom !== 100 ) {
            this._applyZoom();
        }

        this._playerScreenEl.innerHTML = `
            <div class="cctv__mock-footage">
                <div class="cctv__mock-overlay">
                    <span class="cctv__mock-cam-name">${ this._escape( cam.name ) }</span>
                    <span class="cctv__mock-date">${ this._escape( cam.date ) }</span>
                    <span class="cctv__mock-rec">● REC</span>
                </div>
                <div class="cctv__mock-scanline"></div>
                <div class="cctv__mock-content">
                    <div class="cctv__mock-scene">${ this._escape( cam.location ) }</div>
                    <div class="cctv__mock-res">${ cam.resolution }</div>
                </div>
            </div>
        `;

        this._durationEl && ( this._durationEl.textContent = this._formatTime( cam.duration ) );
        this._applyZoom();

    }

    _renderNoCameraSelected() {

        if ( !this._playerScreenEl ) return;

        this._playerScreenEl.innerHTML = `
            <div class="cctv__no-signal">
                <div class="cctv__no-signal-text">NO SIGNAL</div>
                <div class="cctv__no-signal-sub">Select a camera to begin review</div>
            </div>
        `;

        if ( this._notesEl ) {
            this._notesEl.disabled = true;
            this._notesEl.value    = '';
        }

        if ( this._infoEl ) {
            this._infoEl.innerHTML = `<div class="cctv__empty-hint">Select a camera</div>`;
        }

        if ( this._bookmarkListEl ) this._bookmarkListEl.innerHTML = '';

    }

    _renderNoCaseMessage() {

        if ( !this._cameraListEl ) return;
        this._cameraListEl.innerHTML = `<div class="cctv__empty-hint">Select a case in Case Management.</div>`;

    }

    // ─────────────────────────────────────────────────────────────
    // Camera Info Panel
    // ─────────────────────────────────────────────────────────────

    _renderInfo( cam ) {

        if ( !this._infoEl ) return;

        this._infoEl.innerHTML = `
            <div class="cctv__info-field"><span class="cctv__info-label">Camera</span><span>${ this._escape( cam.name ) }</span></div>
            <div class="cctv__info-field"><span class="cctv__info-label">Location</span><span>${ this._escape( cam.location ) }</span></div>
            <div class="cctv__info-field"><span class="cctv__info-label">Date</span><span>${ this._escape( cam.date ) }</span></div>
            <div class="cctv__info-field"><span class="cctv__info-label">Duration</span><span>${ this._formatTime( cam.duration ) }</span></div>
            <div class="cctv__info-field"><span class="cctv__info-label">Resolution</span><span>${ this._escape( cam.resolution ) }</span></div>
        `;

        if ( cam.importantTimestamps?.length ) {
            const heading = document.createElement( 'div' );
            heading.className   = 'cctv__info-heading';
            heading.textContent = 'Key Timestamps';
            this._infoEl.appendChild( heading );

            cam.importantTimestamps.forEach( ts => {
                const row = document.createElement( 'div' );
                row.className = 'cctv__ts-row';
                row.innerHTML = `
                    <span class="cctv__ts-time">${ this._formatTime( ts.time ) }</span>
                    <span class="cctv__ts-label">${ this._escape( ts.label ) }</span>
                `;
                row.setAttribute( 'tabindex', '0' );
                row.setAttribute( 'title', 'Jump to this timestamp' );
                row.addEventListener( 'click', () => this._seekTo( ts.time ) );
                this._infoEl.appendChild( row );
            } );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Bookmarks
    // ─────────────────────────────────────────────────────────────

    _renderBookmarks() {

        if ( !this._bookmarkListEl || !this._activeCameraId ) return;

        const bookmarks = CctvManager.getBookmarks( this._activeCameraId );
        this._bookmarkListEl.innerHTML = '';

        if ( bookmarks.length === 0 ) {
            this._bookmarkListEl.innerHTML = `<div class="cctv__empty-hint">No bookmarks yet.</div>`;
            return;
        }

        bookmarks.forEach( bm => {
            const row = document.createElement( 'div' );
            row.className = 'cctv__bookmark-row';

            const timeBtn = document.createElement( 'button' );
            timeBtn.className   = 'cctv__bookmark-time';
            timeBtn.textContent = this._formatTime( bm.time );
            timeBtn.setAttribute( 'type', 'button' );
            timeBtn.addEventListener( 'click', () => this._seekTo( bm.time ) );

            const titleSpan = document.createElement( 'span' );
            titleSpan.className   = 'cctv__bookmark-title';
            titleSpan.textContent = bm.title;
            titleSpan.title       = bm.description || bm.title;

            const delBtn = document.createElement( 'button' );
            delBtn.className   = 'cctv__bookmark-del';
            delBtn.textContent = '×';
            delBtn.setAttribute( 'type', 'button' );
            delBtn.setAttribute( 'aria-label', 'Delete bookmark' );
            delBtn.addEventListener( 'click', () => {
                CctvManager.removeBookmark( this._activeCameraId, bm.time );
                this._renderBookmarks();
                this._updateTimeline();
            } );

            row.appendChild( timeBtn );
            row.appendChild( titleSpan );
            row.appendChild( delBtn );
            this._bookmarkListEl.appendChild( row );
        } );

    }

    _addBookmarkAtCurrent() {

        if ( !this._activeCameraId ) return;

        const time  = Math.floor( this._position );
        const title = `Bookmark at ${ this._formatTime( time ) }`;

        CctvManager.addBookmark( this._activeCameraId, time, title );
        this._renderBookmarks();
        this._updateTimeline();

    }

    // ─────────────────────────────────────────────────────────────
    // Synthetic Playback Engine
    // ─────────────────────────────────────────────────────────────

    _togglePlayback() {

        if ( !this._activeCameraId ) return;

        if ( this._playing ) {
            this._stopPlayback();
        }
        else {
            this._startPlayback();
        }

    }

    _startPlayback() {

        const cam = CctvManager.getById( this._activeCameraId );
        if ( !cam ) return;

        // If at end, restart.
        if ( this._position >= cam.duration ) {
            this._position = 0;
        }

        this._playing    = true;
        this._lastRafTs  = null;

        if ( this._playBtnEl ) this._playBtnEl.textContent = '⏸';

        this._rafId = requestAnimationFrame( this._onRaf );

    }

    _stopPlayback() {

        this._playing = false;

        if ( this._rafId !== null ) {
            cancelAnimationFrame( this._rafId );
            this._rafId = null;
        }

        if ( this._playBtnEl ) this._playBtnEl.textContent = '▶';

        this._lastRafTs = null;

    }

    _tick( ts ) {

        if ( !this._playing ) return;

        if ( this._lastRafTs !== null ) {

            const deltaSec = ( ts - this._lastRafTs ) / 1000;
            const speed    = PLAYBACK_SPEEDS[ this._speedIndex ];
            const cam      = CctvManager.getById( this._activeCameraId );

            if ( cam ) {
                this._position = Math.min( this._position + deltaSec * speed, cam.duration );

                if ( this._position >= cam.duration ) {
                    this._position = cam.duration;
                    this._stopPlayback();
                }

                this._updateTimecode();
                this._updateTimeline();
            }

        }

        this._lastRafTs = ts;

        if ( this._playing ) {
            this._rafId = requestAnimationFrame( this._onRaf );
        }

    }

    _skip( delta ) {

        if ( !this._activeCameraId ) return;

        const cam = CctvManager.getById( this._activeCameraId );
        if ( !cam ) return;

        this._position = Math.max( 0, Math.min( this._position + delta, cam.duration ) );
        this._updateTimecode();
        this._updateTimeline();

    }

    _stepFrame( direction ) {

        // At 25fps one frame ≈ 0.04 seconds.
        this._skip( direction * 0.04 );

    }

    _seekTo( time ) {

        this._position = Math.max( 0, time );
        this._updateTimecode();
        this._updateTimeline();

    }

    _cycleSpeed() {

        this._speedIndex = ( this._speedIndex + 1 ) % PLAYBACK_SPEEDS.length;
        this._updateSpeedUI();

    }

    _updateSpeedUI() {

        if ( this._speedBtnEl ) {
            const speed = PLAYBACK_SPEEDS[ this._speedIndex ];
            this._speedBtnEl.textContent = `${ speed }×`;
        }

    }

    _updateTimecode() {

        if ( this._currentTimeEl ) {
            this._currentTimeEl.textContent = this._formatTime( this._position );
        }

    }

    _savePosition() {

        if ( this._activeCameraId ) {
            CctvManager.savePosition( this._activeCameraId, this._position );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Timeline
    // ─────────────────────────────────────────────────────────────

    _updateTimeline() {

        if ( !this._timelineEl || !this._timelineHeadEl ) return;

        const cam = this._activeCameraId
            ? CctvManager.getById( this._activeCameraId )
            : null;

        const duration = cam?.duration || 1;
        const pct      = ( this._position / duration ) * 100;
        this._timelineHeadEl.style.left = `${ pct }%`;

        // Render bookmark markers.
        this._timelineEl.querySelectorAll( '.cctv__timeline-bookmark' ).forEach( el => el.remove() );

        if ( cam && this._activeCameraId ) {
            const track = this._timelineEl.querySelector( '.cctv__timeline-track' );
            CctvManager.getBookmarks( this._activeCameraId ).forEach( bm => {
                const marker = document.createElement( 'div' );
                marker.className = 'cctv__timeline-bookmark';
                marker.style.left = `${ ( bm.time / duration ) * 100 }%`;
                marker.title      = `${ this._formatTime( bm.time ) } — ${ bm.title }`;
                marker.addEventListener( 'click', ( e ) => {
                    e.stopPropagation();
                    this._seekTo( bm.time );
                } );
                track.appendChild( marker );
            } );
        }

    }

    _bindTimeline( timelineEl ) {

        const seek = ( e ) => {
            const cam = this._activeCameraId ? CctvManager.getById( this._activeCameraId ) : null;
            if ( !cam ) return;

            const rect = timelineEl.getBoundingClientRect();
            const pct  = Math.max( 0, Math.min( ( e.clientX - rect.left ) / rect.width, 1 ) );
            this._seekTo( pct * cam.duration );
        };

        let dragging = false;

        timelineEl.addEventListener( 'mousedown', ( e ) => {
            dragging = true;
            seek( e );
        } );

        document.addEventListener( 'mousemove', ( e ) => { if ( dragging ) seek( e ); } );
        document.addEventListener( 'mouseup',   ()    => { dragging = false; } );

    }

    // ─────────────────────────────────────────────────────────────
    // Zoom and Pan
    // ─────────────────────────────────────────────────────────────

    _setZoom( level ) {

        this._zoom = level;
        this._applyZoom();

        if ( this._activeCameraId ) {
            CctvManager.saveZoom( this._activeCameraId, level );
        }

    }

    _applyZoom() {

        if ( !this._playerScreenEl ) return;

        if ( this._zoom === 100 ) {
            this._playerScreenEl.style.transform = 'none';
            this._playerScreenEl.style.cursor    = 'default';
        }
        else {
            const factor = this._zoom / 100;
            this._playerScreenEl.style.transform       = `scale(${ factor }) translate(${ this._panX }px, ${ this._panY }px)`;
            this._playerScreenEl.style.transformOrigin = '50% 50%';
            this._playerScreenEl.style.cursor          = 'grab';
        }

    }

    _updateZoomUI() {

        if ( this._zoomSelectEl ) {
            this._zoomSelectEl.value = String( this._zoom );
        }

    }

    _handlePanStart( e ) {

        if ( this._zoom === 100 ) return;
        e.preventDefault();

        this._isPanning  = true;
        this._panStartX  = e.clientX;
        this._panStartY  = e.clientY;
        this._panOriginX = this._panX;
        this._panOriginY = this._panY;

        this._playerScreenEl.style.cursor = 'grabbing';

        document.addEventListener( 'mousemove', this._onPanMove );
        document.addEventListener( 'mouseup',   this._onPanEnd  );

    }

    _handlePanMove( e ) {

        if ( !this._isPanning ) return;

        const dx = ( e.clientX - this._panStartX ) * ( 100 / this._zoom );
        const dy = ( e.clientY - this._panStartY ) * ( 100 / this._zoom );

        this._panX = this._panOriginX + dx;
        this._panY = this._panOriginY + dy;
        this._applyZoom();

    }

    _handlePanEnd() {

        this._isPanning = false;

        if ( this._playerScreenEl ) {
            this._playerScreenEl.style.cursor = this._zoom > 100 ? 'grab' : 'default';
        }

        document.removeEventListener( 'mousemove', this._onPanMove );
        document.removeEventListener( 'mouseup',   this._onPanEnd  );

    }

    // ─────────────────────────────────────────────────────────────
    // Evidence Capture
    // ─────────────────────────────────────────────────────────────

    _captureFrame() {

        const cam = this._activeCameraId ? CctvManager.getById( this._activeCameraId ) : null;
        if ( !cam ) return;

        const activeCaseId = this._activeCaseId;
        if ( !activeCaseId ) return;

        const timestamp = Math.floor( this._position );
        const evidenceId = `ev-cctv-${ cam.id }-${ timestamp }-${ Date.now() }`;

        const item = {
            id:          evidenceId,
            caseId:      activeCaseId,
            title:       `CCTV Capture — ${ cam.name } @ ${ this._formatTime( timestamp ) }`,
            category:    'Digital Files',
            type:        'image',
            status:      'Collected',
            location:    cam.location,
            collectedBy: 'Detective (Captured)',
            date:        new Date().toISOString().slice( 0, 10 ),
            description: `Frame captured from ${ cam.name } at ${ this._formatTime( timestamp ) } during case ${ activeCaseId }. Source camera: ${ cam.id }.`,
            thumbnail:   null,
            preview:     null,
            tags:        [ 'cctv', 'capture', cam.id ],
            related:     [],
            sourceAttachmentId: null,
            chainOfCustody: [
                {
                    stage: 'Collected',
                    by:    'CCTV Viewer (Detective)',
                    date:  new Date().toISOString().slice( 0, 16 ).replace( 'T', ' ' ),
                },
            ],
        };

        EvidenceManager.registerItem( item );

        EventBus.emit( 'cctv:evidence-created', { evidenceId, cameraId: cam.id, timestamp } );

        this._showCaptureFlash();

        console.info( `CCTVViewer: Evidence created — ${ evidenceId }` );

    }

    _showCaptureFlash() {

        if ( !this._playerScreenEl ) return;

        const flash = document.createElement( 'div' );
        flash.className = 'cctv__capture-flash';
        this._playerScreenEl.appendChild( flash );

        setTimeout( () => flash.remove(), 400 );

    }

    // ─────────────────────────────────────────────────────────────
    // Notes Autosave
    // ─────────────────────────────────────────────────────────────

    _scheduleNotesSave() {

        clearTimeout( this._notesTimer );
        this._notesTimer = setTimeout( () => {
            if ( this._activeCameraId && this._notesEl ) {
                CctvManager.saveNotes( this._activeCameraId, this._notesEl.value );
            }
        }, NOTES_DELAY_MS );

    }

    // ─────────────────────────────────────────────────────────────
    // Mail Integration — focus-request
    // ─────────────────────────────────────────────────────────────

    _handleFocusRequest( { cameraId, timestamp } ) {

        // Load cameras for the active case first if needed.
        if ( this._activeCaseId && !CctvManager.getById( cameraId ) ) {
            CctvManager.loadForCase( this._activeCaseId ).then( () => {
                this._renderCameraList();
                this._doFocus( cameraId, timestamp );
            } );
        }
        else {
            this._doFocus( cameraId, timestamp );
        }

    }

    _doFocus( cameraId, timestamp ) {

        const cam = CctvManager.getById( cameraId );
        if ( !cam ) return;

        this._selectCamera( cameraId );
        this._seekTo( timestamp );

        // Flash timeline.
        if ( this._timelineHeadEl ) {
            this._timelineHeadEl.classList.add( 'cctv__timeline-head--flash' );
            setTimeout( () => this._timelineHeadEl?.classList.remove( 'cctv__timeline-head--flash' ), 1200 );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    _formatTime( seconds ) {

        const s = Math.floor( seconds );
        const m = Math.floor( s / 60 );
        const r = s % 60;
        return `${ String( m ).padStart( 2, '0' ) }:${ String( r ).padStart( 2, '0' ) }`;

    }

    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default CCTVViewer;
