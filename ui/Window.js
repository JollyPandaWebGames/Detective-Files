/**
 * Window
 *
 * Purpose:
 *   A reusable window component for CID OS.
 *   Adapts its layout and behaviour based on the current responsive mode:
 *     - Desktop / Tablet: floating, draggable, cascade-positioned
 *     - Phone: fullscreen, no drag, ignores position config
 *
 * Responsibilities:
 *   - Build window chrome (TitleBar, content area, status bar)
 *   - Handle viewport-clamped dragging on desktop/tablet
 *   - Apply phone fullscreen layout automatically
 *   - React to responsive mode changes at runtime
 *   - Expose contentEl for application UI injection (Mission 04+)
 *   - Report user actions to WindowManager via callbacks
 *
 * Rules:
 *   Window never knows which application it belongs to.
 *   Window never imports WindowManager — all actions go via callbacks.
 *   Applications never know which responsive mode is active.
 *
 * @param {Object} config
 *   @param {string} config.id       - Unique window identifier.
 *   @param {string} config.title    - Title bar text.
 *   @param {string} [config.emoji]  - Icon emoji for the title bar.
 *   @param {string} [config.icon]   - PNG icon path (future use).
 *   @param {number} [config.width]  - Preferred width (ignored in phone mode).
 *   @param {number} [config.height] - Preferred height (ignored in phone mode).
 *
 * @param {Object} callbacks
 *   @param {Function} callbacks.onFocus    - Called on mousedown.
 *   @param {Function} callbacks.onClose    - Called when close is clicked.
 *   @param {Function} callbacks.onMinimize - Called when minimize is clicked.
 */

import TitleBar       from './TitleBar.js';
import ResponsiveMode from '../utils/ResponsiveMode.js';
import EventBus       from '../core/EventBus.js';

// How many pixels must remain visible after viewport clamping.
const MIN_VISIBLE = 80;

class Window {

