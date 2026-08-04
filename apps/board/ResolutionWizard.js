/**
 * ResolutionWizard
 *
 * Purpose:
 *   Mission 17 — Case Resolution Engine. The multi-step "Solve
 *   Investigation" workflow, launched from the Investigation Board.
 *   Renders as a full-screen overlay inside the board window rather than
 *   a new OS window — per spec, selecting "Solve Investigation" opens
 *   this wizard in place.
 *
 * Steps (spec order):
 *   1. Primary Suspect   4. Crime Location      7. Submit
 *   2. Motive             5. Timeline
 *   3. Weapon             6. Supporting Evidence
 *
 * Responsibilities:
 *   - Walk the player through all 7 steps, collecting a report draft
 *   - Pull candidate options from PeopleManager, EvidenceManager,
 *     MapManager, BoardManager — read-only, never mutates case data
 *   - Submit the draft to ResolutionManager and render the outcome
 *   - Show recommendations and allow returning to the investigation on
 *     an Incomplete/Incorrect result — nothing ever locks
 *
 * Rules:
 *   Never access localStorage directly — ResolutionManager owns persistence.
 *   Never call other applications directly — EventBus only.
 */

import PeopleManager                          from '../../managers/PeopleManager.js';
import EvidenceManager                        from '../../managers/EvidenceManager.js';
import MapManager                              from '../../managers/MapManager.js';
import BoardManager                            from '../../managers/BoardManager.js';
import ForensicsManager                        from '../../managers/ForensicsManager.js';
import ResolutionManager                       from '../../managers/ResolutionManager.js';
import { MOTIVE_OPTIONS, TIMELINE_OPTIONS }    from '../../core/resolution/ResolutionOptions.js';

const STEP_TITLES = [
    'Choose Primary Suspect', 'Choose Motive', 'Choose Weapon',
    'Choose Crime Location', 'Choose Timeline', 'Supporting Evidence',
    'Review & Submit',
];

class ResolutionWizard {

    /** @param {HTMLElement} mountEl - The board app's window content element. */
    constructor( mountEl ) {
        this._mountEl = mountEl;
        this._el       = null;
        this._step      = 1;
        this._draft     = { suspect: null, motive: null, weapon: null, location: null, timeline: null, evidence: [], theoryIds: [] };
    }

    /** @returns {void} */
    open() {

        if ( !ResolutionManager.hasSolution() ) {
            alert( 'This case has no resolution defined yet.' );
            return;
        }

        this._step  = 1;
        this._draft = { suspect: null, motive: null, weapon: null, location: null, timeline: null, evidence: [], theoryIds: [] };

        this._el = document.createElement( 'div' );
        this._el.className = 'resowiz';
        this._mountEl.appendChild( this._el );

        this._render();

    }

    /** @returns {void} */
    close() {
        this._el?.remove();
        this._el = null;
    }

    // ─────────────────────────────────────────────────────────────
    // Frame + navigation
    // ─────────────────────────────────────────────────────────────

    /** @returns {void} */
    _render() {

        if ( !this._el ) return;

        this._el.innerHTML = `
            <div class="resowiz__panel">
                <div class="resowiz__header">
                    <div class="resowiz__title">🔎 Resolution Wizard</div>
                    <button type="button" class="resowiz__close" data-action="close">✕</button>
                </div>
                <div class="resowiz__steps">${ this._renderStepDots() }</div>
                <div class="resowiz__step-title">${ STEP_TITLES[ this._step - 1 ] }</div>
                <div class="resowiz__body"></div>
                <div class="resowiz__footer">
                    <button type="button" class="resowiz__btn" data-action="back" ${ this._step === 1 ? 'disabled' : '' }>← Back</button>
                    <button type="button" class="resowiz__btn resowiz__btn--primary" data-action="next">
                        ${ this._step === 7 ? 'Submit Investigation' : 'Next →' }
                    </button>
                </div>
            </div>
        `;

        this._renderBody( this._el.querySelector( '.resowiz__body' ) );
        this._wireFrame();

    }

