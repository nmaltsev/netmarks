// FR: fix charcode 
function KeyCoder(){
	this.keyBoardMap = Object.create(null);
	
	var i = this.enKeys.length;

	while(i-- > 0){
		this.keyBoardMap[this.enKeys[i]] = this.ruKeys[i];
		this.keyBoardMap[this.ruKeys[i]] = this.enKeys[i];
	}
}
KeyCoder.prototype.enKeys = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,.',
KeyCoder.prototype.ruKeys = 'ёйцукенгшщзхъфывапролджэячсмитьбю';
KeyCoder.prototype.transform = function(str){
	var 	out = '',
			i = str.length;

	while(i-- > 0){
		out = (this.keyBoardMap[str.charAt(i) || str.charAt(i)]) + out;
	}

	return out;
}
// MkgdIp MKgdI26
/*
TODO подсчитать отношение пробельных символов/точек и символов в ерхнем регистре
подсчитать отношение гласных и согласных символов
*/
KeyCoder.prototype.isCharMapMismatch = function(){
	// TODO
};

//================================================
// Browser Api
//================================================
function BrowserApi(openBookmarkInNewTab, activateTab){
	this.openBookmarkInNewTab = openBookmarkInNewTab;
	this.activateTab = activateTab; 
	// TODO
	// this.keyCoder = new KeyCoder(),
}
BrowserApi.prototype = {
	rootId: "0",

	// @memberOf BrowserApi - open link at new tab (at active window)
	// @param {String} url
	openInNewWindow: function(url, isIncognito){
		chrome.windows.create({
			url: url,
			incognito: isIncognito,
			focused: this.activateTab
		});
	},
	// @memberOf BrowserApi -  get url of active tab
	// @param {Function} cb
	getActiveTabUrl: function(cb){
		chrome.tabs.query({ // https://developer.chrome.com/extensions/tabs
			active: true,
			currentWindow: true,
			// lastFocusedWindow
		}, function(tabs){
			cb(tabs[0] && {
				title: tabs[0].title,
				url: tabs[0].url
			});
		});
	},
	// @memberOf BrowserApi -  create BookmarkModel from current opened Tab
	// @param {Object} tabObj,
	// @param {String} parentId,
	// @param {Function} cb
	createBookmark: function(tabObj, parentId, cb){
		chrome.bookmarks.create({
			parentId: parentId,
			title: tabObj.title,
			url: tabObj.url
		}, function(subTree){
			var bmModel = new BookmarksModel({
				id: subTree.id,
				title: subTree.title, 
				index: subTree.index,
				url: subTree.url,
				isFolder: false,
				parentId: subTree.parentId,
			});
			cb(bmModel);
		});
	},
	createSubFolder: function(title, parentId, cb){
		chrome.bookmarks.create({
			parentId: parentId,
			title: title,
		}, function(subTree){
			var bmModel = new BookmarksModel({
				id: subTree.id,
				title: subTree.title, 
				index: subTree.indes,
				isFolder: true,
				parentId: subTree.parentId,
				count: 0
			});
			cb(bmModel);
		});
	},
	openBookmarkCollection: function(list){
		for(var i = 0, len = list.length; i < len; i++){
			(function(index, url){
				setTimeout(function(){
					chrome.tabs.create({
						url: url,
						active: false
					});
				}, 100 * index);
			}(i, list[i]));
		}
	},
	// @memberOf BrowserApi - save list as opened folders at localstorage
	saveOpened: function(list){
		chrome.runtime.sendMessage({
			action: 'setOpened',
			list: list
		});
	},
	saveTopPos: function(pos){
		chrome.runtime.sendMessage({
			action: 'setTopPos',
			pos: pos
		});
	},
	removeLinkMark: function(id, cb){
		chrome.bookmarks.remove(id, function(){
			cb && cb();
		});
	},
	// @param {String} id
	// @param {String} title
	// @param {String} url
	// @param {Function} cb
	updateBookmark: function(id, title, url, cb){
		var config = {};
		if(title) config.title = title;
		if(url) config.url = url;
		chrome.bookmarks.update(id, config, cb);
	},
	moveBookmark: function(id, parentId, cb){
		chrome.bookmarks.move(id, {
			parentId: parentId
		}, cb);
	},
	// add bookmark with id after bookmark with nextId
	moveBookmarkAfter: function(id, nextId, cb){
		chrome.bookmarks.get(nextId, function(bookmarks){
			chrome.bookmarks.move(id, {
				parentId: bookmarks[0].parentId,
				index: bookmarks[0].index + 1
			}, cb);
		});
	},
	removeFolder: function(id, cb){
		chrome.bookmarks.removeTree(id, cb);
	},
	openAtCurrentTab: function(url){
		chrome.tabs.query({ // https://developer.chrome.com/extensions/tabs
			active: true,
			currentWindow: true,
			// lastFocusedWindow
		}, function(tabs){
			if(tabs[0]){
				// DEPRICATED need permission "*://*""
				// if(url.indexOf('javascript:') == -1){
				// 	chrome.tabs.update(tabs[0].id, {
				// 		url: url
				// 	});
				// }else{ // for bookmarklet support
				// 	var code = url.substring(11).trim();

				// 	chrome.tabs.executeScript(tabs[0].id, {
				// 		code: code
				// 	});
				// }
				chrome.tabs.update(tabs[0].id, {
					url: url,
					active: this.activateTab, // true
				}, function(){
					if(this.activateTab) window.close();
				}.bind(this));
			}
		}.bind(this));
	},
	// @memberOf BrowserApi - open link at new tab (at active window)
	// @param {String} url
	openInNewTab: function(url){
		chrome.tabs.create({
			url: url,
			active: this.activateTab
		});
	},
	openBookmark: function(url){
		if(this.openBookmarkInNewTab){
			chrome.tabs.create({
				url: url,
				active: this.activateTab
			});
		}else{
			this.openAtCurrentTab(url);
		}
	},

	// @param {String} query
	// @param {Function} cb
	search: function(query, cb){
		// TODO Hardcode for Russian locale
		
		// if(navigator.language == 'ru'){
		// 	query += ' ' + this.keyCoder.transform(query);
		// 	console.log('Q: `%s`', query);
		// }

		chrome.bookmarks.search(query, function(list){
			if(list.length > 100){ // top limit	
				list.length = 100;
			}
			
			cb(list.map(function(bObj){
				var obj = {
					id: bObj.id,
					title: bObj.title, 
					index: bObj.index,
					parentId: bObj.parentId,
				};
				
				if(bObj.url != undefined){
					obj.url = bObj.url;
				}else{
					obj.isFolder = true;
				}
				return new BookmarksModel(obj);
			}));
		});
	},
	// @param {String} url
	// @return {String} faviconUrl
	getFavicon: function(url){
		if(url.indexOf('javascript:') == 0){
			return 'url(img/js16.png)';
		}else{
			return 'url(chrome://favicon/' + url + ')';	
		}
	},
	_: function(str){
		return chrome.i18n.getMessage(str) || str;
	},
};