    constructor( config, callbacks ) {

        /** Unique window id. @type {string} */
        this.id = config.id;

        /** @type {Object} */
        this._config = config;

        /** @type {Object} */
        this._callbacks = callbacks;

        /** Root window element. @type {HTMLElement|null} */
        this.element = null;

        /** Content area — applications inject UI here. @type {HTMLElement|null} */
        this.contentEl = null;

        /** Status bar element. @type {HTMLElement|null} */
        this.statusbarEl = null;

        /** TitleBar component instance. @type {TitleBar|null} */
        this._titleBar = null;

        /** Whether this window is hidden (minimized). @type {boolean} */
        this.isMinimized = false;

        /** Whether this window is the active (focused) window. @type {boolean} */
        this.isActive = false;

        // ── Drag state ────────────────────────────────────────────
        this._isDragging  = false;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;

        // Bound handler references — stored for cleanup.
        this._onMouseMove    = this._handleDragMove.bind( this );
        this._onMouseUp      = this._handleDragEnd.bind( this );
        this._onModeChange   = this._handleModeChange.bind( this );
        this._onMouseDown    = () => this._callbacks.onFocus( this.id );

        this._build();

        // Listen for responsive mode changes to adapt layout at runtime.
        EventBus.on( 'responsive:changed', this._onModeChange );

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Move the window to an absolute desktop position.
     * No-op in phone mode (window is fullscreen).
     *
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    setPosition( x, y ) {

        if ( ResponsiveMode.isPhone() ) return;

        this.element.style.left = `${ x }px`;
        this.element.style.top  = `${ y }px`;

    }

    /**
     * Resize the window.
     * No-op in phone mode (CSS handles fullscreen sizing).
     *
     * @param {number} width
     * @param {number} height
     * @returns {void}
     */
    setSize( width, height ) {

        if ( ResponsiveMode.isPhone() ) return;

        this.element.style.width  = `${ width }px`;
        this.element.style.height = `${ height }px`;

    }

    /** Mark this window as active (focused). */
    activate() {

        this.isActive = true;
        this.element.classList.add( 'cid-window--active' );
        this.element.setAttribute( 'aria-selected', 'true' );

    }

    /** Mark this window as inactive. */
    deactivate() {

        this.isActive = false;
        this.element.classList.remove( 'cid-window--active' );
        this.element.setAttribute( 'aria-selected', 'false' );

    }

    /** Hide the window (minimized state — DOM stays alive). */
    hide() {

        this.isMinimized = true;
        this.element.classList.add( 'cid-window--minimized' );

    }

    /** Restore the window from minimized state. */
    show() {

        this.isMinimized = false;
        this.element.classList.remove( 'cid-window--minimized' );

    }

    /**
     * Set the CSS z-index for stacking order.
     * @param {number} z
     */
    setZIndex( z ) {

        this.element.style.zIndex = String( z );

    }

    /**
     * Update the title bar text.
     * @param {string} title
     */
    setTitle( title ) {

        if ( this._titleBar ) this._titleBar.setTitle( title );
        this.element.setAttribute( 'aria-label', title );

    }

    /**
     * Update the status bar text.
     * @param {string} text
     */
    setStatus( text ) {

        if ( this.statusbarEl ) this.statusbarEl.textContent = text;

    }

    /**
     * Remove the window from the DOM and clean up all references.
     * Called exclusively by WindowManager.close().
     */
    destroy() {

        // Stop any active drag.
        document.removeEventListener( 'mousemove', this._onMouseMove );
        document.removeEventListener( 'mouseup',   this._onMouseUp   );

        // Stop listening for mode changes.
        EventBus.off( 'responsive:changed', this._onModeChange );

        // Remove the focus listener from the window element itself.
        if ( this.element ) {
            this.element.removeEventListener( 'mousedown', this._onMouseDown );
        }

        if ( this.element && this.element.parentNode ) {
            this.element.parentNode.removeChild( this.element );
        }

        this.element     = null;
        this.contentEl   = null;
        this.statusbarEl = null;
        this._titleBar   = null;
        this._callbacks  = null;

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the full window DOM and apply the current responsive mode.
     *
     * @returns {void}
     */
    _build() {

        // ── Root element ─────────────────────────────────────────
        this.element = document.createElement( 'div' );
        this.element.className = 'cid-window';
        this.element.setAttribute( 'role', 'dialog' );
        this.element.setAttribute( 'aria-label', this._config.title );
        this.element.setAttribute( 'aria-modal', 'false' );
        this.element.setAttribute( 'tabindex', '-1' );
        this.element.setAttribute( 'data-window-id', this.id );

        // ── Title bar ────────────────────────────────────────────
        this._titleBar = new TitleBar(
            {
                title:     this._config.title,
                emoji:     this._config.emoji,
                icon:      this._config.icon,
                draggable: ResponsiveMode.isDraggable(),
            },
            {
                onDragStart: ( e ) => this._handleDragStart( e ),
                onMinimize:  ()    => this._callbacks.onMinimize( this.id ),
                onClose:     ()    => this._callbacks.onClose( this.id ),
            }
        );

        // ── Content area ─────────────────────────────────────────
        this.contentEl = document.createElement( 'div' );
        this.contentEl.className = 'cid-window__content';
        // Content is populated by BaseApp.create(contentEl) after window creation.

        // ── Status bar ───────────────────────────────────────────
        this.statusbarEl = document.createElement( 'div' );
        this.statusbarEl.className   = 'cid-window__statusbar';
        this.statusbarEl.textContent = 'Ready';

        // ── Assemble ─────────────────────────────────────────────
        this.element.appendChild( this._titleBar.element );
        this.element.appendChild( this.contentEl );
        this.element.appendChild( this.statusbarEl );

        // ── Focus on any mousedown ────────────────────────────────
        this.element.addEventListener( 'mousedown', this._onMouseDown );

        // ── Apply initial responsive mode ─────────────────────────
        this._applyMode( ResponsiveMode.get() );

    }

    /**
     * Build the placeholder content.
     * Replaced by real application UI in Mission 04.
     *
     * @returns {HTMLElement}
     */
    _buildPlaceholder() {

        const wrap = document.createElement( 'div' );
        wrap.className = 'cid-window__placeholder';

        const emojiEl = document.createElement( 'div' );
        emojiEl.className   = 'cid-window__placeholder-emoji';
        emojiEl.textContent = this._config.emoji ?? '🖥️';

        const titleEl = document.createElement( 'div' );
        titleEl.className   = 'cid-window__placeholder-title';
        titleEl.textContent = this._config.title;

        const subEl = document.createElement( 'div' );
        subEl.className   = 'cid-window__placeholder-sub';
        subEl.textContent = 'This application is under development.';

        wrap.appendChild( emojiEl );
        wrap.appendChild( titleEl );
        wrap.appendChild( subEl );

        return wrap;

    }

    // ─────────────────────────────────────────────────────────────
    // Responsive Mode
    // ─────────────────────────────────────────────────────────────

    /**
     * Apply a responsive mode to this window's CSS and behaviour.
     *
     * @param {string} mode - 'desktop' | 'tablet' | 'phone'
     * @returns {void}
     */
    _applyMode( mode ) {

        // Remove all existing mode classes first.
        this.element.classList.remove(
            'cid-window--mode-desktop',
            'cid-window--mode-tablet',
            'cid-window--mode-phone'
        );

        this.element.classList.add( `cid-window--mode-${ mode }` );

        // Toggle drag availability in TitleBar.
        const draggable = mode !== 'phone';
        if ( this._titleBar ) {
            this._titleBar.setDraggable( draggable );
        }

    }

    /**
     * Handle a responsive mode change emitted by ResponsiveMode.
     *
     * @param {{ mode: string }} payload
     * @returns {void}
     */
    _handleModeChange( { mode } ) {

        this._applyMode( mode );

    }

    // ─────────────────────────────────────────────────────────────
    // Dragging
    // ─────────────────────────────────────────────────────────────

    /**
     * Begin dragging. Only reachable when TitleBar's draggable flag is true.
     *
     * @param {MouseEvent} e
     * @returns {void}
     */
    _handleDragStart( e ) {

        this._isDragging  = true;
        this._dragOffsetX = e.clientX - this.element.offsetLeft;
        this._dragOffsetY = e.clientY - this.element.offsetTop;

        this.element.classList.add( 'cid-window--dragging' );
        document.body.classList.add( 'cid-os-dragging' );

        document.addEventListener( 'mousemove', this._onMouseMove );
        document.addEventListener( 'mouseup',   this._onMouseUp   );

    }

    /**
     * Move the window while dragging, clamped to viewport.
     *
     * @param {MouseEvent} e
     * @returns {void}
     */
    _handleDragMove( e ) {

        if ( !this._isDragging ) return;

        let x = e.clientX - this._dragOffsetX;
        let y = e.clientY - this._dragOffsetY;

        const winW = this.element.offsetWidth;

        // Keep at least MIN_VISIBLE pixels on every edge.
        x = Math.max( MIN_VISIBLE - winW, Math.min( x, window.innerWidth  - MIN_VISIBLE ) );
        y = Math.max( 0,                  Math.min( y, window.innerHeight  - MIN_VISIBLE ) );

        // Write directly — bypass setPosition() which no-ops in phone mode.
        this.element.style.left = `${ x }px`;
        this.element.style.top  = `${ y }px`;

    }

    /**
     * End the drag operation.
     *
     * @returns {void}
     */
    _handleDragEnd() {

        if ( !this._isDragging ) return;

        this._isDragging = false;

        this.element.classList.remove( 'cid-window--dragging' );
        document.body.classList.remove( 'cid-os-dragging' );

        document.removeEventListener( 'mousemove', this._onMouseMove );
        document.removeEventListener( 'mouseup',   this._onMouseUp   );

    }

}

export default Window;
