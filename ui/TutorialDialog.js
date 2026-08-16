/**
 * TutorialDialog
 *
 * Purpose:
 *   Reusable dialogue-box UI for guided tutorials. Renders a speaker
 *   portrait, name, message text, and a Continue/Skip control.
 *   Also renders the lightweight "instruction banner" shown while
 *   the player performs a required action (no dialogue box, just a
 *   short floating instruction line — see TutorialManager).
 *
 * Responsibilities:
 *   - Mount/unmount its own DOM
 *   - Render one dialogue node at a time
 *   - Render one instruction banner at a time
 *   - Report Continue / Skip clicks back to its owner via callbacks
 *
 * Rules:
 *   TutorialDialog holds no tutorial state of its own — it is a pure
 *   view. TutorialManager decides what to show and when.
 *
 * Usage:
 *   TutorialDialog.showDialogue( { speakerName, portraitEmoji, text }, { onContinue, onSkip } );
 *   TutorialDialog.showInstruction( 'Open Case Management.' );
 *   TutorialDialog.hide();
 */

class TutorialDialogClass {

    constructor() {

        /** @type {HTMLElement|null} */
        this._element = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Render a single dialogue line with a Continue button (and an
     * optional Skip button).
     *
     * @param {{speakerName:string, portraitEmoji:string, text:string}} content
     * @param {{onContinue:Function, onSkip?:Function}}                 handlers
     * @returns {void}
     */
    showDialogue( content, handlers ) {

        this._mount();

        this._element.className = 'tutorial-dialog';
        this._element.innerHTML = `
            <div class="tutorial-dialog__portrait" aria-hidden="true">${ content.portraitEmoji }</div>
            <div class="tutorial-dialog__body">
                <div class="tutorial-dialog__speaker">${ content.speakerName }</div>
                <div class="tutorial-dialog__text">${ this._escape( content.text ) }</div>
                <div class="tutorial-dialog__actions">
                    ${ handlers.onSkip ? '<button type="button" class="tutorial-dialog__skip">Skip Tutorial</button>' : '' }
                    <button type="button" class="tutorial-dialog__continue">Continue ▸</button>
                </div>
            </div>
        `;

        const continueBtn = this._element.querySelector( '.tutorial-dialog__continue' );
        continueBtn.addEventListener( 'click', handlers.onContinue );
        continueBtn.focus();

        if ( handlers.onSkip ) {
            this._element.querySelector( '.tutorial-dialog__skip' )
                .addEventListener( 'click', handlers.onSkip );
        }

    }

    /**
     * Render a short floating instruction banner (used while the
     * dialogue box is temporarily closed and the player must perform
     * the required action — see EPIC Part 3/6).
     *
     * @param {string} text
     * @returns {void}
     */
    showInstruction( text ) {

        this._mount();

        this._element.className = 'tutorial-dialog tutorial-dialog--instruction';
        this._element.innerHTML = `
            <div class="tutorial-dialog__instruction-icon" aria-hidden="true">👉</div>
            <div class="tutorial-dialog__instruction-text">${ this._escape( text ) }</div>
        `;

    }

    /**
     * Remove the dialog/instruction UI from the DOM.
     *
     * @returns {void}
     */
    hide() {

        if ( this._element && this._element.parentNode ) {
            this._element.parentNode.removeChild( this._element );
        }
        this._element = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * Ensure the root element exists and is mounted.
     *
     * @returns {void}
     */
    _mount() {

        if ( this._element ) return;

        this._element = document.createElement( 'div' );
        document.body.appendChild( this._element );

    }

    /**
     * Escape user-facing text before inserting as HTML.
     *
     * @param {string} str
     * @returns {string}
     */
    _escape( str ) {

        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;

    }

}

const TutorialDialog = new TutorialDialogClass();
export default TutorialDialog;
