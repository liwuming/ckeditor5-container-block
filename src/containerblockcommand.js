/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module code-block/codeblockcommand
 */

import { Command } from 'ckeditor5/src/core';
import { first } from 'ckeditor5/src/utils';

import { getNormalizedAndLocalizedcontainerDefinitions } from './utils';

/**
 * The code block command plugin.
 *
 * @extends module:core/command~Command
 */
export default class ContainerBlockCommand extends Command {
    /**
     * @inheritDoc
     */
    constructor(editor) {
        super(editor);

        /**
         * Contains the last used container.

         * @protected
         * @type {String|null}
         */
        this._lastcontainer = null;
    }

    /**
     * Whether the selection starts in a code block.
     *
     * @observable
     * @readonly
     * @member {Boolean} #value
     */

    /**
     * @inheritDoc
     */
    refresh() {
        this.value = this._getValue();
        this.isEnabled = this._checkEnabled();
    }

    /**
     * Executes the command. When the command {@link #value is on}, all topmost code blocks within
     * the selection will be removed. If it is off, all selected blocks will be flattened and
     * wrapped by a code block.
     *
     * @fires execute
     * @param {Object} [options] Command options.
     * @param {String} [options.container] The code block container.
     * @param {Boolean} [options.forceValue] If set, it will force the command behavior. If `true`, the command will apply a code block,
     * otherwise the command will remove the code block. If not set, the command will act basing on its current value.
     * @param {Boolean} [options.usePreviouscontainerChoice] If set on `true` and the `options.container` is not specified, the command
     * will apply the previous container (if the command was already executed) when inserting the `codeBlock` element.
     */
    execute(options = {}) {
        const editor = this.editor;
        const model = editor.model;
        const selection = model.document.selection;
        const normalizedcontainersDefs = getNormalizedAndLocalizedcontainerDefinitions(editor);
        const firstcontainerInConfig = normalizedcontainersDefs[0];

        const blocks = Array.from(selection.getSelectedBlocks());
        const value = (options.forceValue === undefined) ? !this.value : options.forceValue;
        const container = getcontainer(options, this._lastcontainer, firstcontainerInConfig.container);

        console.log(container);
        model.change(writer => {
            if (value) {
                this._applyContainerBlock(writer, blocks, container);
            } else {
                this._removeContainerBlock(writer, blocks);
            }
        });
    }

    /**
     * Checks the command's {@link #value}.
     *
     * @private
     * @returns {Boolean} The current value.
     */
    _getValue() {
        const selection = this.editor.model.document.selection;
        const firstBlock = first(selection.getSelectedBlocks());
        const isContainerBlock = !!(firstBlock && firstBlock.is('element', 'containerBlock'));

        return isContainerBlock ? firstBlock.getAttribute('container') : false;
    }

    /**
     * Checks whether the command can be enabled in the current context.
     *
     * @private
     * @returns {Boolean} Whether the command should be enabled.
     */
    _checkEnabled() {
        if (this.value) {
            return true;
        }

        const selection = this.editor.model.document.selection;
        const schema = this.editor.model.schema;

        const firstBlock = first(selection.getSelectedBlocks());

        if (!firstBlock) {
            return false;
        }

        return canBeContainerBlock(schema, firstBlock);
    }

    /**
     * @private
     * @param {module:engine/model/writer~Writer} writer
     * @param {Array.<module:engine/model/element~Element>} blocks
     * @param {String} [container]
     */
    _applyContainerBlock(writer, blocks, container) {
        this._lastcontainer = container;

        const schema = this.editor.model.schema;
        const allowedBlocks = blocks.filter(block => canBeContainerBlock(schema, block));

        for (const block of allowedBlocks) {
            writer.rename(block, 'containerBlock');
            writer.setAttribute('class',"ui-"+container+"-section", block);
            schema.removeDisallowedAttributes([block], writer);

            // Remove children of the  `codeBlock` element that are not allowed. See #9567.
            Array.from(block.getChildren())
                .filter(child => !schema.checkChild(block, child))
                .forEach(child => writer.remove(child));
        }

        allowedBlocks.reverse().forEach((currentBlock, i) => {
            const nextBlock = allowedBlocks[i + 1];

            if (currentBlock.previousSibling === nextBlock) {
                writer.appendElement('softBreak', nextBlock);
                writer.merge(writer.createPositionBefore(currentBlock));
            }
        });
    }

    /**
     * @private
     * @param {module:engine/model/writer~Writer} writer
     * @param {Array.<module:engine/model/element~Element>} blocks
     */
    _removeContainerBlock(writer, blocks) {
        const codeBlocks = blocks.filter(block => block.is('element', 'containerBlock'));

        for (const block of codeBlocks) {
            const range = writer.createRangeOn(block);

            for (const item of Array.from(range.getItems()).reverse()) {
                if (item.is('element', 'softBreak') && item.parent.is('element', 'containerBlock')) {
                    const { position } = writer.split(writer.createPositionBefore(item));

                    writer.rename(position.nodeAfter, 'paragraph');
                    writer.removeAttribute('class', position.nodeAfter);
                    writer.remove(item);
                }
            }

            writer.rename(block, 'paragraph');
            writer.removeAttribute('class', block);
        }
    }
}

function canBeContainerBlock(schema, element) {
    if (element.is('rootElement') || schema.isLimit(element)) {
        return false;
    }

    return schema.checkChild(element.parent, 'containerBlock');
}

function getcontainer(options, lastcontainer, defaultcontainer) {
    if (options.container) {
        return options.container;
    }

    if (options.usePreviouscontainerChoice && lastcontainer) {
        return lastcontainer;
    }

    return defaultcontainer;
}