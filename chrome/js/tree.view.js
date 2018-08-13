//================================================
// RootFolder
//================================================
class RootFolder extends Backside.View{
	// @param {Object} config
	// @param {Model} config.model
	// @param {Object} config.settings
	constructor(config){
		super(config);
		this.children = [];
		this._opened = [];
	}
	// Append root folder
	append(model){
		var 	view = new BookFolderView({model: model}, this);

		this.controls.tree.appendChild(view.el);
		this.children.push(view);
		view.postInitialize();
		return view;
	}
	registerOpened(view){
		this._opened.push(view);
		this._sinchronizeOpened();
	}
	registerClosed(view){
		var pos = this._opened.indexOf(view);

		if(pos != -1){
			this._opened.splice(pos, 1);
		}
		this._sinchronizeOpened();
	}
	// @param {Array<View>}
	closeAll(exludeViews){
		var 	i = this._opened.length, view;


		while(i-- > 0){
			if(!exludeViews.includes(this._opened[i])){
				view = this._opened[i];
				// Attention: don't try to change on change('isOpened', false)
				view.model.set('isOpened', false);
				view.toggle(false);
				this._opened.splice(i, 1);
			}
		}
		this._sinchronizeOpened();
	}
	postInit(){
		// Define event listeners
		var onScrollHandler = function(e){
			this.model.change('topPos', this.controls.tree.scrollTop);
		}.bind(this);

		this.controls.tree.onscroll = onScrollHandler;

		// @param {Object} config - c
		this.listen(':configure', function(c){
			// console.group();
			// console.log('TRIG Configure');
			// console.dir(c.opened);
			// console.dir(c);
			// console.dir(this.children);
			// console.groupEnd();

			for(var view of this.children){
				if(c.opened.includes(view.model.get('id'))){
					view.resetOpened(c.opened);
				}
			}

			this.model.set('opened', c.opened);
			this.model.set('topPos', c.topPos);

			// Implement config.settings
			if(c.settings.popup_width) this.el.style.width = c.settings.popup_width + 'px';
			if(c.settings.popup_height) this.el.style.height = c.settings.popup_height + 'px';
			if(c.settings.popup_limitedWidth) this.el.classList.add('__limited-width');
			if(c.settings.popup_upcaseHeader) this.el.classList.add('__uppercase-header');
			if(c.settings.popup_fontSize) this.el.style.fontSize = c.settings.popup_fontSize + 'px';

			// Add css styles
			document.documentElement.style.setProperty('--font-color', c.settings.popup_fontColor);
			document.documentElement.style.setProperty('--counter-color', c.settings.popup_counterColor);
			PlatformApi.openBookmarkInNewTab = c.settings.action_openBookmarkInNewTab;
			PlatformApi.activateTab = c.settings.action_activateTab; 
			this._hideOpened = c.settings.action_hideOpened;

			// Set top offset
			this.controls.tree.scrollTop = c.topPos;
			
			setTimeout(()=>{
				this.controls.tree.scrollTop = c.topPos;
				this.controls.searchInput.focus();
			}, 200);
		});

		this.controls.searchInput.setAttribute('placeholder', PlatformApi._('Search'));

		this._searchDebounce = Backside._.debounce(function(query){
			if(query){
				this.controls.closeBtn.style.display = '';
			}else{
				this.controls.closeBtn.style.display = 'none';
			}

			console.log('Query `%s`', query);

			if (query.length > 2) {
				this.model.filter(query);	
			}
		}.bind(this), 300);

		this._prebindEvents({
			'oninput searchInput': function(e){
				this._searchDebounce(e.target.value);
			},
			'onclick closeBtn': function(){
				this.model.filter();
				this.controls.searchInput.value = '';
				this.controls.closeBtn.style.display = 'none';
			},
		});

		this.listen(':filter', function(ids){
			if(ids.length > 0){
				this.model.change('mode', 'filter');
				this.controls.tree.scrollTop = 0; // setTop at 0:
				this.filter(ids, true);
			}else{
				this.filter(this.model.get('opened'));
				// restore top offset:
				this.controls.tree.scrollTop = this.model.get('topPos');
			}
		});
		this.listen('change:mode', function(mode, m){
			// Turn off listeneing scroll while at filter mode:
			this.controls.tree.onscroll = mode != 'filter' && onScrollHandler;
		});
	}
	_sinchronizeOpened(){
		var ids = [];

		for(var view of this._opened){
			ids.push(view.model.get('id'));
		}
		this.model.change('opened', ids);
	}
	// @param {Array<string>} ids
	// @param {Bool} hideNotRelevant
	filter(ids, hideNotRelevant){
		for(var view of this.children){
			view.postInitialize();
			view.filter(ids, hideNotRelevant);
		}
	}
	openContext(e, _view){
		var 	options = [],
				_this = this;

		if(_view instanceof BookFolderView){
			// Operations for folders
			options = options.concat([{	
					label: PlatformApi._('openAllBookmarks'),
					action: function(view){
						var _links = [];

						view.walk(function(bookmark){
							if(!bookmark.model.isFolder()){
								_links.push(bookmark.getLink());
							}
						})
						
						PlatformApi.openBookmarkCollection(_links);
					}
				}, {	
					label: PlatformApi._('remove'), // Remove folder
					action: function(view){
						var removeDialog = new DialogPopup({
							options: {
								target: view,
							},
							events: {
								'onsubmit form': function(e){
									e.preventDefault();

									var 	_view = this.options.target,
											id = _view.model.get('id'),
											_parent = _view.parent;

									PlatformApi.removeFolder(id, function(){
										if(_parent.detachChild(_view)){
											if(_view.model.get('isOpened')){
												_parent.root.registerClosed(_view);	
											}
											
											_view.remove();
										} 
									});
									this.close();
								}
							},
							body: 
								'<form class="nm_middle" data-co="form">' +
									'<div class="nm_remove-dialog_mes">' +
										'<p data-co="mes-question"></p>' +
										'<p data-co="mes-text"></p>' +
									'</div>' +
									'<button class="nm_btn nm_submit-btn" type="submit">' + PlatformApi._('removeDir_ok') + '</button>' +
								'</form>' +
								'<div class="nm_middle-helper"></div>' +
							'',
							// onclose: function(view){},
							onopen: function(view){
								var 	_bookmark = view.options.target,
										_folderCount = 1,
										_linkCount = 0;


								_bookmark.walk(function(bookmark){
									if(bookmark.model.isFolder()){
										_folderCount++;
									}else{
										_linkCount++;
									}
								});

								view.controls.mesQuestion.innerHTML = PlatformApi._('removeDir_removeQuestion').replace('{1}', Backside._.escape(_bookmark.model.get('title')));
								view.controls.mesText.innerHTML = PlatformApi._('removeDir_wouldBeRemoved')
									+ (_linkCount > 0 ? Backside._.supplant(PlatformApi._('removeDir_totalLinks'), {
										'<': '<b>',
										'>': '</b>',
										count: _linkCount,
										entity: _helpers.plural(_linkCount, ...(PlatformApi._('removeDir_linkForms').split('|')))
									}) + PlatformApi._('removeDir_and') : '')
									+ Backside._.supplant(PlatformApi._('removeDir_totalBookmarks'), {
										'<': '<b>',
										'>': '</b>',
										count: _folderCount,
										entity: _helpers.plural(_folderCount, ...(PlatformApi._('removeDir_bookmarkForms').split('|')))
									});
							},
						});

						_this.el.appendChild(removeDialog.el);				
					}
				}, {	
					label: PlatformApi._('renameBookmark'),
					action: function(view){
						var editDialog = createEditDialog(view);
						
						_this.el.appendChild(editDialog.el);
					}
				}, {	
					label: PlatformApi._('addCurrentTab'),
					action: function(view){

						// Here bug

						PlatformApi.getActiveTabUrl(function(tabObj){
							PlatformApi.createBookmark(tabObj, view.model.get('id'), function(model){
								var newLink = view.createChildBookmark(model);
								newLink.postInitialize();
							});
						});
					}
				}, {	
					label: PlatformApi._('createSubsection'),
					action: function(view){
						// TODO 

						PlatformApi.createSubFolder(PlatformApi._('newDir'), view.model.get('id'), function(model) {
							model.set('isOpened', true);
							var newDir_View = view.createChildBookmark(model);
							newDir_View.postInitialize();
							newDir_View.root.registerOpened(newDir_View);
							newDir_View._show();

							var editDialog = createEditDialog(newDir_View, null, true);
							
							_this.el.appendChild(editDialog.el);
						});
					}
				}]);
		}else{
			// Operations for links
			options = options.concat([{	
					label: PlatformApi._('openAtCurrentTab'),
					action: function(view){
						PlatformApi.openAtCurrentTab(view.getLink());
					}
				}, {	
					label: PlatformApi._('openAtNewTab'),
					action: function(view){
						PlatformApi.openInNewTab(view.getLink());
					}
				}, {	
					label: PlatformApi._('openAtNewWindow'),
					action: function(view){
						PlatformApi.openInNewWindow(view.getLink(), false);
					}
				}, {	
					label: PlatformApi._('openAtIncognito'),
					action: function(view){
						PlatformApi.openInNewWindow(view.getLink(), true);
					}
				}, {	
					label: PlatformApi._('remove'),
					action: function(view){
						var 	id = view.model.get('id');

						PlatformApi.removeLinkMark(id, function(){
							if(view.parent.detachChild(view)) view.remove();
						});
					}
				}, {	
					label: PlatformApi._('edit'),
					action: function(view){
						var editDialog = createEditDialog(_view);
						
						_this.el.appendChild(editDialog.el);
					}
				}, {	
					label: PlatformApi._('copyLinkUrl'),
					action: function(view){
						document.oncopy = function(e) {
							e.clipboardData.setData('text/plain', view.getLink());
							e.preventDefault();
						};
						document.execCommand('Copy', false, null);
					}
				}]);
		}

		if(_view.model.get('isGrouped')){
			options = options.concat([{	
					splitter: true,
				}, {	
					label: PlatformApi._('openAllSelected'),
					action: function(view){
						var 	_urls = []; // open all selected

						view.root.walk(function(bookmark){
							if(bookmark.model.get('isGrouped')){
								_urls.push(bookmark.model.get('url'));
							}
						});
						PlatformApi.openBookmarkCollection(_urls);
					}
				}, {	
					label: PlatformApi._('removeAllSelected'),
					action: function(view){
						var removeDialog = new DialogPopup({
							options: {
								target: view,
							},
							events: {
								'onsubmit form': function(e){
									e.preventDefault();
									// Remove in reverse order
									var 	i = this._bookmarksForRemoving.length,
											_c = i;

									while(i-- > 0){
										(function(bookmark, _popup){
											if(bookmark.model.isFolder()){
												PlatformApi.removeFolder(bookmark.model.get('id'), function(){
													var 	parent = bookmark.parent;

													if(parent.detachChild(bookmark)){
														if(bookmark.model.get('isOpened')){
															parent.root.registerClosed(bookmark);	
														}
														bookmark.remove();
														
														if(--_c == 0){
															_popup.close();
														} 
													} 
												});
											}else{
												PlatformApi.removeLinkMark(bookmark.model.get('id'), function(){
													if(bookmark.parent.detachChild(bookmark)){
														bookmark.remove();
														
														if(--_c == 0){
															_popup.close();
														}
													} 
												});					
											}	
										}(this._bookmarksForRemoving[i], this));
									}
								}
							},
							body: 
								'<form class="nm_middle" data-co="form">' +
									'<div class="nm_remove-dialog_mes">' +
										'<p data-co="mes-question"></p>' +
										'<p data-co="mes-text"></p>' +
									'</div>' +
									'<button class="nm_btn nm_submit-btn" type="submit">' + PlatformApi._('removeDir_ok') + '</button>' +
								'</form>' +
								'<div class="nm_middle-helper"></div>' +
							'',
							onclose: function(view){
								view._bookmarksForRemoving.length = 0;
							},
							onopen: function(view){
								var 	_bookmark = view.options.target,
										_folderCount = 0, // different
										_linkCount = 0;

								// Attention: remove bookmarks in reverse order!
								view._bookmarksForRemoving = [];

								// Different:
								_bookmark.root.walk(function(bookmark){
									if(bookmark.model.get('isGrouped')){
										view._bookmarksForRemoving.push(bookmark);

										if(bookmark.model.isFolder()){
											_folderCount++;
										}else{
											_linkCount++;
										}	
									}
								});

								view.controls.mesQuestion.style.display = '';
								view.controls.mesText.innerHTML = PlatformApi._('removeDir_wouldBeRemoved')
									+ (_linkCount > 0 ? Backside._.supplant(PlatformApi._('removeDir_totalLinks'), {
										'<': '<b>',
										'>': '</b>',
										count: _linkCount,
										entity: _helpers.plural(_linkCount, ...(PlatformApi._('removeDir_linkForms').split('|')))
									}) : '')
									+ (_folderCount > 0 ? PlatformApi._('removeDir_and') + Backside._.supplant(PlatformApi._('removeDir_totalBookmarks'), {
										'<': '<b>',
										'>': '</b>',
										count: _folderCount,
										entity: _helpers.plural(_folderCount, ...(PlatformApi._('removeDir_bookmarkForms').split('|')))
									}) : '');
							},
						});

						_this.el.appendChild(removeDialog.el);
					}
				}, {	
					label: PlatformApi._('deselectAll'),
					action: function(view){
						view.root.walk(function(bookmark){
							bookmark.model.change('isGrouped', false);
						});
					}
				}]);
		}

		var contextMenu = new ContextMenu({
			target: _view,
			options: options
		});
		var offset = this.el.getBoundingClientRect();
		this.el.appendChild(contextMenu.el);

		contextMenu.open(e.clientX - offset.left, e.clientY - offset.top)
		
	}
	// @param {Function} next(View)
	walk(next){
		for(var view of this.children){
			if(next(view)){
				break;
			}
			if(view.model.isFolder()){
				view.walk(next);
			}
		}
	}
}

