/**
 * Settings
 *
 * Purpose:
 *   The first fully functional CID OS application.
 *   Lets the player view and change workstation preferences
 *   that are persisted to LocalStorage and applied immediately.
 *
 * Layout:
 *   Two-column on desktop/tablet: sidebar | content panel
 *   Single-column on phone: category selector + content panel
 *
 * Categories:
 *   General      — Language, Confirm close, Animations
 *   Appearance   — Theme, Wallpaper
 *   Accessibility — UI Scale, Larger title text, Reduce animations
 *   About        — Version info
 *
 * Rules:
 *   Never access localStorage directly — use SettingsManager.
 *   Never call WindowManager, DesktopManager, etc. directly.
 *   Communicate only through SettingsManager and EventBus.
 */

import BaseApp        from '../../core/BaseApp.js';
import EventBus       from '../../core/EventBus.js';
import SettingsManager from '../../managers/SettingsManager.js';

// Category definitions — order determines sidebar order.
const CATEGORIES = [
    { id: 'general',       label: 'General',       emoji: '⚙️'  },
    { id: 'appearance',    label: 'Appearance',     emoji: '🎨'  },
    { id: 'accessibility', label: 'Accessibility',  emoji: '♿'  },
    { id: 'about',         label: 'About',          emoji: 'ℹ️'  },
];

class Settings extends BaseApp {