//================================================
// TreeModel
//================================================
function TreeModel(config){
	Backside.Model.call(this, config);
	// this.openedList = config.opened;
};
TreeModel.prototype = Object.create(Backside.Model.prototype);
TreeModel.prototype.constructor = Backside.Model;
// DEPRICATED
// @param {Object} bookmarkModel
// @param {Int} parentId
TreeModel.prototype.add = function(bookmarkModel, parentId){
	var bmId = bookmarkModel.get('id');
	
	if(this.openedList.indexOf(bmId) > -1){
		bookmarkModel.set('isOpened', true);
	}

	// DEPRICATED
	// Listener for storing opened/closed status
	// bookmarkModel.on('change:isOpened', function(newValue, property, model){
	// 	this.saveOpenedStatus(bmId, newValue);
	// }.bind(this));

	// set value and trigger custom event:
	this.trigger(':add', bookmarkModel);
};
// DEPRICATED
// @param {Bool} status
TreeModel.prototype.saveOpenedStatus = function(id, status){
	var pos = this.openedList.indexOf(id);

	if(status){
		if(pos == -1){
			this.openedList.push(id);
		}
	}else{
		this.openedList.splice(pos, 1);
	}
	PlatformApi.saveOpened(this.openedList);
};
//================================================
// BookmarkModel
//================================================
function BookmarksModel(config){
	Backside.Model.call(this, config);
	
	if(config.isFolder){
		this.attr.list = [];
		this.attr.count = 0;
	}
}
BookmarksModel.prototype = Object.create(Backside.Model.prototype);
BookmarksModel.prototype.constructor = Backside.Model;
BookmarksModel.prototype.isFolder = function(){
	return !this.attr.hasOwnProperty('url');
}
//================================================
// AppModel
//================================================
class AppModel extends Backside.Model{
	constructor(conf){
		super(conf);
		
	}
	filter(query){
		if(query){
			chrome.bookmarks.search(query, function(list){
				this.trigger(':filter', list.map(function(o){return o.id}));
			}.bind(this)); 
		}else{
			this.trigger(':filter', []);
		}
		
	}
}