//================================================
// BookFolderView
//================================================	
function BookFolderView(config, parent){
	this.parent = parent;
	this.root = parent.root || parent;

	this.children = []; // not supported iteration with `for ... of`
	this._inited = false;
	Backside.View.call(this, config);
};

BookFolderView.prototype = Object.create(Backside.View.prototype);
BookFolderView.prototype.constructor = Backside.View;
BookFolderView.prototype.resetOpened = function(opened){
	if(opened.includes(this.model.get('id'))){
		this.controls.favicon.classList.add('__opened');
		this.controls.list.style.height = 'auto'; 
		this.controls.list.classList.remove('__closed');
		this.model.set('isOpened', true);
		this.root.registerOpened(this);

		for(var view of this.children){
			view.postInitialize();

			if(view.model.isFolder()){
				view.resetOpened(opened);
			}
		}
	}else{
		this.controls.list.style.height = 0; 
		this.controls.list.classList.add('__closed');
	}
}
// @param {Array} list
BookFolderView.prototype.append = function(list, opened){
	var view, data, model;

	for(var i = 0; i < list.length; i++){
		data = {
			id: list[i].id,
			title: list[i].title, 
			index: list[i].index,
			parentId: list[i].parentId,
			// isOpened: (opened.indexOf(list[i].id) != -1)
		};
		
		if(list[i].hasOwnProperty('url')) data.url = list[i].url;

		model = new BookmarksModel(data);

		if(model.isFolder()){
			view = new BookFolderView({model: model}, this);
			view.append(list[i].children, opened);
		}else{
			view = new BookLinkView({model: model}, this);
		}
		this.children.push(view);
		this.controls.list.appendChild(view.el);
		this.model.change('count', this.children.length); // update counter for inited folders
	}
};

