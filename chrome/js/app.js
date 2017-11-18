// NetMarks Engine v246 2017/21/16

var _helpers = {
	plural: function(a, form1, form2, form3){
		if ( a % 10 == 1 && a % 100 != 11 ) return form1;
		else if ( a % 10 >= 2 && a % 10 <= 4 && ( a % 100 < 10 || a % 100 >= 20)) return form2;
		else return form3;
	},
	// @param {HtmlElement} $el
	// @param {String} className
	// @param {Bool/null} status - true if add, else remove
	toggleClass: function($el, className, status){
		if(status == undefined) status = !$el.classList.contains(className);
		$el.classList[status ? 'add' : 'remove'](className);
	},
	// @param {Array} list
	// @param {Function} cb
	// @return {HtmlFragment}
	crList: function(list, cb){
		var 	frag = document.createDocumentFragment(),
				i = -1;

		if(Array.isArray(list)){
			while(++i < list.length){
				frag.appendChild(cb(list[i], i));
			}	
		}else{
			for(var key in list){
				frag.appendChild(cb(list[key], key));
			}
		}
		
		return frag;
	},
	metter: function(){
		var _start = Date.now();

		return function(){
			var _end = Date.now();

			return _end - _start;
		}
	}
};

window._pmetter = _helpers.metter(); // Perfomance metter

var PlatformApi = new BrowserApi();
var appView = new RootFolder({
	el: document.getElementById('tree'),
	model: new AppModel({
		mode: undefined
	})
});


chrome.runtime.sendMessage({
	action: 'popupReady'
}, function(conf){
	appView.model.trigger(':configure', conf);
});


chrome.bookmarks.getTree(function(list){
	// console.log('PERF chrome.bookmarks.getTree: %s', _pmetter());
	var 	rootFolders = list[0].children,
			i = -1, view, item;

	while(++i < rootFolders.length){
		item = rootFolders[i];
		view = appView.append(new BookmarksModel({
			id: item.id,
			title: item.title,
			index: item.index,
			parentId: item.parentId,
		}));
		view.append(item.children, []);
	}

	appView.postInit();
	appView.listen('change:topPos', function(topPos, m){
		PlatformApi.saveTopPos(topPos);
	});
	appView.listen('change:opened', function(opened, m){
		PlatformApi.saveOpened(opened);
	});
});

