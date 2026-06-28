/**
 * TitleBar
 *
 * Purpose:
 *   A reusable title bar component for CID OS windows.
 *   Shows the application icon (emoji or PNG), title text, and
 *   window control buttons (minimize, close).
 *
 * Responsibilities:
 *   - Render icon (emoji span or <img> with onerror fallback)
 *   - Render title text
 *   - Render minimize and close buttons with hover/pressed states
 *   - Initiate drag on mousedown (desktop/tablet only — caller decides)
 *   - Update title and icon dynamically
 *
 * Rules:
 *   TitleBar never knows which application it belongs to.
 *   TitleBar never communicates with WindowManager directly.
 *   Whether dragging is enabled is decided by the caller (Window).
 *
 * Usage:
 *   const bar = new TitleBar({ title, emoji, icon }, { onDragStart, onMinimize, onClose });
 *   windowRoot.appendChild(bar.element);
 */

const DEFAULT_ICON_EMOJI = '🖥️';

class TitleBar {

    /**
     * @param {Object}   config
     * @param {string}   config.title         - Title bar text.
     * @param {string}   [config.emoji]       - Emoji shown as the icon.
     * @param {string}   [config.icon]        - PNG path (future use).
     * @param {boolean}  [config.draggable]   - Whether to fire onDragStart. Default true.
     *
     * @param {Object}   callbacks
     * @param {Function} callbacks.onDragStart - Called with (MouseEvent) on title bar mousedown.
     * @param {Function} callbacks.onMinimize  - Called when minimize button is clicked.
     * @param {Function} callbacks.onClose     - Called when close button is clicked.
     */
    constructor( config, callbacks ) {

        this._config    = config;
        this._callbacks = callbacks;

        /** Root title bar element. @type {HTMLElement} */
        this.element = null;

        /** Title text element for dynamic updates. @type {HTMLElement|null} */
        this._titleEl = null;

        /** Icon container for dynamic updates. @type {HTMLElement|null} */
        this._iconEl = null;

        this._build();

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Update the title bar text.
     *
     * @param {string} title
     * @returns {void}
     */
    setTitle( title ) {

        if ( this._titleEl ) {
            this._titleEl.textContent = title;
        }

    }

    /**
     * Enable or disable drag initiation.
     * Called by Window when responsive mode changes.
     *
     * @param {boolean} enabled
     * @returns {void}
     */
    setDraggable( enabled ) {

        this._config = { ...this._config, draggable: enabled };

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the title bar DOM structure.
     *
     * @returns {void}
     */
    _build() {

        this.element = document.createElement( 'div' );
        this.element.className = 'cid-window__titlebar';

        // ── Icon ─────────────────────────────────────────────────
        this._iconEl = this._buildIcon();

        // ── Title ─────────────────────────────────────────────────
        this._titleEl = document.createElement( 'div' );
        this._titleEl.className   = 'cid-window__title';
        this._titleEl.textContent = this._config.title;

        // ── Controls ──────────────────────────────────────────────
        const controls = document.createElement( 'div' );
        controls.className = 'cid-window__controls';
        controls.appendChild( this._buildButton( '–', 'minimize', 'Minimize' ) );
        controls.appendChild( this._buildButton( '×', 'close',    'Close'    ) );

        // ── Assemble ──────────────────────────────────────────────
        this.element.appendChild( this._iconEl );
        this.element.appendChild( this._titleEl );
        this.element.appendChild( controls );

        // ── Drag initiation ───────────────────────────────────────
        this.element.addEventListener( 'mousedown', ( e ) => {

            if ( e.target.closest( '.cid-window__btn' ) ) return;

            // Only initiate drag if the caller says it's draggable.
            if ( this._config.draggable === false ) return;

            e.preventDefault();
            this._callbacks.onDragStart( e );

        } );

    }

    /**
     * Build the icon element.
     * Priority: emoji field → default emoji.
     * PNG support stubbed for when real assets exist.
     *
     * @returns {HTMLElement}
     */
    _buildIcon() {

        const wrapper = document.createElement( 'div' );
        wrapper.className = 'cid-window__titlebar-icon';
        wrapper.setAttribute( 'aria-hidden', 'true' );

        const emoji = this._config.emoji ?? DEFAULT_ICON_EMOJI;

        const span = document.createElement( 'span' );
        span.className   = 'cid-window__titlebar-icon-emoji';
        span.textContent = emoji;

        wrapper.appendChild( span );

        return wrapper;

    }

    /**
     * Build a single control button.
     *
     * @param {string} symbol    - Character displayed.
     * @param {string} type      - 'minimize' | 'close'
     * @param {string} ariaLabel
     * @returns {HTMLButtonElement}
     */
    _buildButton( symbol, type, ariaLabel ) {

        const btn = document.createElement( 'button' );
        btn.className   = `cid-window__btn cid-window__btn--${ type }`;
        btn.textContent = symbol;
        btn.setAttribute( 'aria-label', ariaLabel );
        btn.setAttribute( 'tabindex', '0' );
        btn.setAttribute( 'type', 'button' );

        btn.addEventListener( 'click', ( e ) => {

            e.stopPropagation();

            if ( type === 'close' )    this._callbacks.onClose();
            if ( type === 'minimize' ) this._callbacks.onMinimize();

        } );

        return btn;

    }

}

export default TitleBar;