BookFolderView.prototype.className = 'nm_bmark nm_bmark-foldermark';
BookFolderView.prototype.initialize = function(config){
	this.el = document.createElement(config.tagName || this.tagName || 'div');
	this.el.className = config.className || this.className || '';
	this.model = config.model;
	this.render();
	this.controls.list.style.height = 0;
	this.controls.list.classList.add('__closed');
};
// Navigate from parent to child view
// @param {Function} next(View)
BookFolderView.prototype.walk = function(next){
	for(var view of this.children){
		if(next(view)){
			break;
		}
		if(view.model.isFolder()){
			view.walk(next);
		}
	}
};
// Navigate from child to parent view
// @param {Function} next(View)
BookFolderView.prototype.downWalk = function(next){
	var 	cur = this;

	while(cur){
		if(cur.parent){
			if(next(cur)) break;
		}
		cur = cur.parent;
	}
};

BookFolderView.prototype.postInitialize = function(){
	this._inited = true;
	this.controls.title.textContent = this.model.get('title') || 'noname';
	this.el.dataset.id = this.model.get('id');
	this.controls.counter.style.display = '';

	this.listen('change:count', function(newCount){
		this.controls.counter.textContent = newCount;
	});
	this.listen('change:isGrouped', function(newValue, model){
		_helpers.toggleClass(this.el, '__grouped', newValue);

		var i = this.children.length;

		while(i-- > 0){
			this.children[i].model.change('isGrouped', newValue);
		}
	});
	this.listen('change:isOpened', function(isOpened, model){
		// Animated opening:
		this.toggle(isOpened);
	});
	this.listen('change:title', function(newValue){
		this.controls.title.textContent = newValue || 'noname';
	});
	// Attention: there are no ontransitionend event property
	this.on('list', 'webkitTransitionEnd', function(e){
		if(e.propertyName != "height") return;
		
		var heightStyle = e.target.style.height;

		if(heightStyle != "0px") e.target.style.height = 'auto';
	});
	
	this.controls.wrap.draggable = this.model.get('parentId') > 0;
	this.controls.wrap.setAttribute('dropzone', 'move');
	this.controls.title.setAttribute('dropzone', 'move');
	this.model.change('count', this.children.length);
	this._unbindEventsHandlers = this._prebindEvents(this.events);
};
BookFolderView.prototype.events = {
	'ondrop wrap': function(e){
		e.stopPropagation();
		var 	$wrap,
				$transferView = this.root._dnd_view,
				isChild = false;

		if(e.target == this.controls.title){
			$wrap = this.controls.title;
		}else{
			$wrap = this.controls.wrap;
		}

		$wrap.style.borderBottom = '';
		$wrap.style.color = '';

		// Prevent dropping parent view at child
		this.downWalk(function(parentView){
			if(parentView == $transferView){
				return isChild = true;
			}
		});

		if(!isChild && $transferView){
			if($wrap == this.controls.title){ // insert in folder
				let 	_parent = this;

				PlatformApi.moveBookmark($transferView.model.get('id'), _parent.model.get('id'), function(updMark){
					$transferView.parent.detachChild($transferView);
					$transferView.model.set('index', updMark.index);
					_parent.attachChild($transferView);
				});
			}else{ // paste after folder
				let 	_prev = this;

				PlatformApi.moveBookmarkAfter($transferView.model.get('id'), _prev.model.get('id'), function(updMark){
					$transferView.parent.detachChild($transferView);
					$transferView.model.set('index', updMark.index);
					_prev.parent.attachChild($transferView);
				});
			}
		}

		this.root._dnd_view = null;
	},
	'ondragend wrap': function(e){
		e.stopPropagation();	
		e.preventDefault(); 
	},
	'ondragstart wrap': function(e){
		e.stopPropagation();
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('bid', this.model.get('id'));
		// e.dataTransfer.setData("text/plain", "Text to drag");
		this.root._dnd_view = this;
	},
	'ondragleave wrap': function(e){
		e.preventDefault(); 
		e.stopPropagation();
		var 	$wrap;

		if(e.target == this.controls.title){
			$wrap = this.controls.title;
		}else{
			$wrap = this.controls.wrap;
		}

		$wrap.style.borderBottom = '';
		$wrap.style.color = '';
	},
	'ondragover wrap': function(e){
		e.stopPropagation();
		e.preventDefault();
		var 	$wrap;

		if(e.target == this.controls.title){
			$wrap = this.controls.title;
		}else{
			$wrap = this.controls.wrap;
		}

		$wrap.style.borderBottom = '2px solid #aaa';
		$wrap.style.color = '#DF2414';
	}, 
	'oncontextmenu favicon': function(e){
		e.stopPropagation();
	},
	'oncontextmenu wrap': function(e){
		e.stopPropagation();
		e.preventDefault();
		this.root.openContext(e, this);
	},
	'onclick favicon': function(e){
		e.stopPropagation();
		this.model.change('isGrouped', !this.model.get('isGrouped'))
	},
	'onblur wrap': function(){ // clear reference on view if bookmark is last focused
		if(this.root.lastFocusedView == this){
			this.root.lastFocusedView = null;
		}
	},
	// For focus behaviour
	// Save link on this view as last focused at treeView. Idea - catch keydown at treeView and handle click events/
	'onfocus wrap': function(){
		this.root.lastFocusedView = this;
	},
	'onclick wrap': function(){
		this.model.change('isOpened', !this.model.get('isOpened'));
	},

};

