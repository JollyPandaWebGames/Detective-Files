/**
 * Window
 *
 * Purpose:
 *   A reusable class representing a single application window in CID OS.
 *   Owns its DOM structure, drag behaviour, and visual state.
 *
 * Responsibilities:
 *   - Build window chrome using the TitleBar component
 *   - Handle viewport-clamped dragging (title bar only)
 *   - Expose the content area for application UI injection (Mission 04+)
 *   - Maintain minimized / active visual state
 *   - Report user actions to WindowManager via callbacks
 *
 * Rules:
 *   Window never knows which application it belongs to.
 *   Window never communicates with WindowManager directly.
 *   All callbacks are provided by WindowManager at construction time.
 *
 * Usage:
 *   const win = new Window(config, callbacks);
 *   layer.appendChild(win.element);
 *   win.setPosition(x, y);
 *   win.setSize(width, height);
 *
 * @param {Object} config
 * @param {string} config.id      - Unique window id.
 * @param {string} config.title   - Title bar text.
 * @param {string} [config.icon]  - Icon filename (placeholder for now).
 * @param {number} config.width   - Initial width.
 * @param {number} config.height  - Initial height.
 *
 * @param {Object}   callbacks
 * @param {Function} callbacks.onFocus    - Called on mousedown anywhere on the window.
 * @param {Function} callbacks.onClose    - Called when the close button is clicked.
 * @param {Function} callbacks.onMinimize - Called when the minimize button is clicked.
 */

import TitleBar from './TitleBar.js';

// Minimum visible pixels that must remain inside the viewport during drag.
const MIN_VISIBLE = 80;

class Window {

