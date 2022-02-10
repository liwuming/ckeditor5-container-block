/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module code-block/outdentcodeblockcommand
 */

import { Command } from 'ckeditor5/src/core';

import {
    getLeadingWhiteSpaces,
    getIndentOutdentPositions,
    isModelSelectionInContainerBlock
} from './utils';

/**
 * The code block indentation decrease command plugin.
 *
 * @extends module:core/command~Command
 */
export default class OutdentCodeBlockCommand extends Command {
    constructor(editor) {
        super(editor);

        /**
         * A sequence of characters removed from the line when the command is executed.
         *
         * @readonly
         * @private
         * @member {String}
         */
        this._indentSequence = editor.config.get('codeBlock.indentSequence');
    }

    /**
     * @inheritDoc
     */
    refresh() {
        this.isEnabled = this._checkEnabled();
    }

    /**
     * Executes the command. When the command {@link #isEnabled is enabled}, the indentation of the
     * code lines in the selection will be decreased.
     *
     * @fires execute
     */
    execute() {
        const editor = this.editor;
        const model = editor.model;

        model.change(writer => {
            const positions = getIndentOutdentPositions(model);
            for (const position of positions) {
                const range = getLastOutdentableSequenceRange(this.editor.model, position, this._indentSequence);

                if (range) {
                    writer.remove(range);
                }
            }
        });
    }

    _checkEnabled() {
        if (!this._indentSequence) {
            return false;
        }

        const model = this.editor.model;

        if (!isModelSelectionInContainerBlock(model.document.selection)) {
            return false;
        }

        return getIndentOutdentPositions(model).some(position => {
            return getLastOutdentableSequenceRange(model, position, this._indentSequence);
        });
    }
}

function getLastOutdentableSequenceRange(model, position, sequence) {
    // Positions start before each text node (code line). Get the node corresponding to the position.
    const nodeAtPosition = getCodeLineTextNodeAtPosition(position);

    if (!nodeAtPosition) {
        return null;
    }

    const leadingWhiteSpaces = getLeadingWhiteSpaces(nodeAtPosition);
    const lastIndexOfSequence = leadingWhiteSpaces.lastIndexOf(sequence);

    if (lastIndexOfSequence + sequence.length !== leadingWhiteSpaces.length) {
        return null;
    }

    if (lastIndexOfSequence === -1) {
        return null;
    }

    const { parent, startOffset } = nodeAtPosition;
    return model.createRange(
        model.createPositionAt(parent, startOffset + lastIndexOfSequence),
        model.createPositionAt(parent, startOffset + lastIndexOfSequence + sequence.length)
    );
}

function getCodeLineTextNodeAtPosition(position) {
    // Positions start before each text node (code line). Get the node corresponding to the position.
    let nodeAtPosition = position.parent.getChild(position.index);

    if (!nodeAtPosition || nodeAtPosition.is('element', 'softBreak')) {
        nodeAtPosition = position.nodeBefore;
    }

    if (!nodeAtPosition || nodeAtPosition.is('element', 'softBreak')) {
        return null;
    }

    return nodeAtPosition;
}