// Filter tree nodes
// @param {Array<string>} ids
// @param {Bool} hideNotRelevant
BookFolderView.prototype.filter = function(ids, hideNotRelevant){ 
	var 	status = false, 
			// Folder status - relevant all child items?
			folderIsRelevant = ids.includes(this.model.get('id')),
			childStatus;

	for(var view of this.children){
		if(view.model.isFolder()){
			if(childStatus = view.filter(ids, hideNotRelevant)){ 
				status = true;
			}
		}else{
			if(
				(childStatus = ids.includes(view.model.get('id'))) //|| folderIsRelevant
			){ 
				view.postInitialize();
				status = true; 
				view.el.style.display = '';
			}else{
				view.el.style.display = hideNotRelevant ? 'none' : '';	
			}
		}

		if(folderIsRelevant){
			view.postInitialize();
			view.el.style.display = '';	
		}
	}

	if(folderIsRelevant){
		status = true;
	}

	this.model.set('isOpened', status);

	if(status){
		this.postInitialize();
		this.el.style.display = '';
		this._show();
	}else{
		this._hide();
		this.el.style.display = hideNotRelevant ? 'none': '';	
	}

	return status;
};
// APPROVED
// Expending without animation
BookFolderView.prototype._show = function(){
	this.controls.list.style.height = 'auto';
	this.controls.list.classList.remove('__closed');
	this.controls.favicon.classList.add('__opened');
}
// APPROVED
BookFolderView.prototype._hide = function(isShow){
	this.controls.list.style.height = 0; 
	this.controls.list.classList.add('__closed');
	this.controls.favicon.classList.remove('__opened');
}
// APPROVED
// @param {Bool} isShow
BookFolderView.prototype.toggle = function(isShow){
	var 	$list = this.controls.list,
			parentView = this.parent;

	if(parentView instanceof BookFolderView){
		parentView.controls.list.style.height = 'auto';
	}

	if(isShow){
		for(var view of this.children){
			view.postInitialize();

			if(this.root.model.get('mode') == 'filter'){
				view.el.style.display = '';
			}
		}

		if(this.root._hideOpened){
			let 	parents = [], // folders that need to stay opened
					cur = this;

			while(cur){
				if(cur.parent){
					parents.push(cur);
				}
				cur = cur.parent;
			}

			this.root.closeAll(parents); // close all not parent folders
		}
		$list.style.height = $list.scrollHeight + 'px';
		this.controls.list.classList.remove('__closed');
		this.controls.favicon.classList.add('__opened');
		this.root.registerOpened(this);
	}else{
		if($list.style.height == 'auto' || !$list.style.height){
			$list.style.height = $list.scrollHeight + 'px';
		} 
		
		setTimeout(function(){ // fix js optimisation
			$list.style.height = 0;
		}, 0);
		this.controls.list.classList.add('__closed');
		this.controls.favicon.classList.remove('__opened');
		this.root.registerClosed(this);
	}
};