    constructor( config, callbacks ) {

        /**
         * Unique window identifier (matches application id).
         * @type {string}
         */
        this.id = config.id;

        /**
         * Window configuration snapshot.
         * @type {Object}
         */
        this._config = config;

        /**
         * Callbacks provided by WindowManager.
         * @type {Object}
         */
        this._callbacks = callbacks;

        /**
         * Root window element.
         * @type {HTMLElement|null}
         */
        this.element = null;

        /**
         * The content area — applications inject their UI here in Mission 04.
         * @type {HTMLElement|null}
         */
        this.contentEl = null;

        /**
         * The status bar element.
         * @type {HTMLElement|null}
         */
        this.statusbarEl = null;

        /**
         * The TitleBar component instance.
         * @type {TitleBar|null}
         */
        this._titleBar = null;

        /**
         * Whether the window is currently minimized.
         * @type {boolean}
         */
        this.isMinimized = false;

        /**
         * Whether the window is active (top of stack).
         * @type {boolean}
         */
        this.isActive = false;

        // ── Drag state ────────────────────────────────────────────
        this._isDragging  = false;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;

        // Bound drag handler references — stored for cleanup.
        this._onMouseMove = this._handleDragMove.bind( this );
        this._onMouseUp   = this._handleDragEnd.bind( this );

        this._build();

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Move the window to an absolute position.
     *
     * @param {number} x - Left offset in pixels.
     * @param {number} y - Top offset in pixels.
     * @returns {void}
     */
    setPosition( x, y ) {

        this.element.style.left = `${ x }px`;
        this.element.style.top  = `${ y }px`;

    }

    /**
     * Resize the window.
     *
     * @param {number} width
     * @param {number} height
     * @returns {void}
     */
    setSize( width, height ) {

        this.element.style.width  = `${ width }px`;
        this.element.style.height = `${ height }px`;

    }

    /**
     * Raise this window to the active (focused) state.
     * Updates the title bar and border to the active visual.
     *
     * @returns {void}
     */
    activate() {

        this.isActive = true;
        this.element.classList.add( 'cid-window--active' );
        this.element.setAttribute( 'aria-selected', 'true' );

    }

    /**
     * Lower this window to the inactive state.
     *
     * @returns {void}
     */
    deactivate() {

        this.isActive = false;
        this.element.classList.remove( 'cid-window--active' );
        this.element.setAttribute( 'aria-selected', 'false' );

    }

    /**
     * Hide the window without destroying it (minimized state).
     *
     * @returns {void}
     */
    hide() {

        this.isMinimized = true;
        this.element.classList.add( 'cid-window--minimized' );

    }

    /**
     * Restore the window from minimized state.
     *
     * @returns {void}
     */
    show() {

        this.isMinimized = false;
        this.element.classList.remove( 'cid-window--minimized' );

    }

    /**
     * Set the CSS z-index for stacking order.
     *
     * @param {number} z
     * @returns {void}
     */
    setZIndex( z ) {

        this.element.style.zIndex = String( z );

    }

    /**
     * Update the title bar text.
     *
     * @param {string} title
     * @returns {void}
     */
    setTitle( title ) {

        if ( this._titleBar ) {
            this._titleBar.setTitle( title );
        }

        this.element.setAttribute( 'aria-label', title );

    }

    /**
     * Update the status bar text.
     *
     * @param {string} text
     * @returns {void}
     */
    setStatus( text ) {

        if ( this.statusbarEl ) {
            this.statusbarEl.textContent = text;
        }

    }

    /**
     * Remove the window from the DOM and clean up all event listeners.
     * Called by WindowManager.close().
     *
     * @returns {void}
     */
    destroy() {

        // Remove drag listeners if a drag was in progress.
        document.removeEventListener( 'mousemove', this._onMouseMove );
        document.removeEventListener( 'mouseup',   this._onMouseUp   );

        if ( this.element && this.element.parentNode ) {
            this.element.parentNode.removeChild( this.element );
        }

        // Null all references to help garbage collection.
        this.element     = null;
        this.contentEl   = null;
        this.statusbarEl = null;
        this._titleBar   = null;

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the full window DOM structure.
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

        // ── Title bar (via TitleBar component) ───────────────────
        this._titleBar = new TitleBar(
            {
                title: this._config.title,
                icon:  this._config.icon,
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
        this.contentEl.appendChild( this._buildPlaceholder() );

        // ── Status bar ───────────────────────────────────────────
        this.statusbarEl = document.createElement( 'div' );
        this.statusbarEl.className   = 'cid-window__statusbar';
        this.statusbarEl.textContent = 'Ready';

        // ── Assemble ─────────────────────────────────────────────
        this.element.appendChild( this._titleBar.element );
        this.element.appendChild( this.contentEl );
        this.element.appendChild( this.statusbarEl );

        // ── Focus on any click ────────────────────────────────────
        // mousedown rather than click so focus happens before button events.
        this.element.addEventListener( 'mousedown', () => {
            this._callbacks.onFocus( this.id );
        } );

    }

    /**
     * Build the placeholder content shown before an application injects its UI.
     * Removed and replaced in Mission 04 when BaseApp.create() runs.
     *
     * @returns {HTMLElement}
     */
    _buildPlaceholder() {

        const wrap = document.createElement( 'div' );
        wrap.className = 'cid-window__placeholder';

        const title = document.createElement( 'div' );
        title.className   = 'cid-window__placeholder-title';
        title.textContent = this._config.title.toUpperCase();

        const sub = document.createElement( 'div' );
        sub.className   = 'cid-window__placeholder-sub';
        sub.textContent = 'Application not loaded';

        wrap.appendChild( title );
        wrap.appendChild( sub );

        return wrap;

    }

    // ─────────────────────────────────────────────────────────────
    // Dragging
    // ─────────────────────────────────────────────────────────────

    /**
     * Begin dragging the window.
     * Only called from TitleBar's mousedown callback.
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
     * Move the window in response to mouse movement during a drag.
     * Clamps position so at least MIN_VISIBLE pixels remain on-screen.
     *
     * @param {MouseEvent} e
     * @returns {void}
     */
    _handleDragMove( e ) {

        if ( !this._isDragging ) return;

        let x = e.clientX - this._dragOffsetX;
        let y = e.clientY - this._dragOffsetY;

        const winW = this.element.offsetWidth;
        const winH = this.element.offsetHeight;

        // Clamp horizontal: prevent pushing window too far left or right.
        x = Math.max( MIN_VISIBLE - winW, Math.min( x, window.innerWidth - MIN_VISIBLE ) );

        // Clamp vertical: prevent title bar from going above viewport or too far down.
        y = Math.max( 0, Math.min( y, window.innerHeight - MIN_VISIBLE ) );

        this.setPosition( x, y );

    }

    /**
     * End the drag operation and clean up listeners.
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
