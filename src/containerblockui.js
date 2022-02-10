/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module code-block/codeblockui
 */

import { Plugin } from 'ckeditor5/src/core';
import { Collection } from 'ckeditor5/src/utils';
import { Model, SplitButtonView, createDropdown, addListToDropdown } from 'ckeditor5/src/ui';

import { getNormalizedAndLocalizedcontainerDefinitions } from './utils';

import containerBlockIcon from '../theme/icons/containerblock.svg';
import '../theme/codeblock.css';

/**
 * The code block UI plugin.
 *
 * Introduces the `'codeBlock'` dropdown.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ContainerBlockUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'ContainerBlockUI';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const t = editor.t;
		const componentFactory = editor.ui.componentFactory;
		const normalizedcontainerDefs = getNormalizedAndLocalizedcontainerDefinitions( editor );

		componentFactory.add( 'containerBlock', locale => {
			const command = editor.commands.get( 'containerBlock' );
			const dropdownView = createDropdown( locale, SplitButtonView );
			const splitButtonView = dropdownView.buttonView;

			splitButtonView.set( {
				label: t( 'Insert code block' ),
				tooltip: true,
				icon: containerBlockIcon,
				isToggleable: true
			} );

			splitButtonView.bind( 'isOn' ).to( command, 'value', value => !!value );

			splitButtonView.on( 'execute', () => {
				editor.execute( 'containerBlock', {
					usePreviouscontainerChoice: true
				} );

				editor.editing.view.focus();
			} );

			dropdownView.on( 'execute', evt => {
				console.log(evt.source._containerBlockcontainer);
				editor.execute( 'containerBlock', {
					container: evt.source._containerBlockcontainer,
					forceValue: true
				} );

				editor.editing.view.focus();
			} );

			dropdownView.class = 'ck-container-block-dropdown';
			dropdownView.bind( 'isEnabled' ).to( command );

			addListToDropdown( dropdownView, this._getcontainerListItemDefinitions( normalizedcontainerDefs ) );

			return dropdownView;
		} );
	}

	/**
	 * A helper returning a collection of the `codeBlock` dropdown items representing containers
	 * available for the user to choose from.
	 *
	 * @private
	 * @param {Array.<module:code-block/codeblock~CodeBlockcontainerDefinition>} normalizedcontainerDefs
	 * @returns {Iterable.<module:ui/dropdown/utils~ListDropdownItemDefinition>}
	 */
	_getcontainerListItemDefinitions( normalizedcontainerDefs ) {
		const editor = this.editor;
		const command = editor.commands.get( 'containerBlock' );
		const itemDefinitions = new Collection();

		for ( const containerDef of normalizedcontainerDefs ) {
			const definition = {
				type: 'button',
				model: new Model( {
					_containerBlockcontainer: containerDef.container,
					label: containerDef.label,
					withText: true
				} )
			};
			
			console.log(definition);

			definition.model.bind( 'isOn' ).to( command, 'value', value => {
				return value === definition.model._containerBlockcontainer;
			} );

			itemDefinitions.add( definition );
		}

		return itemDefinitions;
	}
}