BookFolderView.prototype.template =
	'<div tabindex="1" class="nm_bmark_title-wrap" data-co="wrap" >' +
		'<span class="nm_bmark_title" data-co="title"></span>' +
		'<span class="nm_bmark_favicon" data-co="favicon"></span>' +
		'<span class="nm_bmark_counter" data-co="counter" style="display:none" >0</span>' +
		'<span class="nm_middle-helper"></span>' +
	'</div>' +
	'<div class="nm_bmark_list" data-co="list"></div>' +
	'';

// APPROVED
// Only detach child view from parent. Then you can destroy view or append to another folder.
// @param {BookFolderView|LinkFolderView} view
// @return {Bool} - success status
BookFolderView.prototype.detachChild = function(view){
	var 	pos = this.children.indexOf(view);

	if(pos != -1 && view.parent == this){
		this.model.change('count', this.model.get('count') - 1);
		this.children.splice(pos, 1);
		view.parent	= null;
		return true;
	}else{
		console.warn('Attantion. There is attempt to detach unrelative child from parent view!');
		console.dir(view);
		console.dir(this);
	}
}
// APPROVED
// Attach child View and inserted at position defined by `index` property
// @param {BookFolderView|LinkFolderView} view
BookFolderView.prototype.attachChild = function(view){
	let 	pos = view.model.get('index');

	view.parent = this;
	this.model.change('count', this.model.get('count') + 1);
	
	if(pos != undefined){
		let 	next = this.children[pos /*+ 1*/]; // if this is last element, it woulb be inserted in the end of
		
		this.children.splice(pos, 0, view);
		this.controls.list.insertBefore(view.el, next && next.el);
	}else{ // add in the end 
		this.children.push(view);
		this.controls.list.appendChild(view.el);
	}
};
// APPROVED
// Create view from model and append at bookmark list
// @areturn {BookFolderView | BookLinkView}
BookFolderView.prototype.createChildBookmark = function(model){
	var 	view = new (model.isFolder() ? BookFolderView : BookLinkView)({
				model: model
			}, this);

	this.attachChild(view);

	if(model.isFolder()){
		this.root.registerOpened(view);
	}
	return view;
};
// @memberOf BookFolderView - remove bookmark
BookFolderView.prototype.remove = function(){
	for(var vid in this.children){
		this.children[vid].remove();
	}
	if(this.root.lastFocusedView == this){
		this.root.lastFocusedView = null;
	}
	if(this._unbindEventsHandlers) this._unbindEventsHandlers();
	Backside.View.prototype.remove.call(this);
};