    /** @returns {string} */
    _renderStepDots() {
        return Array.from( { length: 7 }, ( _, i ) => i + 1 )
            .map( n => `<span class="resowiz__dot ${ n === this._step ? 'resowiz__dot--active' : '' } ${ n < this._step ? 'resowiz__dot--done' : '' }">${ n }</span>` )
            .join( '' );
    }

    /** @returns {void} */
    _wireFrame() {

        this._el.querySelector( '[data-action="close"]' ).addEventListener( 'click', () => this.close() );
        this._el.querySelector( '[data-action="back"]' ).addEventListener( 'click', () => { this._step--; this._render(); } );
        this._el.querySelector( '[data-action="next"]' ).addEventListener( 'click', () => this._advance() );

    }

    /** @returns {void} */
    _advance() {
        if ( this._step === 7 ) { this._submit(); return; }
        this._step++;
        this._render();
    }

    // ─────────────────────────────────────────────────────────────
    // Step bodies
    // ─────────────────────────────────────────────────────────────

    /** @param {HTMLElement} body @returns {void} */
    _renderBody( body ) {

        const renderers = [
            () => this._renderSuspectStep( body ),
            () => this._renderMotiveStep( body ),
            () => this._renderWeaponStep( body ),
            () => this._renderLocationStep( body ),
            () => this._renderTimelineStep( body ),
            () => this._renderEvidenceStep( body ),
            () => this._renderReviewStep( body ),
        ];

        renderers[ this._step - 1 ]();

    }

    /** @param {HTMLElement} body @returns {void} */
    _renderSuspectStep( body ) {
        const items = PeopleManager.getAll().map( p => ( { id: p.id, label: p.name, sub: `${ p.role }${ p.occupation ? ' — ' + p.occupation : '' }` } ) );
        this._renderSingleSelect( body, items, 'suspect' );
    }

    /** @param {HTMLElement} body @returns {void} */
    _renderMotiveStep( body ) {
        const items = MOTIVE_OPTIONS.map( m => ( { id: m.id, label: m.label } ) );
        this._renderSingleSelect( body, items, 'motive' );
    }

    /** @param {HTMLElement} body @returns {void} */
    _renderWeaponStep( body ) {
        const items = EvidenceManager.getByCategory( 'all' ).map( e => ( { id: e.id, label: e.title, sub: e.category } ) );
        this._renderSingleSelect( body, items, 'weapon' );
    }

    /** @param {HTMLElement} body @returns {void} */
    _renderLocationStep( body ) {
        const items = MapManager.getAllLocations().map( l => ( { id: l.id, label: l.name, sub: l.type } ) );
        this._renderSingleSelect( body, items, 'location' );
    }

    /** @param {HTMLElement} body @returns {void} */
    _renderTimelineStep( body ) {
        const items = TIMELINE_OPTIONS.map( t => ( { id: t.id, label: t.label } ) );
        this._renderSingleSelect( body, items, 'timeline' );
    }

    /** @param {HTMLElement} body @returns {void} */
    _renderEvidenceStep( body ) {

        const evidence = EvidenceManager.getByCategory( 'all' );
        const theories = BoardManager.getNodes().filter( n => n.type === 'theory' );

        body.innerHTML = `
            <div class="resowiz__section-label">Select every evidence item that supports your accusation.</div>
            <div class="resowiz__checklist">
                ${ evidence.map( e => `
                    <label class="resowiz__check-row">
                        <input type="checkbox" data-evidence="${ e.id }" ${ this._draft.evidence.includes( e.id ) ? 'checked' : '' }>
                        <span class="resowiz__check-label">${ this._esc( e.title ) }</span>
                        <span class="resowiz__check-sub">${ this._esc( e.category ) }</span>
                    </label>
                ` ).join( '' ) || '<div class="resowiz__empty">No evidence collected yet.</div>' }
            </div>
            ${ theories.length ? `
                <div class="resowiz__section-label">Include a theory from the board (optional)</div>
                <div class="resowiz__checklist">
                    ${ theories.map( t => `
                        <label class="resowiz__check-row">
                            <input type="checkbox" data-theory="${ t.id }" ${ this._draft.theoryIds.includes( t.id ) ? 'checked' : '' }>
                            <span class="resowiz__check-label">💡 ${ this._esc( t.title ) }</span>
                        </label>
                    ` ).join( '' ) }
                </div>
            ` : '' }
        `;

        body.querySelectorAll( '[data-evidence]' ).forEach( cb => cb.addEventListener( 'change', () => this._toggle( this._draft.evidence, cb.dataset.evidence, cb.checked ) ) );
        body.querySelectorAll( '[data-theory]' ).forEach( cb => cb.addEventListener( 'change', () => this._toggle( this._draft.theoryIds, cb.dataset.theory, cb.checked ) ) );

    }