    constructor( config ) {
        super( config );

        /**
         * Currently selected category id.
         * @type {string}
         */
        this._activeCategory = 'general';

        /**
         * Map of category id → content panel renderer.
         * @type {Map<string, Function>}
         */
        this._panels = new Map();

        /**
         * The right-panel content container.
         * @type {HTMLElement|null}
         */
        this._panelEl = null;

        /**
         * Sidebar nav element.
         * @type {HTMLElement|null}
         */
        this._sidebarEl = null;

        /**
         * Bound handler for settings:changed so we can remove it on destroy.
         * @type {Function}
         */
        this._onSettingsChanged = () => this._refreshActivePanel();

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {

        this._contentEl = contentEl;
        this._buildLayout( contentEl );
        this._selectCategory( this._activeCategory );

    }

    open() {
        // Re-render the active panel with fresh settings values
        // in case something changed while the window was closed.
        this._refreshActivePanel();
        EventBus.on( 'settings:changed', this._onSettingsChanged );
    }

    close() {
        EventBus.off( 'settings:changed', this._onSettingsChanged );
    }

    minimize() {}
    restore()  { this._refreshActivePanel(); }

    destroy() {
        EventBus.off( 'settings:changed', this._onSettingsChanged );
        this._panels.clear();
        this._panelEl   = null;
        this._sidebarEl = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the two-column layout and register panel renderers.
     *
     * @param {HTMLElement} contentEl
     * @returns {void}
     */
    _buildLayout( contentEl ) {

        contentEl.classList.add( 'settings' );

        // Sidebar.
        this._sidebarEl = document.createElement( 'nav' );
        this._sidebarEl.className = 'settings__sidebar';
        this._sidebarEl.setAttribute( 'aria-label', 'Settings categories' );

        CATEGORIES.forEach( cat => {
            const btn = document.createElement( 'button' );
            btn.className        = 'settings__nav-btn';
            btn.dataset.category = cat.id;
            btn.setAttribute( 'type', 'button' );
            btn.setAttribute( 'aria-label', cat.label );
            btn.innerHTML = `<span class="settings__nav-emoji">${ cat.emoji }</span>
                             <span class="settings__nav-label">${ cat.label }</span>`;

            btn.addEventListener( 'click', () => this._selectCategory( cat.id ) );
            this._sidebarEl.appendChild( btn );
        } );

        // Right panel.
        this._panelEl = document.createElement( 'main' );
        this._panelEl.className = 'settings__panel';
        this._panelEl.setAttribute( 'aria-live', 'polite' );

        contentEl.appendChild( this._sidebarEl );
        contentEl.appendChild( this._panelEl );

        // Register panel builder functions.
        this._panels.set( 'general',       () => this._buildGeneral()       );
        this._panels.set( 'appearance',    () => this._buildAppearance()    );
        this._panels.set( 'accessibility', () => this._buildAccessibility() );
        this._panels.set( 'about',         () => this._buildAbout()         );

    }

    /**
     * Activate a category — update sidebar state and render the panel.
     *
     * @param {string} categoryId
     * @returns {void}
     */
    _selectCategory( categoryId ) {

        this._activeCategory = categoryId;

        // Update sidebar button active states.
        this._sidebarEl.querySelectorAll( '.settings__nav-btn' ).forEach( btn => {
            const isActive = btn.dataset.category === categoryId;
            btn.classList.toggle( 'settings__nav-btn--active', isActive );
            btn.setAttribute( 'aria-current', isActive ? 'page' : 'false' );
        } );

        this._refreshActivePanel();

    }

    /**
     * Re-render the active panel (called when settings change externally too).
     *
     * @returns {void}
     */
    _refreshActivePanel() {

        if ( !this._panelEl ) return;

        const builder = this._panels.get( this._activeCategory );
        if ( !builder ) return;

        this._panelEl.innerHTML = '';
        this._panelEl.appendChild( builder() );

    }

    // ─────────────────────────────────────────────────────────────
    // Panel: General
    // ─────────────────────────────────────────────────────────────

    _buildGeneral() {

        const s = SettingsManager.getAll();
        const frag = document.createDocumentFragment();

        frag.appendChild( this._buildPanelHeader( '⚙️', 'General' ) );

        // Language.
        frag.appendChild( this._buildGroup( 'Language', [
            this._buildSelect( 'language', s.language, [
                { value: 'en', label: 'English' },
                { value: 'fa', label: 'فارسی (coming soon)', disabled: true },
            ] ),
        ] ) );

        // Confirm before closing.
        frag.appendChild( this._buildGroup( 'Window Behavior', [
            this._buildToggle( 'confirmClose', 'Confirm before closing windows', s.confirmClose ),
        ] ) );

        // Animations.
        frag.appendChild( this._buildGroup( 'Animations', [
            this._buildToggle( 'animations', 'Enable desktop animations', s.animations ),
        ] ) );

        // Tooltips.
        frag.appendChild( this._buildGroup( 'Guidance', [
            this._buildToggle( 'tooltipsEnabled', 'Show contextual tooltips', s.tooltipsEnabled ),
        ] ) );

        return frag;

    }

    // ─────────────────────────────────────────────────────────────
    // Panel: Appearance
    // ─────────────────────────────────────────────────────────────

    _buildAppearance() {

        const s    = SettingsManager.getAll();
        const wpOpts = SettingsManager.getWallpaperOptions();
        const frag = document.createDocumentFragment();

        frag.appendChild( this._buildPanelHeader( '🎨', 'Appearance' ) );

        // Theme.
        frag.appendChild( this._buildGroup( 'Theme', [
            this._buildSelect( 'theme', s.theme, [
                { value: 'cid-dark', label: 'CID Dark (default)' },
                { value: 'future',   label: 'Future themes (coming soon)', disabled: true },
            ] ),
        ] ) );

        // Wallpaper.
        frag.appendChild( this._buildGroup( 'Desktop Wallpaper', [
            this._buildRadioGroup(
                'wallpaper',
                s.wallpaper,
                wpOpts.map( o => ( { value: o.id, label: o.label } ) )
            ),
        ] ) );

        return frag;

    }

    // ─────────────────────────────────────────────────────────────
    // Panel: Accessibility
    // ─────────────────────────────────────────────────────────────

    _buildAccessibility() {

        const s    = SettingsManager.getAll();
        const frag = document.createDocumentFragment();

        frag.appendChild( this._buildPanelHeader( '♿', 'Accessibility' ) );

        // UI Scale.
        frag.appendChild( this._buildGroup( 'UI Scale', [
            this._buildRadioGroup( 'uiScale', s.uiScale, [
                { value: 90,  label: '90%'  },
                { value: 100, label: '100% (default)' },
                { value: 110, label: '110%' },
                { value: 125, label: '125%' },
            ] ),
        ] ) );

        // Text and motion.
        frag.appendChild( this._buildGroup( 'Text & Motion', [
            this._buildToggle( 'largerTitleText',  'Larger window title text', s.largerTitleText  ),
            this._buildToggle( 'reduceAnimations', 'Reduce animations',        s.reduceAnimations ),
        ] ) );

        return frag;

    }

    // ─────────────────────────────────────────────────────────────
    // Panel: About
    // ─────────────────────────────────────────────────────────────

    _buildAbout() {

        const frag = document.createDocumentFragment();
        frag.appendChild( this._buildPanelHeader( 'ℹ️', 'About' ) );

        const card = document.createElement( 'div' );
        card.className = 'settings__about';

        card.innerHTML = `
            <div class="settings__about-logo">🕵️</div>
            <div class="settings__about-name">Detective Files</div>
            <div class="settings__about-row">
                <span class="settings__about-key">CID OS Version</span>
                <span class="settings__about-val">1.0.0</span>
            </div>
            <div class="settings__about-row">
                <span class="settings__about-key">App Framework</span>
                <span class="settings__about-val">Mission 04</span>
            </div>
            <div class="settings__about-row">
                <span class="settings__about-key">Developer</span>
                <span class="settings__about-val">Jolly Panda Studio</span>
            </div>
            <div class="settings__about-row">
                <span class="settings__about-key">Copyright</span>
                <span class="settings__about-val">© 2025 Jolly Panda Studio</span>
            </div>
        `;

        frag.appendChild( card );

        // Reset button.
        const resetWrap = document.createElement( 'div' );
        resetWrap.className = 'settings__group';

        const resetBtn = document.createElement( 'button' );
        resetBtn.className   = 'settings__btn settings__btn--danger';
        resetBtn.textContent = 'Reset to Default Settings';
        resetBtn.setAttribute( 'type', 'button' );

        resetBtn.addEventListener( 'click', () => this._confirmReset() );
        resetWrap.appendChild( resetBtn );
        frag.appendChild( resetWrap );

        return frag;

    }

    // ─────────────────────────────────────────────────────────────
    // Reset
    // ─────────────────────────────────────────────────────────────

    /**
     * Show an inline confirmation before resetting.
     *
     * @returns {void}
     */
    _confirmReset() {

        // Replace the reset button with a confirmation prompt inline.
        const existing = this._panelEl.querySelector( '.settings__reset-confirm' );
        if ( existing ) {
            existing.remove();
            return;
        }

        const confirm = document.createElement( 'div' );
        confirm.className = 'settings__reset-confirm';
        confirm.innerHTML = `
            <span class="settings__reset-confirm-text">
                ⚠️ Reset all settings to factory defaults?
            </span>
        `;

        const yesBtn = document.createElement( 'button' );
        yesBtn.className   = 'settings__btn settings__btn--danger';
        yesBtn.textContent = 'Yes, Reset';
        yesBtn.setAttribute( 'type', 'button' );
        yesBtn.addEventListener( 'click', () => {
            SettingsManager.reset();
        } );

        const noBtn = document.createElement( 'button' );
        noBtn.className   = 'settings__btn';
        noBtn.textContent = 'Cancel';
        noBtn.setAttribute( 'type', 'button' );
        noBtn.addEventListener( 'click', () => confirm.remove() );

        confirm.appendChild( yesBtn );
        confirm.appendChild( noBtn );

        this._panelEl.appendChild( confirm );

    }

    // ─────────────────────────────────────────────────────────────
    // Control Builders
    // ─────────────────────────────────────────────────────────────

    /**
     * Build a panel header with emoji and title.
     *
     * @param {string} emoji
     * @param {string} title
     * @returns {HTMLElement}
     */
    _buildPanelHeader( emoji, title ) {

        const header = document.createElement( 'div' );
        header.className = 'settings__panel-header';
        header.innerHTML = `
            <span class="settings__panel-header-emoji">${ emoji }</span>
            <span class="settings__panel-header-title">${ title }</span>
        `;
        return header;

    }

    /**
     * Build a labelled settings group containing one or more controls.
     *
     * @param {string}        label    - Group heading.
     * @param {HTMLElement[]} controls - Control elements.
     * @returns {HTMLElement}
     */
    _buildGroup( label, controls ) {

        const group = document.createElement( 'div' );
        group.className = 'settings__group';

        const heading = document.createElement( 'div' );
        heading.className   = 'settings__group-label';
        heading.textContent = label;
        group.appendChild( heading );

        controls.forEach( c => group.appendChild( c ) );

        return group;

    }

    /**
     * Build an on/off toggle control.
     *
     * @param {string}  key     - Settings key.
     * @param {string}  label   - Human-readable label.
     * @param {boolean} checked - Current value.
     * @returns {HTMLElement}
     */
    _buildToggle( key, label, checked ) {

        const row = document.createElement( 'label' );
        row.className = 'settings__toggle-row';

        const checkbox = document.createElement( 'input' );
        checkbox.type    = 'checkbox';
        checkbox.checked = checked;
        checkbox.className = 'settings__checkbox';

        checkbox.addEventListener( 'change', () => {
            SettingsManager.set( key, checkbox.checked );
        } );

        const track = document.createElement( 'span' );
        track.className = 'settings__toggle-track';
        track.setAttribute( 'aria-hidden', 'true' );

        const labelEl = document.createElement( 'span' );
        labelEl.className   = 'settings__toggle-label';
        labelEl.textContent = label;

        row.appendChild( checkbox );
        row.appendChild( track );
        row.appendChild( labelEl );

        return row;

    }

    /**
     * Build a select (dropdown) control.
     *
     * @param {string}    key     - Settings key.
     * @param {*}         current - Current value.
     * @param {{ value, label, disabled? }[]} options
     * @returns {HTMLElement}
     */
    _buildSelect( key, current, options ) {

        const wrap = document.createElement( 'div' );
        wrap.className = 'settings__select-wrap';

        const select = document.createElement( 'select' );
        select.className = 'settings__select';

        options.forEach( opt => {
            const option = document.createElement( 'option' );
            option.value    = opt.value;
            option.text     = opt.label;
            option.disabled = opt.disabled ?? false;
            option.selected = opt.value === current;
            select.appendChild( option );
        } );

        select.addEventListener( 'change', () => {
            // Parse numbers back from string if original value was number.
            const raw = select.value;
            const val = isNaN( Number( raw ) ) ? raw : Number( raw );
            SettingsManager.set( key, val );
        } );

        wrap.appendChild( select );
        return wrap;

    }

    /**
     * Build a radio-button group.
     *
     * @param {string}    key     - Settings key.
     * @param {*}         current - Current value.
     * @param {{ value, label }[]} options
     * @returns {HTMLElement}
     */
    _buildRadioGroup( key, current, options ) {

        const group = document.createElement( 'div' );
        group.className = 'settings__radio-group';
        group.setAttribute( 'role', 'radiogroup' );

        options.forEach( opt => {

            const label = document.createElement( 'label' );
            label.className = 'settings__radio-row';

            const input = document.createElement( 'input' );
            input.type    = 'radio';
            input.name    = key;
            // eslint-disable-next-line eqeqeq
            input.checked = opt.value == current;
            input.value   = opt.value;
            input.className = 'settings__radio';

            input.addEventListener( 'change', () => {
                if ( input.checked ) {
                    // Cast to number if the option value is numeric.
                    const raw = opt.value;
                    const val = typeof raw === 'number' ? raw :
                                ( isNaN( Number( raw ) ) ? raw : Number( raw ) );
                    SettingsManager.set( key, val );
                }
            } );

            const labelText = document.createElement( 'span' );
            labelText.className   = 'settings__radio-label';
            labelText.textContent = opt.label;

            label.appendChild( input );
            label.appendChild( labelText );
            group.appendChild( label );

        } );

        return group;

    }

}

export default Settings;
