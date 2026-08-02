/**
 * RecycleBin
 *
 * Purpose:
 *   Displays all deleted items from the workstation.
 *   Allows restore (re-emits recycle-bin:item-restored) or
 *   permanent deletion. Supports filter by type and case.
 *
 * Layout:
 *   Left sidebar — filters
 *   Right panel  — item list with actions
 */

import BaseApp           from '../../core/BaseApp.js';
import EventBus          from '../../core/EventBus.js';
import RecycleBinManager from '../../managers/RecycleBinManager.js';

const TYPE_META = {
    'board-node':  { emoji: '📌', label: 'Board Node'  },
    'evidence':    { emoji: '🔍', label: 'Evidence'    },
    'note':        { emoji: '📝', label: 'Note'        },
    'unknown':     { emoji: '📦', label: 'Item'        },
};

const FILTERS = [
    { id: 'all',        label: 'All Items',   emoji: '🗑️' },
    { id: 'board-node', label: 'Board Nodes', emoji: '📌' },
    { id: 'evidence',   label: 'Evidence',    emoji: '🔍' },
    { id: 'note',       label: 'Notes',       emoji: '📝' },
];

class RecycleBin extends BaseApp {

    constructor( config ) {
        super( config );
        this._activeFilter = 'all';
        this._sidebarEl    = null;
        this._listEl       = null;

        this._onAdded   = () => this._refresh();
        this._onDeleted = () => this._refresh();
        this._onCleared = () => this._refresh();
    }

    create( contentEl ) {
        contentEl.classList.add( 'rb' );

        this._sidebarEl = document.createElement( 'nav' );
        this._sidebarEl.className = 'rb__sidebar';

        FILTERS.forEach( f => {
            const btn = document.createElement( 'button' );
            btn.className    = 'rb__filter-btn';
            btn.dataset.id   = f.id;
            btn.type         = 'button';
            btn.innerHTML    = `<span>${f.emoji}</span><span>${f.label}</span>`;
            btn.addEventListener( 'click', () => { this._activeFilter = f.id; this._updateSidebar(); this._refresh(); } );
            this._sidebarEl.appendChild( btn );
        } );

        // Empty bin button.
        const emptyBtn = document.createElement( 'button' );
        emptyBtn.className   = 'rb__empty-btn';
        emptyBtn.type        = 'button';
        emptyBtn.textContent = '🗑️ Empty Bin';
        emptyBtn.addEventListener( 'click', () => {
            if ( confirm( 'Permanently delete all items? This cannot be undone.' ) ) {
                RecycleBinManager.emptyBin();
            }
        } );
        this._sidebarEl.appendChild( emptyBtn );

        this._listEl = document.createElement( 'div' );
        this._listEl.className = 'rb__list';

        contentEl.appendChild( this._sidebarEl );
        contentEl.appendChild( this._listEl );

        this._updateSidebar();
        this._refresh();
    }

    open() {
        EventBus.on( 'recycle-bin:item-added',   this._onAdded   );
        EventBus.on( 'recycle-bin:item-deleted',  this._onDeleted );
        EventBus.on( 'recycle-bin:item-restored', this._onDeleted );
        EventBus.on( 'recycle-bin:cleared',       this._onCleared );
        this._refresh();
    }

    close() {
        EventBus.off( 'recycle-bin:item-added',   this._onAdded   );
        EventBus.off( 'recycle-bin:item-deleted',  this._onDeleted );
        EventBus.off( 'recycle-bin:item-restored', this._onDeleted );
        EventBus.off( 'recycle-bin:cleared',       this._onCleared );
    }

    minimize() {}
    restore()  { this._refresh(); }
    destroy()  { this._sidebarEl = null; this._listEl = null; super.destroy(); }

    _updateSidebar() {
        if ( !this._sidebarEl ) return;
        this._sidebarEl.querySelectorAll( '.rb__filter-btn' ).forEach( btn => {
            btn.classList.toggle( 'rb__filter-btn--active', btn.dataset.id === this._activeFilter );
        } );
    }

    _refresh() {
        if ( !this._listEl ) return;
        this._listEl.innerHTML = '';

        const filter = this._activeFilter === 'all' ? {} : { type: this._activeFilter };
        const items  = RecycleBinManager.getAll( filter );

        if ( items.length === 0 ) {
            this._listEl.innerHTML = `
                <div class="rb__empty">
                    <div class="rb__empty-emoji">🗑️</div>
                    <div class="rb__empty-text">Recycle Bin is empty</div>
                </div>`;
            return;
        }

        items.forEach( item => {
            const meta = TYPE_META[ item.type ] ?? TYPE_META.unknown;
            const row  = document.createElement( 'div' );
            row.className = 'rb__item';
            row.innerHTML = `
                <div class="rb__item-icon">${ meta.emoji }</div>
                <div class="rb__item-body">
                    <div class="rb__item-title">${ this._esc( item.title ) }</div>
                    <div class="rb__item-meta">
                        <span class="rb__item-type">${ meta.label }</span>
                        ${ item.caseId ? `<span class="rb__item-case">${ this._esc( item.caseId ) }</span>` : '' }
                        <span class="rb__item-date">${ this._fmtDate( item.deletedAt ) }</span>
                    </div>
                </div>
                <div class="rb__item-actions">
                    <button type="button" class="rb__restore-btn" title="Restore">↩</button>
                    <button type="button" class="rb__delete-btn" title="Delete permanently">×</button>
                </div>`;

            row.querySelector( '.rb__restore-btn' ).addEventListener( 'click', () => RecycleBinManager.restore( item.id ) );
            row.querySelector( '.rb__delete-btn'  ).addEventListener( 'click', () => RecycleBinManager.deletePermanently( item.id ) );

            this._listEl.appendChild( row );
        } );
    }

    _fmtDate( iso ) {
        if ( !iso ) return '';
        const d = new Date( iso );
        return `${ d.getFullYear() }-${ String( d.getMonth() + 1 ).padStart( 2, '0' ) }-${ String( d.getDate() ).padStart( 2, '0' ) } ${ String( d.getHours() ).padStart( 2, '0' ) }:${ String( d.getMinutes() ).padStart( 2, '0' ) }`;
    }

    _esc( s ) { const d = document.createElement( 'div' ); d.textContent = s ?? ''; return d.innerHTML; }
}

export default RecycleBin;
