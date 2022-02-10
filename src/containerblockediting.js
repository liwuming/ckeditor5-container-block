/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
import { Plugin } from 'ckeditor5/src/core';
import { ShiftEnter } from 'ckeditor5/src/enter';
import { UpcastWriter } from 'ckeditor5/src/engine';

import ContainerBlockCommand from './containerblockcommand';
import IndentContainerBlockCommand from './indentcontainerblockcommand';
import OutdentContainerBlockCommand from './outdentcontainerblockcommand';
import {
    getNormalizedAndLocalizedcontainerDefinitions,
    getLeadingWhiteSpaces,
    rawSnippetTextToViewDocumentFragment
} from './utils';
import {
    modelToViewContainerBlockInsertion,
    modelToDataViewSoftBreakInsertion,
    dataViewToModelContainerBlockInsertion,
    dataViewToModelTextNewlinesInsertion
} from './converters';

const DEFAULT_ELEMENT = 'paragraph';


export default class ContainerBlockEditing extends Plugin {
    static get pluginName() {
        return 'ContainerBlockEditing';
    }

    static get requires() {
        return [ShiftEnter];
    }

    constructor(editor) {
        super(editor);

        editor.config.define('containerBlock', {
            containers: [
                { container: 'success', label: 'success' },
                { container: 'info', label: 'info' },
                { container: 'warning', label: 'warning' },
                { container: 'error', label: 'error' },
            ],
            indentSequence: '\t'
        });
    }

    init() {
        const editor = this.editor;
        const schema = editor.model.schema;
        const model = editor.model;
        const view = editor.editing.view;

        const normalizedcontainersDefs = getNormalizedAndLocalizedcontainerDefinitions(editor);

        editor.commands.add('containerBlock', new ContainerBlockCommand(editor));

        editor.commands.add('indentContainerBlock', new IndentContainerBlockCommand(editor));
        editor.commands.add('outdentContainerBlock', new OutdentContainerBlockCommand(editor));

        const getCommandExecuter = commandName => {
            return (data, cancel) => {
                const command = this.editor.commands.get(commandName);

                if (command.isEnabled) {
                    this.editor.execute(commandName);
                    cancel();
                }
            };
        };

        editor.keystrokes.set('Tab', getCommandExecuter('indentContainerBlock'));
        editor.keystrokes.set('Shift+Tab', getCommandExecuter('outdentContainerBlock'));

        schema.register('containerBlock', {
            allowWhere: '$block',
            allowChildren: '$text',
            isBlock: true,
            allowAttributes: ['class']
        });

        // Disallow all attributes on $text inside `codeBlock`.
        schema.addAttributeCheck(context => {
            if (context.endsWith('containerBlock $text')) {
                return false;
            }
        });

        editor.model.schema.addChildCheck((context, childDefinition) => {
            if (context.endsWith('containerBlock') && childDefinition.isObject) {
                return false;
            }
        });

        // Conversion.
        editor.editing.downcastDispatcher.on('insert:containerBlock', modelToViewContainerBlockInsertion(model, normalizedcontainersDefs, true));
        editor.data.downcastDispatcher.on('insert:containerBlock', modelToViewContainerBlockInsertion(model, normalizedcontainersDefs));
        editor.data.downcastDispatcher.on('insert:softBreak', modelToDataViewSoftBreakInsertion(model), { priority: 'high' });

        editor.data.upcastDispatcher.on('element:code', dataViewToModelContainerBlockInsertion(view, normalizedcontainersDefs));
        editor.data.upcastDispatcher.on('text', dataViewToModelTextNewlinesInsertion());

        this.listenTo(editor.editing.view.document, 'clipboardInput', (evt, data) => {
            let insertionRange = model.createRange(model.document.selection.anchor);

            // Use target ranges in case this is a drop.
            if (data.targetRanges) {
                insertionRange = editor.editing.mapper.toModelRange(data.targetRanges[0]);
            }

            if (!insertionRange.start.parent.is('element', 'containerBlock')) {
                return;
            }

            const text = data.dataTransfer.getData('text/plain');
            const writer = new UpcastWriter(editor.editing.view.document);

            // Pass the view fragment to the default clipboardInput handler.
            data.content = rawSnippetTextToViewDocumentFragment(writer, text);
        });

        this.listenTo(model, 'getSelectedContent', (evt, [selection]) => {
            const anchor = selection.anchor;

            if (selection.isCollapsed || !anchor.parent.is('element', 'containerBlock') || !anchor.hasSameParentAs(selection.focus)) {
                return;
            }

            model.change(writer => {
                const docFragment = evt.return;

                if (docFragment.childCount > 1 || selection.containsEntireContent(anchor.parent)) {
                    const containerBlock = writer.createElement('containerBlock', anchor.parent.getAttributes());
                    writer.append(docFragment, containerBlock);

                    const newDocumentFragment = writer.createDocumentFragment();
                    writer.append(containerBlock, newDocumentFragment);

                    evt.return = newDocumentFragment;
                } else {
                    const textNode = docFragment.getChild(0);

                    if (schema.checkAttribute(textNode, 'p')) {
                        writer.setAttribute('p', true, textNode);
                    }
                }
            });
        });
    }

