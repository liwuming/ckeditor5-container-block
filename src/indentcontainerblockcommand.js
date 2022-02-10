/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
import { Command } from 'ckeditor5/src/core';

import {
    getIndentOutdentPositions,
    isModelSelectionInContainerBlock
} from './utils';

export default class IndentCodeBlockCommand extends Command {
    constructor(editor) {
        super(editor);
        this._indentSequence = editor.config.get('codeBlock.indentSequence');
    }
    refresh() {
        this.isEnabled = this._checkEnabled();
    }

    execute() {
        const editor = this.editor;
        const model = editor.model;

        model.change(writer => {
            const positions = getIndentOutdentPositions(model);
            for (const position of positions) {
                writer.insertText(this._indentSequence, position);
            }
        });
    }
    _checkEnabled() {
        if (!this._indentSequence) {
            return false;
        }
        return isModelSelectionInContainerBlock(this.editor.model.document.selection);
    }
}