    /** @param {HTMLElement} body @returns {void} */
    _renderReviewStep( body ) {

        const suspect  = PeopleManager.getById( this._draft.suspect );
        const weapon    = EvidenceManager.getById( this._draft.weapon );
        const location = MapManager.getById( this._draft.location );
        const motive    = MOTIVE_OPTIONS.find( m => m.id === this._draft.motive );
        const timeline  = TIMELINE_OPTIONS.find( t => t.id === this._draft.timeline );

        body.innerHTML = `
            <div class="resowiz__review">
                <div class="resowiz__review-row"><span>Suspect</span><strong>${ suspect ? this._esc( suspect.name ) : '— not selected —' }</strong></div>
                <div class="resowiz__review-row"><span>Motive</span><strong>${ motive ? this._esc( motive.label ) : '— not selected —' }</strong></div>
                <div class="resowiz__review-row"><span>Weapon</span><strong>${ weapon ? this._esc( weapon.title ) : '— not selected —' }</strong></div>
                <div class="resowiz__review-row"><span>Location</span><strong>${ location ? this._esc( location.name ) : '— not selected —' }</strong></div>
                <div class="resowiz__review-row"><span>Timeline</span><strong>${ timeline ? this._esc( timeline.label ) : '— not selected —' }</strong></div>
                <div class="resowiz__review-row"><span>Supporting Evidence</span><strong>${ this._draft.evidence.length } item(s)</strong></div>
                <div class="resowiz__review-row"><span>Theories Included</span><strong>${ this._draft.theoryIds.length }</strong></div>
            </div>
            <div class="resowiz__warn">Submitting will evaluate this investigation. If it's incomplete or incorrect, nothing is lost — you can return and keep investigating.</div>
        `;

    }

