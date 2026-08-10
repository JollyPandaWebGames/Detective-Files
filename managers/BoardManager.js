import StorageManager from './StorageManager.js';
import EventBus from '../core/EventBus.js';

const STORAGE_KEY = 'board-state';
const NODE_W = 140, NODE_H = 72;

class BoardManagerClass {
    constructor() {
        this._activeCaseId = null;
        this._board = this._empty();
        this._all = {};
        this._loaded = false;
        this._counter = Date.now();
    }

    initialize() {
        if (this._loaded) return;
        this._all = StorageManager.load(STORAGE_KEY, {});
        this._loaded = true;
    }

    loadForCase(caseId) {
        if (this._activeCaseId) this._persist();
        this._activeCaseId = caseId;
        this._board = this._all[caseId] ?? this._empty();
        this._all[caseId] = this._board;
    }

    /** Case 00 replay support — wipe this case's saved board. Call before loadForCase(). */
    resetForCase(caseId) {
        delete this._all[caseId];
        StorageManager.save(STORAGE_KEY, this._all);
    }

    getNodes() { return this._board.nodes; }
    getConnections() { return this._board.connections; }
    getGroups() { return this._board.groups; }
    getCamera() { return { ...this._board.camera }; }
    getNodeById(id) { return this._board.nodes.find(n => n.id === id); }
    getConnectionsForNode(id) { return this._board.connections.filter(c => c.fromId === id || c.toId === id); }
    hasSourceId(sid) { return this._board.nodes.some(n => n.sourceId === sid); }
    search(q) {
        if (!q.trim()) return [];
        const lq = q.toLowerCase();
        return this._board.nodes.filter(n => n.title.toLowerCase().includes(lq) || (n.subtitle ?? '').toLowerCase().includes(lq));
    }

    addNode(data) {
        const node = { id: this._uid('node'), type: 'note', title: 'New Node', subtitle: '', x: 400, y: 300, width: NODE_W, height: NODE_H, color: '#2D4768', pinned: false, collapsed: false, sourceId: null, data: {}, ...data };
        this._board.nodes.push(node);
        this._persist();
        EventBus.emit('board:node-added', { node });
        return node;
    }

    updateNode(id, updates) {
        const n = this.getNodeById(id);
        if (!n) return;
        Object.assign(n, updates);
        this._persist();
        EventBus.emit('board:updated', { type: 'node', id });
    }

    removeNode(id) {
        this._board.nodes = this._board.nodes.filter(n => n.id !== id);
        this._board.connections = this._board.connections.filter(c => c.fromId !== id && c.toId !== id);
        this._board.groups.forEach(g => { g.nodeIds = (g.nodeIds ?? []).filter(i => i !== id); });
        this._persist();
        EventBus.emit('board:updated', { type: 'node-removed', id });
    }

    addConnection(fromId, toId, opts = {}) {
        const conn = { id: this._uid('conn'), fromId, toId, label: opts.label ?? '', color: opts.color ?? '#4D5C72', thickness: opts.thickness ?? 2 };
        this._board.connections.push(conn);
        this._persist();
        EventBus.emit('board:connection-created', { connection: conn });
        return conn;
    }

    updateConnection(id, updates) {
        const c = this._board.connections.find(c => c.id === id);
        if (!c) return;
        Object.assign(c, updates);
        this._persist();
    }

    removeConnection(id) {
        this._board.connections = this._board.connections.filter(c => c.id !== id);
        this._persist();
        EventBus.emit('board:updated', { type: 'connection-removed', id });
    }

    addGroup(data) {
        const g = { id: this._uid('group'), title: 'New Group', color: '#223247', description: '', nodeIds: [], ...data };
        this._board.groups.push(g);
        this._persist();
        EventBus.emit('board:group-created', { group: g });
        return g;
    }

    saveCamera(x, y, zoom) {
        this._board.camera = { x, y, zoom };
        this._persist();
    }

    _empty() { return { camera: { x: 0, y: 0, zoom: 1 }, nodes: [], connections: [], groups: [] }; }
    _persist() { if (!this._activeCaseId) return; this._all[this._activeCaseId] = this._board; StorageManager.save(STORAGE_KEY, this._all); }
    _uid(p) { return `${p}-${++this._counter}`; }
}

const BoardManager = new BoardManagerClass();
export default BoardManager;