//================================================
// BookLinkView
//================================================	
function BookLinkView(config, parent){
	Backside.View.call(this, config);
	this.parent = parent;
	this.root = parent.root || parent;
	this._inited = false;

	if(this.parent.model.get('isOpened') || this.parent instanceof RootFolder){
		this.postInitialize();
	}
};
BookLinkView.prototype = Object.create(Backside.View.prototype);
BookLinkView.prototype.constructor = Backside.View;
BookLinkView.prototype.className = 'bmark';
BookLinkView.prototype.initialize = function(config){
	this.el = document.createElement(config.tagName || this.tagName || 'div');
	this.el.className = config.className || this.className || '';
	this.model = config.model;
};
BookLinkView.prototype.postInitialize = function(){
	if (this._inited) return;
	this._inited = true;

	this.el.setAttribute('title', this.model.get('url'));
	this.el.tabIndex = 1;
	// Less operations on manial creation:
	this.controls.favicon = document.createElement('span');
	this.controls.favicon.className = 'nm_bmark_favicon';
	this.controls.favicon.style.backgroundImage = PlatformApi.getFavicon(this.model.get('url'));
	this.controls.title = document.createTextNode(this.model.get('title') || 'noname');
	this.el.appendChild(this.controls.favicon);
	this.el.appendChild(this.controls.title);

	this._unListener = this._prebindEvents({
		// Previous solution
		// 'onclick': function(){
		// 	PlatformApi.openBookmark(this.getLink());
		// },
		'onclick': function(e){
			if(this._timer){
				clearTimeout(this._timer);
				var editDialog = createEditDialog(this);
							
				this.root.el.appendChild(editDialog.el);
				this._timer = null;
			}else{
				this._timer = setTimeout(()=>{
					PlatformApi.openBookmark(this.getLink());
					this._timer = null;
				}, 200);	
			}			
		},
		'onfocus': function(){
			this.root.lastFocusedView = this;
		},
		'onblur': function(){
			if(this.root.lastFocusedView == this){
				this.root.lastFocusedView = null;
			}
		},
		'onclick favicon': function(e){
			e.stopPropagation();
			this.model.change('isGrouped', !this.model.get('isGrouped'));
		},
		'oncontextmenu': function(e){
			e.stopPropagation();
			e.preventDefault();
			this.root.openContext(e, this);
		},
		'oncontextmenu favicon': function(e){
			e.stopPropagation();
		},
		// DnD
		'ondragover': function(e){
			e.stopPropagation();
			e.preventDefault();
			e.target.style.borderBottom = '2px solid #aaa';
			e.target.style.color = '#DF2414';
		},
		'ondragleave': function(e){
			e.preventDefault(); 
			e.stopPropagation();
			e.target.style.borderBottom = '';
			e.target.style.color = '';
		},
		'ondragstart': function(e){
			e.stopPropagation();
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('bid', this.model.get('id'));
			// e.dataTransfer.setData("text/plain", "Text to drag");
			this.root._dnd_view = this;
		},
		'ondragend': function(e){
			e.stopPropagation();	
			e.preventDefault(); 
		},
		'ondrop': function(e){
			e.stopPropagation();
			var 	$transferView = this.root._dnd_view,
					isChild = false;

			this.el.style.borderBottom = '';
			this.el.style.color = '';

			// Prevent dropping parent view at child
			this.parent.downWalk(function(parentView){
				// console.log('parentView:');
				// console.dir(parentView);
				if(parentView == $transferView){
					return isChild = true;
				}
			});


			if(!isChild && $transferView){
				let 	_prev = this;

				PlatformApi.moveBookmarkAfter($transferView.model.get('id'), _prev.model.get('id'), function(updMark){
					$transferView.parent.detachChild($transferView);
					$transferView.model.set('index', updMark.index);
					_prev.parent.attachChild($transferView);
					// Maybe unnecessery
					// $4.appendAfter(_prev.el, $transferView.el);
				});
			}else{
				console.warn('Drop child');
				console.dir($transferView);
			}

			this.root._dnd_view = null;
		}

	});

	this.listen('change:isGrouped', function(newValue, prop, model){
		_helpers.toggleClass(this.el, '__grouped', newValue);
	});
	this.listen('change:title', function(newValue){
		console.log('[change:title] `%s`', newValue);
		this.controls.title.textContent = newValue || 'noname';
	});
	this.listen('change:url', function(newValue){
		this.el.setAttribute('title', newValue);
		this.controls.favicon.style.backgroundImage = PlatformApi.getFavicon(newValue); 			
	});

	// DND:
	this.el.draggable = true;
	this.el.setAttribute('dropzone', 'move');
};
BookLinkView.prototype.remove = function(){
	if(this._unListener){
		this._unListener();
		this._unListener = null;	
	} 
	if(this.root.lastFocusedView == this) this.root.lastFocusedView = null;
	Backside.View.prototype.remove.call(this);
};
BookLinkView.prototype.getLink = function(){
	return this.model.get('url').replace('{rand}', ~~(Math.random() * 100000));
};

