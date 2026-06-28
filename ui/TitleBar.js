/**
 * TitleBar
 *
 * Purpose:
 *   A reusable title bar component for CID OS windows.
 *   Encapsulates icon, title text, and control buttons as a
 *   standalone, independently testable building block.
 *
 * Responsibilities:
 *   - Render the icon placeholder, title text, and window controls
 *   - Attach drag events (title-bar-only drag initiation)
 *   - Expose minimize and close button callbacks
 *   - Update title text dynamically
 *
 * Rules:
 *   TitleBar never knows which application it belongs to.
 *   TitleBar never communicates with WindowManager directly.
 *   All actions are communicated upward through callbacks.
 *
 * Usage:
 *   const bar = new TitleBar({ title, icon }, { onDragStart, onMinimize, onClose });
 *   windowRoot.appendChild(bar.element);
 */

class TitleBar {

    /**
     * @param {Object}   config               - Display configuration.
     * @param {string}   config.title         - Title bar text.
     * @param {string}   [config.icon]        - Icon filename (placeholder until real icons exist).
     *
     * @param {Object}   callbacks
     * @param {Function} callbacks.onDragStart - Called with (MouseEvent) on title bar mousedown.
     * @param {Function} callbacks.onMinimize  - Called when minimize button is clicked.
     * @param {Function} callbacks.onClose     - Called when close button is clicked.
     */
    constructor( config, callbacks ) {

        /**
         * @type {Object}
         */
        this._config = config;

        /**
         * @type {Object}
         */
        this._callbacks = callbacks;

        /**
         * The root title bar element.
         * @type {HTMLElement}
         */
        this.element = null;

        /**
         * The title text element (for dynamic updates).
         * @type {HTMLElement|null}
         */
        this._titleEl = null;

        this._build();

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Update the title text.
     *
     * @param {string} title
     * @returns {void}
     */
    setTitle( title ) {

        if ( this._titleEl ) {
            this._titleEl.textContent = title;
        }

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the title bar DOM.
     *
     * @returns {void}
     */
    _build() {

        this.element = document.createElement( 'div' );
        this.element.className = 'cid-window__titlebar';

        // ── Icon ─────────────────────────────────────────────────
        const icon = document.createElement( 'div' );
        icon.className = 'cid-window__titlebar-icon';
        icon.setAttribute( 'aria-hidden', 'true' );

        // ── Title ─────────────────────────────────────────────────
        this._titleEl = document.createElement( 'div' );
        this._titleEl.className   = 'cid-window__title';
        this._titleEl.textContent = this._config.title;

        // ── Controls ──────────────────────────────────────────────
        const controls = document.createElement( 'div' );
        controls.className = 'cid-window__controls';

        const minimizeBtn = this._buildButton( '_', 'minimize', 'Minimize' );
        const closeBtn    = this._buildButton( '×', 'close',    'Close'    );

        controls.appendChild( minimizeBtn );
        controls.appendChild( closeBtn );

        // ── Assemble ──────────────────────────────────────────────
        this.element.appendChild( icon );
        this.element.appendChild( this._titleEl );
        this.element.appendChild( controls );

        // ── Drag Initiation (title bar only) ──────────────────────
        this.element.addEventListener( 'mousedown', ( e ) => {

            // Ignore clicks on control buttons.
            if ( e.target.closest( '.cid-window__btn' ) ) return;

            e.preventDefault();
            this._callbacks.onDragStart( e );

        } );

    }

    /**
     * Build a single window control button.
     *
     * @param {string} symbol    - Character shown on the button.
     * @param {string} type      - 'minimize' | 'close'
     * @param {string} ariaLabel - Accessible label.
     * @returns {HTMLButtonElement}
     */
    _buildButton( symbol, type, ariaLabel ) {

        const btn = document.createElement( 'button' );
        btn.className   = `cid-window__btn cid-window__btn--${ type }`;
        btn.textContent = symbol;
        btn.setAttribute( 'aria-label', ariaLabel );
        btn.setAttribute( 'tabindex', '0' );

        btn.addEventListener( 'click', ( e ) => {

            e.stopPropagation();

            if ( type === 'close' ) {
                this._callbacks.onClose();
            }
            else if ( type === 'minimize' ) {
                this._callbacks.onMinimize();
            }

        } );

        return btn;

    }

}

export default TitleBar;
