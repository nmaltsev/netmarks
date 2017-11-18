function saveParse(str){
	try{
		return JSON.parse(str);
	}catch(e){
		return null;
	}
}

// Fallback for previous settings versions
var 	buf = saveParse(window.localStorage.getItem('windowConfig'));

if(buf){
	var 	settingsData = {
				version: 1,
				popup_fontSize: buf.font,
				popup_width: buf.width,
				popup_height: buf.height,
				popup_limitedWidth: buf.limitedWidth,
				popup_upcaseHeader: buf.hideOpened,
				popup_fontColor : '#333333',
				popup_counterColor: '#333333',
				action_openBookmarkInNewTab: !buf.defaultClickAction,
				action_hideOpened: buf.hideOpened,
				action_activateTab: false,
			};
	window.localStorage.setItem('settings', settingsData);
	window.localStorage.removeItem('windowConfig');
}
//==================================
// Events
//==================================
{
	function Events(){
		this._handlers = Object.create(null);
	};
	// @memberOf Events - execute event callbacks
	// @param {Object} options - event options
	// @return {Bool} - if true - stop event propagation
	Events.prototype.trigger = function(name){
		var 	handlers = this._handlers[name],
				i;

		if(Array.isArray(handlers)){
			i = handlers.length;
			while(i-- > 0){
				if(handlers[i](arguments[1], arguments[2], arguments[3])){
					return true;
				}	
			}
		}
		return false;
	};
	// @memberOf {Events} - remove all event listeners
	Events.prototype.destroy = function(){
		for(var key in this._handlers){
			this.off(key);
		}
	};
	// @memberOf {Events} - attach callback on change
	// @param {String} name - property of model
	// @param {Function} cb - callback
	Events.prototype.on = function(name, cb){
		if(!Array.isArray(this._handlers[name])){
			this._handlers[name] = [];
		}
		this._handlers[name].push(cb);
	};
	// @memberOf {Events} - deattach event
	// @param {String} name - property of model
	// @param {Function} cb - callback
	Events.prototype.off = function(name, cb){
		var handlers = this._handlers[name];
		
		if(Array.isArray(handlers)){
			if(cb){
				var pos = handlers.indexOf(cb);
				pos != -1 && handlers.splice(pos, 1);

				if(handlers.length == 0){
					delete this._handlers[name];
				}
			}else{
				handlers.length = 0;
				delete this._handlers[name];
			}
		}
	};
	// @memberOf {Events} - attach callback on change
	// @param {String} name - property of model
	// @param {Function} cb - callback
	// @return {Function} handler
	Events.prototype.once = function(name, cb){
		if(!Array.isArray(this._handlers[name])){
			this._handlers[name] = [];
		}
		var _cb = function(args){
			this.off(name, _cb);
			return cb(args);
		}.bind(this);
		this._handlers[name].push(_cb);
		return _cb;
	};
}
//==================================
// Dispatcher
//==================================
{
	function Dispatcher(){
		Events.call(this);
		chrome.runtime.onMessage.addListener(function(req, sender, res){
			this.trigger(req.action, req, res, sender);
			return true; // wait asynchroniously
		}.bind(this));
	}
	Dispatcher.prototype = Object.create(Events.prototype);
	Dispatcher.prototype.constructor = Events;
}
//==================================
// Model
//==================================
{
	var Model = function(attr){
		Events.call(this);
		this.attr = attr || Object.create(null);
	}
	Model.prototype = Object.create(Events.prototype);
	Model.prototype.constructor = Events;
	Model.prototype.set = function(){
		if(arguments.length == 2){
			this.attr[arguments[0]] = arguments[1];
		}else{
			var 	collection = arguments[0],
					key;

			for(key in collection){
				this.attr[key] = collection[key];
			}
		}
	};
	Model.prototype.change = function(){
		this.changed = {};
		this.previous = {};

		if(arguments.length == 2){
			this.previous[arguments[0]] = this.attr[arguments[0]];
			this.attr[arguments[0]] = arguments[1];
			this.changed[arguments[0]] = arguments[1];
			this.trigger('change:' + arguments[0], arguments[1], this);
		}else{
			var 	collection = arguments[0],
					key;

			for(key in collection){
				this.previous[key] = this.attr[key];
				this.attr[key] = collection[key];
				this.changed[key] = collection[key];
				this.trigger('change:' + key, collection[key], this);
			}
		}
		this.trigger('change', this);
	};
	Model.prototype.get = function(key){
		return this.attr[key];
	};
	Model.prototype.has = function(key){
		return this.attr.hasOwnProperty(key);
	}
	Model.prototype.destroy = function(){
		this.trigger('destroy', this);
		for(var key in this.attr){
			delete this.attr[key];
		}
		Events.prototype.destroy.call(this);
	};
};





var 	topPos = (window.localStorage.getItem('scrollTop')-0),
		_dispatcher = new Dispatcher(),
		_settings = new Model({
			preferences: saveParse(window.localStorage.getItem('settings')) || {
				version: 1,
				popup_fontSize: 12, // 11-14
				// Design styles (set one time at opening)
				popup_width: 400,
				popup_height: 500,
				popup_limitedWidth: true,
				popup_upcaseHeader: true,
				popup_fontColor : '#333333',
				popup_counterColor: '#333333', // Configure color of bookmarks counter	
				// Main action settings
				// DEPRICATED
				defaultClickAction: false, // false - open bookmark at new tab by click
				// Featured
				action_openBookmarkInNewTab: true,
				action_hideOpened: false,
				action_activateTab: false,
			},
			opened: saveParse(window.localStorage.getItem('opened')) || ["1", "2"],
			topPos: isFinite(topPos) ? topPos : 0,
		});


// For settings page
_dispatcher.on('getSettings', function(data, answer){
	answer(_settings.get('preferences'));
});
_dispatcher.on('setWindowConfig', function(data){
	_settings.change('preferences', data.settings)

	if(data.settings.hideOpened){
		// Remove all opened bookmarks and save only last
		var		opened = _settings.get('opened'),
				_last = opened.length - 1;

		_settings.change('opened', opened.filter(function(n, i){
			return n == '1' || n == '2' || i == _last;
		}));
	}
});

// For popup
_dispatcher.on('popupReady', function(data, answer){
	var conf = {
		settings: _settings.get('preferences'),
		opened:_settings.get('opened'),
		topPos: _settings.get('topPos')
	}
	answer(conf);
});
_dispatcher.on('setOpened', function(data){
	_settings.change('opened', data.list);
});
_dispatcher.on('setTopPos', function(data){
	_settings.change('topPos', data.pos);
});

_settings.on('change:preferences', function(settings){
	window.localStorage.setItem('settings', JSON.stringify(settings));
});
_settings.on('change:opened', function(opened){
	window.localStorage.setItem('opened', JSON.stringify(opened));
});
_settings.on('change:topPos', function(pos){
	window.localStorage.setItem('scrollTop', pos);
});