//================================================
// ContextMenu
//================================================	
class ContextMenu extends Backside.View{
	// @param {BookFolderView|BookLinkView} config.target - Component called Context menu
	constructor(config){
		super(config);
		this.target = config.target;
	}
	initialize(config){
		this.actions = {};
		this.el = document.createElement('div');
		this.el.className = 'nm_context-wrap';
		this.controls.menu = document.createElement('div');
		this.controls.menu.className = 'nm_context-menu';
		this.el.appendChild(this.controls.menu);
		
		this.controls.menu.appendChild(_helpers.crList(config.options, function(item, index){
			var $node = document.createElement('div');

			if(item.action){
				$node.className = 'nm_context-item';
				$node.textContent = item.label;
				$node.dataset.id = index;
				this.actions[index] = item.action;
			}else{
				$node.className = 'nm_context-splitter';
			}

			return $node;
		}.bind(this)));

		this._destroyListeners = this._prebindEvents(this.events);	
	}
	position(Mx, My){
		var 	dW = this.el.scrollWidth - this.controls.menu.scrollWidth,
				dH = this.el.offsetHeight - this.controls.menu.offsetHeight,
				posX,
				posY;

		posX = Mx < dW ? Mx -5: dW -10;
		posY = My < dH ? My -5: dH -10;

		this.controls.menu.style.left = posX + 'px';
		this.controls.menu.style.top = posY + 'px';
	}
	remove(){
		this.actions.length = 0;
		this._destroyListeners();
		this.target.el.classList.remove('__active');
		this.target = null;
		super.remove();
	}
	open(x, y){
		this.position(x, y);
		this.target.el.classList.add('__active');
	}
}
ContextMenu.prototype.events = {
	'onclick menu': function(e){
		e.stopPropagation();

		var 	id = e.target.dataset.id,
				action = this.actions[id];

		if(action){
			action(this.target);
			this.remove();
		}else{
			console.warn('Unknown action with id: %s label: %s', id, e.target.textContent);
		}
	},
	'onmouseout menu': function(e){
		var 	$target = e.toElement || e.relatedTarget,
				$menu = this.controls.menu;

		if(!(
			$target === $menu || $menu.contains($target)
		)){
			this.remove();
		}

	},
	'onclick': function(e){
		var 	$target = e.toElement || e.relatedTarget,
				$menu = this.controls.menu;

		if(!(
			$target === $menu || $menu.contains($target)
		)){
			this.remove();
		}	
	}
};
//================================================
// DialogPopup
//================================================	
class DialogPopup extends Backside.View{
	constructor(conf){
		super(conf);
		this.options = conf.options;

		if(conf.onclose) this.onclose = conf.onclose;
		if(conf.events){
			this._destroyListeners = this._prebindEvents(conf.events);	
		} 
		
		this.on('close', 'click', function(){
			this.close();
		}.bind(this));

		if(conf.onopen) conf.onopen(this);
	}
	initialize(conf){
		this.el = document.createElement('div');
		this.el.className = 'nm_dialog ' + conf.className;
		this.el.innerHTML = this.template.replace('{content}', conf.body);
		this.bindByData(this.el);
	}
	close(){
		if(this.onclose) this.onclose(this);
		if(this._destroyListeners) this._destroyListeners();

		super.remove();
	}
}
DialogPopup.prototype.template =
	'<div class="nm_dialog_close" data-co="close">' +
		'<i class="nm-icon nm-icon_close"></i>' +
	'</div>' +
	'<div class="nm_dialog_content" data-co="content">{content}</div>' +
	'';

