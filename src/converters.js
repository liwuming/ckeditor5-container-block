/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module code-block/converters
 */

import { getPropertyAssociation } from './utils';

export function modelToViewContainerBlockInsertion(model, containerDefs, useLabels = false) {

    const containersToClasses = getPropertyAssociation(containerDefs, 'container', 'class');

    return (evt, data, conversionApi) => {
        const { writer, mapper, consumable } = conversionApi;

        if (!consumable.consume(data.item, 'insert')) {
            return;
        }

        //const container = data.item.getAttribute( 'class' );

        const targetViewPosition = mapper.toViewPosition(model.createPositionBefore(data.item));
        const attributes = { 'class': data.item.getAttribute('class') };


        const blockquote = writer.createContainerElement('blockquote', attributes);
        const p = writer.createContainerElement('p', null);

        writer.insert(writer.createPositionAt(blockquote, 0), p);
        writer.insert(targetViewPosition, blockquote);
        mapper.bindElements(data.item, p);
    };
}


export function modelToDataViewSoftBreakInsertion(model) {
    return (evt, data, conversionApi) => {
        if (data.item.parent.name !== 'containerBlock') {
            return;
        }

        const { writer, mapper, consumable } = conversionApi;

        if (!consumable.consume(data.item, 'insert')) {
            return;
        }

        const position = mapper.toViewPosition(model.createPositionBefore(data.item));

        writer.insert(position, writer.createText('\n'));
    };
}

export function dataViewToModelContainerBlockInsertion(editingView, containerDefs) {

    const classesTocontainers = getPropertyAssociation(containerDefs, 'class', 'container');
    const defaultcontainerName = containerDefs[0].container;

    return (evt, data, conversionApi) => {
        const viewCodeElement = data.viewItem;
        const viewPreElement = viewCodeElement.parent;

        if (!viewPreElement || !viewPreElement.is('element', 'pre')) {
            return;
        }

        // In case of nested code blocks we don't want to convert to another code block.
        if (data.modelCursor.findAncestor('containerBlock')) {
            return;
        }

        const { consumable, writer } = conversionApi;

        if (!consumable.test(viewCodeElement, { name: true })) {
            return;
        }

        const containerBlock = writer.createElement('containerBlock');
        const viewChildClasses = [...viewCodeElement.getClassNames()];

        // As we're to associate each class with a model container, a lack of class (empty class) can be
        // also associated with a container if the container definition was configured so. Pushing an empty
        // string to make sure the association will work.
        if (!viewChildClasses.length) {
            viewChildClasses.push('');
        }

        // Figure out if any of the <code> element's class names is a valid programming
        // container class. If so, use it on the model element (becomes the container of the entire block).
        for (const className of viewChildClasses) {
            const container = classesTocontainers[className];

            if (container) {
                writer.setAttribute('class', container, containerBlock);
                break;
            }
        }

        // If no container value was set, use the default container from the config.
        if (!containerBlock.hasAttribute('class')) {
            writer.setAttribute('class', defaultcontainerName, containerBlock);
        }

        conversionApi.convertChildren(viewCodeElement, containerBlock);

        // Let's try to insert code block.
        if (!conversionApi.safeInsert(containerBlock, data.modelCursor)) {
            return;
        }

        consumable.consume(viewCodeElement, { name: true });

        conversionApi.updateConversionResult(containerBlock, data);
    };
}

export function dataViewToModelTextNewlinesInsertion() {
    return (evt, data, { consumable, writer }) => {
        let position = data.modelCursor;

        // When node is already converted then do nothing.
        if (!consumable.test(data.viewItem)) {
            return;
        }

        // When not inside `codeBlock` then do nothing.
        if (!position.findAncestor('containerBlock')) {
            return;
        }

        consumable.consume(data.viewItem);

        const text = data.viewItem.data;
        const textLines = text.split('\n').map(data => writer.createText(data));
        const lastLine = textLines[textLines.length - 1];

        for (const node of textLines) {
            writer.insert(node, position);
            position = position.getShiftedBy(node.offsetSize);

            if (node !== lastLine) {
                console.log(22211);
                const softBreak = writer.createElement('softBreak');

                writer.insert(softBreak, position);
                position = writer.createPositionAfter(softBreak);
            }
        }

        data.modelRange = writer.createRange(
            data.modelCursor,
            position
        );
        data.modelCursor = position;
    };
}