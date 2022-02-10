/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module code-block/utils
 */

import { first } from 'ckeditor5/src/utils';

export function getNormalizedAndLocalizedcontainerDefinitions(editor) {
    const t = editor.t;
    const containerDefs = editor.config.get('containerBlock.containers');

    for (const def of containerDefs) {
        if (def.label === 'Plain text') {
            def.label = t('Plain text');
        }

        if (def.class === undefined) {
            def.class = def.container;
        }
    }

    return containerDefs;
}

export function getPropertyAssociation(containerDefs, key, value) {
    const association = {};

    for (const def of containerDefs) {
        association[def[key]] = def[value];

    }

    return association;
}

export function getLeadingWhiteSpaces(textNode) {
    return textNode.data.match(/^(\s*)/)[0];
}


export function rawSnippetTextToViewDocumentFragment( writer, text ) {
	const fragment = writer.createDocumentFragment();
	const textLines = text.split( '\n' );

	const nodes = textLines.reduce( ( nodes, line, lineIndex ) => {
		nodes.push( line );

		if ( lineIndex < textLines.length - 1 ) {
			nodes.push( writer.createElement( 'p' ) );
		}

		return nodes;
	}, [] );

	writer.appendChild( nodes, fragment );

	return fragment;
}

export function getIndentOutdentPositions(model) {
    const selection = model.document.selection;
    const positions = [];

    // When the selection is collapsed, there's only one position we can indent or outdent.
    if (selection.isCollapsed) {
        positions.push(selection.anchor);
    }

    // When the selection is NOT collapsed, collect all positions starting before text nodes
    // (code lines) in any <codeBlock> within the selection.
    else {
        // Walk backward so positions we are about to collect here do not get outdated when
        // inserting or deleting using the writer.
        const walker = selection.getFirstRange().getWalker({
            ignoreElementEnd: true,
            direction: 'backward'
        });

        for (const { item }
            of walker) {
            if (item.is('$textProxy') && item.parent.is('element', 'containerBlock')) {
                const leadingWhiteSpaces = getLeadingWhiteSpaces(item.textNode);
                const { parent, startOffset } = item.textNode;

                // Make sure the position is after all leading whitespaces in the text node.
                const position = model.createPositionAt(parent, startOffset + leadingWhiteSpaces.length);

                positions.push(position);
            }
        }
    }

    return positions;
}

export function isModelSelectionInContainerBlock(selection) {
    const firstBlock = first(selection.getSelectedBlocks());

    return firstBlock && firstBlock.is('element', 'containerBlock');
}