// @param _bookmark - config.bookmark
// @param _tree - config.tree
// @param {Boolean} _onlyTitle - edit only title 
function createEditDialog(view, oncomplete, _onlyTitle=false){
	// Collection of event handlers
	var handlers = {
		'onkeydown title': function(e){
			if(e.keyCode == 13){
				e.preventDefault();
				this.options.submit(this);
			}
		},
		'onsubmit form': function(e){
			e.preventDefault();
			this.options.submit(this);
		},
		'onchange folder': function(e){	
			if (!_onlyTitle) {
				this.controls.submit.classList.remove('__disabled');	
			}
		},
		'oninput title': function(e){
			_helpers.toggleClass(this.controls.submit, '__disabled', e.target.value == this.options.target.model.get('title'));
		},
	};
	
	if(!view.model.isFolder()){
		handlers['oninput url'] = function(e){
			_helpers.toggleClass(this.controls.submit, '__disabled', e.target.value == this.options.target.model.get('url'));
		};
		handlers['onKeyDown url'] = handlers['onkeydown title'];
	}

	return new DialogPopup({
		options: {
			target: view,	
			submit: function(view){
				var 	_bookmark 		= view.options.target,
						bid 			= _bookmark.model.get('id'),
						saveTitle 		= view.controls.title.value,
						pid 		 	= view.controls.folder.value,
						saveURL 		= _bookmark.model.isFolder() ? null : view.controls.url.value;
						

				PlatformApi.updateBookmark(bid, saveTitle, saveURL, function(){
					_bookmark.model.change('title', saveTitle);
					if(saveURL) _bookmark.model.change('url', saveURL);
				});	

				if(
					!_onlyTitle && 
					pid != _bookmark.model.get('parentId')
				){
					PlatformApi.moveBookmark(bid, pid, function(updMark){
						let 	parent = view._folders[pid];

						_bookmark.parent.detachChild(_bookmark);
						_bookmark.model.set('index', updMark.index);
						parent.attachChild(_bookmark);
						// neeed to clean resources
						view.close(); 
					});
				}else{
					view.close();
				}
			},
			oncomplete
		},
		body: 
			'<form class="nm_middle" data-co="form">' +
				'<div class="nm_bookmark-edit-dialog_title">' + PlatformApi._('title') + ':</div>' +
				'<textarea data-co="title" class="nm_bookmark-edit-dialog_textarea"></textarea>' +
				'<div class="nm_bookmark-edit-dialog_title" data-co="url-title" style="display:none;">' + PlatformApi._('link') + '</div>' +
				'<textarea data-co="url" class="nm_bookmark-edit-dialog_textarea" style="display:none;"></textarea>' +
				'<select data-co="folder" class="nm_bookmark-edit-dialog_select-folder" style="display:none;"></select>' +
				// By default, folder control is hidden while _onlyTitle is false
				'<button data-co="submit" class="nm_btn nm_submit-btn __disabled" type="submit">' + PlatformApi._('update') + '</button>' +
			'</form>' +
			'<div class="nm_middle-helper"></div>' +
		'',
		events: handlers,
		onopen: function(view){
			var 	bookmark = view.options.target,
					_folders = {};

			if (!_onlyTitle) {
				if(!bookmark.model.isFolder()){
					view.controls.url.value = bookmark.model.get('url');
					view.controls.urlTitle.style.display = '';
					view.controls.url.style.display = '';
				}
				view._folders = {};

				bookmark.root.walk(function(bookmark){
					if(bookmark.model.isFolder()){
						_folders[bookmark.model.get('id')] = (_folders[bookmark.model.get('parentId')] || '') + '/' + bookmark.model.get('title');
						view._folders[bookmark.model.get('id')] = bookmark;
					}
				});

				view.controls.folder.style.display = '';
				view.controls.folder.appendChild(_helpers.crList(_folders, function(name, id){
					var option = document.createElement('option');

					option.value = id;
					option.textContent = name;
					return option;
				}));
				view.controls.folder.value = bookmark.model.get('parentId');
			}

			view.controls.title.value = bookmark.model.get('title');

			setTimeout(function(){
				view.controls.title.focus();
			}, 100);
		},
		onclose: function(view){
			view._folders = null;

			if(view.options.oncomplete){
				view.options.oncomplete();
			}
		},
	});
}