    // ─────────────────────────────────────────────────────────────
    // Shared single-select rendering
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {HTMLElement} body
     * @param {{id:string, label:string, sub?:string}[]} items
     * @param {string} field - Key in this._draft to set.
     * @returns {void}
     */
    _renderSingleSelect( body, items, field ) {

        body.innerHTML = `
            <div class="resowiz__grid">
                ${ items.map( item => `
                    <button type="button" class="resowiz__card ${ this._draft[ field ] === item.id ? 'resowiz__card--selected' : '' }" data-id="${ item.id }">
                        <div class="resowiz__card-label">${ this._esc( item.label ) }</div>
                        ${ item.sub ? `<div class="resowiz__card-sub">${ this._esc( item.sub ) }</div>` : '' }
                    </button>
                ` ).join( '' ) || '<div class="resowiz__empty">Nothing available yet.</div>' }
            </div>
        `;

        body.querySelectorAll( '.resowiz__card' ).forEach( card => {
            card.addEventListener( 'click', () => {
                this._draft[ field ] = card.dataset.id;
                body.querySelectorAll( '.resowiz__card' ).forEach( c => c.classList.remove( 'resowiz__card--selected' ) );
                card.classList.add( 'resowiz__card--selected' );
            } );
        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Submission + results
    // ─────────────────────────────────────────────────────────────

    /** @returns {void} */
    _submit() {

        const result = ResolutionManager.submit( this._draft );
        if ( result ) this._renderResult( result );

    }

    /**
     * @param {{outcome:string, score:Object, report:Object, validation:Object}} result
     * @returns {void}
     */
    _renderResult( { outcome, score, report, validation } ) {

        const solved   = outcome === 'Perfect Investigation' || outcome === 'Successful Investigation';
        const tone     = solved ? 'resowiz__result--solved' : ( outcome === 'Investigation Failed' ? 'resowiz__result--failed' : 'resowiz__result--warn' );
        const recs      = this._buildRecommendations( validation );

        this._el.querySelector( '.resowiz__panel' ).innerHTML = `
            <div class="resowiz__header">
                <div class="resowiz__title">🔎 Resolution Wizard</div>
                <button type="button" class="resowiz__close" data-action="close">✕</button>
            </div>
            <div class="resowiz__result ${ tone }">
                <div class="resowiz__result-outcome">${ outcome }</div>
                <div class="resowiz__result-grid">
                    <div><span>Completion</span><strong>${ score.completionPercent }%</strong></div>
                    <div><span>Correct Evidence</span><strong>${ score.correctEvidencePercent }%</strong></div>
                    <div><span>Optional Objectives</span><strong>${ score.optionalObjectivesPercent }%</strong></div>
                    <div><span>Unused Evidence</span><strong>${ score.unusedEvidence }</strong></div>
                    <div><span>Time Taken</span><strong>${ this._formatDuration( score.timeTakenMs ) }</strong></div>
                </div>
                ${ recs.length ? `
                    <div class="resowiz__section-label">Recommendations</div>
                    <ul class="resowiz__recs">${ recs.map( r => `<li>${ this._esc( r ) }</li>` ).join( '' ) }</ul>
                ` : '' }
                <div class="resowiz__section-label">Case Summary</div>
                <div class="resowiz__summary">
                    <div><span>Suspect</span><strong>${ this._esc( report.suspect ) }</strong></div>
                    <div><span>Victim</span><strong>${ this._esc( report.victim ) }</strong></div>
                    <div><span>Weapon</span><strong>${ this._esc( report.weapon ) }</strong></div>
                    <div><span>Location</span><strong>${ this._esc( report.location ) }</strong></div>
                    <div><span>Final Verdict</span><strong>${ this._esc( report.finalVerdict ) }</strong></div>
                </div>
            </div>
            <div class="resowiz__footer">
                <button type="button" class="resowiz__btn" data-action="close">Continue Investigating</button>
            </div>
        `;

        this._el.querySelectorAll( '[data-action="close"]' ).forEach( btn => btn.addEventListener( 'click', () => {
            ResolutionManager.reopen();
            this.close();
        } ) );

    }

    /**
     * Translate a validation shortfall into a spec-style recommendation
     * line ("DNA report missing.", "Evidence not examined.").
     *
     * @param {Object} validation
     * @returns {string[]}
     */
    _buildRecommendations( validation ) {

        const recs = [];

        validation.missingEvidence.forEach( id => {
            const item = EvidenceManager.getById( id );
            recs.push( `Evidence not examined: ${ item ? item.title : id }.` );
        } );

        validation.missingObjectives.forEach( id => {
            recs.push( `Objective not completed: ${ id.replace( /^obj-/, '' ).replace( /-/g, ' ' ) }.` );
        } );

        validation.missingForensics.forEach( id => {
            const analysis = ForensicsManager.getById( id );
            recs.push( `Forensic report missing: ${ analysis ? analysis.type : id }.` );
        } );

        if ( !validation.phaseOk ) recs.push( 'The investigation has not progressed far enough yet.' );

        if ( !validation.checks.suspect )  recs.push( 'The suspect named does not match the evidence.' );
        if ( !validation.checks.weapon )    recs.push( 'The weapon/method named does not match the evidence.' );
        if ( !validation.checks.location ) recs.push( 'The location named does not match the evidence.' );
        if ( !validation.checks.motive )    recs.push( 'The motive named is not supported by the evidence.' );

        return recs;

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /** @param {Array} arr @param {string} id @param {boolean} include @returns {void} */
    _toggle( arr, id, include ) {
        const idx = arr.indexOf( id );
        if ( include && idx === -1 ) arr.push( id );
        if ( !include && idx !== -1 ) arr.splice( idx, 1 );
    }

    /** @param {number} ms @returns {string} */
    _formatDuration( ms ) {
        const minutes = Math.round( ms / 60000 );
        if ( minutes < 60 ) return `${ minutes }m`;
        return `${ Math.floor( minutes / 60 ) }h ${ minutes % 60 }m`;
    }

    /** @param {string} str @returns {string} */
    _esc( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default ResolutionWizard;