    afterInit() {
        const editor = this.editor;
        const commands = editor.commands;
        const indent = commands.get('indent');
        const outdent = commands.get('outdent');

        if (indent) {
            indent.registerChildCommand(commands.get('indentContainerBlock'));
        }

        if (outdent) {
            outdent.registerChildCommand(commands.get('outdentContainerBlock'));
        }

        this.listenTo(editor.editing.view.document, 'enter', (evt, data) => {
            const positionParent = editor.model.document.selection.getLastPosition().parent;

            if (!positionParent.is('element', 'containerBlock')) {
                return;
            }

            if (!leaveBlockStartOnEnter(editor, data.isSoft) && !leaveBlockEndOnEnter(editor, data.isSoft)) {
                breakLineOnEnter(editor);
            }

            data.preventDefault();
            evt.stop();
        }, { context: 'blockquote' });
    }
}

function breakLineOnEnter(editor) {
    const model = editor.model;
    const modelDoc = model.document;
    const lastSelectionPosition = modelDoc.selection.getLastPosition();
    const node = lastSelectionPosition.nodeBefore || lastSelectionPosition.textNode;
    let leadingWhiteSpaces;

    if (node && node.is('$text')) {
        leadingWhiteSpaces = getLeadingWhiteSpaces(node);
    }

    editor.model.change(writer => {
        editor.execute('shiftEnter');

        if (leadingWhiteSpaces) {
            writer.insertText(leadingWhiteSpaces, modelDoc.selection.anchor);
        }
    });
}

function leaveBlockStartOnEnter(editor, isSoftEnter) {
    const model = editor.model;
    const modelDoc = model.document;
    const view = editor.editing.view;
    const lastSelectionPosition = modelDoc.selection.getLastPosition();
    const nodeAfter = lastSelectionPosition.nodeAfter;

    if (isSoftEnter || !modelDoc.selection.isCollapsed || !lastSelectionPosition.isAtStart) {
        return false;
    }

    if (!isSoftBreakNode(nodeAfter)) {
        return false;
    }


    editor.model.change(writer => {
        editor.execute('enter');

        const newBlock = modelDoc.selection.anchor.parent.previousSibling;

        writer.rename(newBlock, DEFAULT_ELEMENT);
        writer.setSelection(newBlock, 'in');
        editor.model.schema.removeDisallowedAttributes([newBlock], writer);
        writer.remove(nodeAfter);
    });

    // Eye candy.
    view.scrollToTheSelection();

    return true;
}

function leaveBlockEndOnEnter(editor, isSoftEnter) {
    const model = editor.model;
    const modelDoc = model.document;
    const view = editor.editing.view;
    const lastSelectionPosition = modelDoc.selection.getLastPosition();
    const nodeBefore = lastSelectionPosition.nodeBefore;

    let emptyLineRangeToRemoveOnEnter;

    if (!modelDoc.selection.isCollapsed || !lastSelectionPosition.isAtEnd || !nodeBefore || !nodeBefore.previousSibling) {
        console.log(123);
        return false;
    } else {
        console.log(234);
    }

    if (isSoftBreakNode(nodeBefore) && isSoftBreakNode(nodeBefore.previousSibling)) {
        emptyLineRangeToRemoveOnEnter = model.createRange(
            model.createPositionBefore(nodeBefore.previousSibling), model.createPositionAfter(nodeBefore)
        );
    } else if (
        isEmptyishTextNode(nodeBefore) &&
        isSoftBreakNode(nodeBefore.previousSibling) &&
        isSoftBreakNode(nodeBefore.previousSibling.previousSibling)
    ) {
        emptyLineRangeToRemoveOnEnter = model.createRange(
            model.createPositionBefore(nodeBefore.previousSibling.previousSibling), model.createPositionAfter(nodeBefore)
        );
    } else if (
        isEmptyishTextNode(nodeBefore) &&
        isSoftBreakNode(nodeBefore.previousSibling) &&
        isEmptyishTextNode(nodeBefore.previousSibling.previousSibling) &&
        isSoftBreakNode(nodeBefore.previousSibling.previousSibling.previousSibling)
    ) {
        emptyLineRangeToRemoveOnEnter = model.createRange(
            model.createPositionBefore(nodeBefore.previousSibling.previousSibling.previousSibling),
            model.createPositionAfter(nodeBefore)
        );
    } else {
        return false;
    }

    editor.model.change(writer => {
        writer.remove(emptyLineRangeToRemoveOnEnter);

        editor.execute('enter');

        const newBlock = modelDoc.selection.anchor.parent;
        writer.rename(newBlock, DEFAULT_ELEMENT);
        editor.model.schema.removeDisallowedAttributes([newBlock], writer);
    });

    // Eye candy.
    view.scrollToTheSelection();

    return true;
}

function isEmptyishTextNode(node) {
    return node && node.is('$text') && !node.data.match(/\S/);
}

function isSoftBreakNode(node) {
    return node && node.is('element', 'softBreak');
}