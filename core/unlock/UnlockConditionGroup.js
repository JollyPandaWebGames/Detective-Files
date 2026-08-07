/**
 * UnlockConditionGroup
 *
 * Purpose:
 *   Mission 19 — Dynamic Content Unlock Engine. Normalizes a rule's
 *   `conditions` into a boolean tree and evaluates it against which
 *   leaf conditions have been satisfied so far — the spec's "AND / OR /
 *   Nested Groups" requirement.
 *
 *   A rule's `conditions` may be:
 *     - a flat array of leaf conditions (spec's own example shape) —
 *       treated as an implicit AND group, so simple rules stay simple
 *     - an explicit group: { match: 'all'|'any', conditions: [...] }
 *       where each entry is a leaf or another nested group
 *
 * Rules:
 *   Pure — no EventBus, no persistence. UnlockManager owns tracking
 *   which leaves are satisfied; this module only answers "given that
 *   set, is the whole tree true yet?"
 */

/**
 * Walk a rule's raw `conditions` field into a uniform tree and assign
 * every leaf a stable index (0, 1, 2…) in traversal order — used to key
 * the "satisfied" set UnlockManager persists per rule.
 *
 * @param {Object[]|Object} rawConditions
 * @returns {{ tree: Object, leaves: Object[] }}
 *   `leaves` is a flat list of every leaf condition, `_index`-tagged,
 *   in the same order the tree references them.
 */
export function normalizeConditions( rawConditions ) {

    const leaves = [];
    let nextIndex = 0;

    const visit = node => {

        if ( Array.isArray( node ) ) {
            return { match: 'all', conditions: node.map( visit ) };
        }

        if ( node.conditions ) {
            return { match: node.match === 'any' ? 'any' : 'all', conditions: node.conditions.map( visit ) };
        }

        // Leaf.
        const leaf = { ...node, _index: nextIndex++ };
        leaves.push( leaf );
        return leaf;

    };

    const tree = visit( rawConditions ?? [] );
    return { tree, leaves };

}

/**
 * @param {Object} tree              - Output of normalizeConditions().tree.
 * @param {Set<number>} satisfiedSet - Leaf indices satisfied so far.
 * @returns {boolean}
 */
export function evaluateConditionTree( tree, satisfiedSet ) {

    if ( tree.conditions ) {
        const results = tree.conditions.map( child => evaluateConditionTree( child, satisfiedSet ) );
        return tree.match === 'any' ? results.some( Boolean ) : results.every( Boolean );
    }

    return satisfiedSet.has( tree._index );

}

export default { normalizeConditions, evaluateConditionTree };
