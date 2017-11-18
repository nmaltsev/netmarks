function _(str){
	return chrome.i18n.getMessage(str) || str;
}

var OptionPageModel = Backside.extend(function(config){
	Backside.Model.call(this, config);
}, Backside.Model);
OptionPageModel.prototype.minLimit = {
	width: 280,
	height: 320
};
OptionPageModel.prototype.maxLimit = {
	width: 600,
	height: 570 //chrome limit
};
OptionPageModel.prototype.fontSize = {
	"11": 11,
	"12": 12,
	"13": 13,
	"14": 14
};
// ovveride default change method: add global change event
OptionPageModel.prototype.change = function(name, value){
	Backside.Model.prototype.change.call(this, name, value);
	chrome.runtime.sendMessage({
		action: 'setWindowConfig',
		settings: this.attr
	});
};

var OptionPageView = Backside.extend(function(conf){
	Backside.View.call(this, conf);
}, Backside.View);

OptionPageView.prototype.initialize = function(conf){
	Backside.View.prototype.initialize.call(this, conf);
	this.localize();

	// BINDINGS
	this.on('fontSize', 'change', function(e){
		var size = this.model.fontSize[e.target.value];
		
		if(size) this.model.change('popup_fontSize', size);
	}.bind(this));
	this.on('wordWrapping', 'change', function(e){
		this.model.change('popup_limitedWidth', e.target.checked);
	}.bind(this));
	this.on('folderTittleUppercase', 'change', function(e){
		this.model.change('popup_upcaseHeader', e.target.checked);
	}.bind(this));
	this.on('clickActionRadio', 'change', function(e){
		this.model.change('action_openBookmarkInNewTab', e.target.value == 'new');
	}.bind(this));
	this.on('hideActionRadio', 'change', function(e){
		this.model.change('action_hideOpened', e.target.value == 'close');
	}.bind(this));
	this.on('sizeRange', 'change', function(e){
		var 	value = e.target.value;

		e.target.previousElementSibling.textContent = value + 'px';
		this.model.change((e.target.dataset.co == 'width-input' ? 'popup_width': 'popup_height'), parseInt(value));
	}.bind(this));
	// For cosmetic perpouse, real changes produced at onchange event handler
	this.on('sizeRange', 'input', function(e){
		var 	value = e.target.value;

		e.target.previousElementSibling.textContent = value + 'px';
	}.bind(this));
	this.on('fontColor', 'change', function(e){
		this.model.change('popup_fontColor', e.target.value);
	}.bind(this));
	this.on('counterColor', 'change', function(e){
		this.model.change('popup_counterColor', e.target.value);
	}.bind(this));
	this.on('activateTab', 'change', function(e){
		this.model.change('action_activateTab', e.target.checked);
	}.bind(this));

	// INITIAL STATE
	var 	$defaultActionRadio = this.controls.clickActionRadio.querySelector('[value=' + (this.model.get('action_openBookmarkInNewTab') ? 'new' : 'current') + ']'),
			$defaultHideActionRadio = this.controls.hideActionRadio.querySelector('[value=' + (this.model.get('action_hideOpened') ? 'close' : 'notclose') + ']');

	if($defaultActionRadio) $defaultActionRadio.checked = true;
	if($defaultHideActionRadio) $defaultHideActionRadio.checked = true;

	this.controls.fontSize.value = this.model.get('popup_fontSize');
	this.controls.fontColor.value = this.model.get('popup_fontColor');
	this.controls.counterColor.value = this.model.get('popup_counterColor');
	this.controls.wordWrapping.checked = this.model.get('popup_limitedWidth');
	this.controls.folderTittleUppercase.checked = this.model.get('popup_upcaseHeader');
	this.controls.activateTab.checked = this.model.get('action_activateTab');

	this.controls.widthInput.value = this.model.get('popup_width');
	this.controls.widthInput.previousElementSibling.textContent = this.model.get('popup_width') + 'px';

	this.controls.heightInput.value = this.model.get('popup_height');
	this.controls.heightInput.previousElementSibling.textContent = this.model.get('popup_height') + 'px';

	this.controls.heightInput.setAttribute('min', this.model.minLimit.height);
	this.controls.heightInput.setAttribute('max', this.model.maxLimit.height);
	this.controls.widthInput.setAttribute('min', this.model.minLimit.width);
	this.controls.widthInput.setAttribute('max', this.model.maxLimit.width);
};
OptionPageView.prototype.localize = function(){
	var 	$nodes = this.el.querySelectorAll('[data-i18n]'),
			i = $nodes.length,
			key;
	
	while(i-- > 0){
		key = $nodes[i].dataset.i18n;
		$nodes[i].textContent = _(key);
	}
};

chrome.runtime.sendMessage({
	action: 'getSettings'
}, function(settings){
	console.log('Settings');
	console.dir(settings);
	var optionsView = new OptionPageView({
		model: new OptionPageModel(settings),
		el: document.body
	});

	window.app = optionsView;
});


