/** * Copyright (c) 2006 * Martin Czuchra, Nicolas Peters, Daniel Polak, Willi Tscheschner * * Permission is hereby granted, free of charge, to any person obtaining a * copy of this software and associated documentation files (the "Software"), * to deal in the Software without restriction, including without limitation * the rights to use, copy, modify, merge, publish, distribute, sublicense, * and/or sell copies of the Software, and to permit persons to whom the * Software is furnished to do so, subject to the following conditions: * * The above copyright notice and this permission notice shall be included in * all copies or substantial portions of the Software. * * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER * DEALINGS IN THE SOFTWARE. **/var idCounter = 0;var ID_PREFIX = "oryx_";/** * Main initialization method. To be called when loading * of the document, including all scripts, is completed. */function init() {	/* When the blank image url is not set programatically to a local	 * representation, a spacer gif on the site of ext is loaded from the	 * internet. This causes problems when internet or the ext site are not	 * available. */	Ext.BLANK_IMAGE_URL = ORYX.PATH + 'lib/ext-2.0.2/resources/images/default/s.gif';			ORYX.Log.debug("Querying editor instances");	// render editor instances whereever there is an oryx canvas.	// TODO This should definately have predicate set!	DataManager.query(		undefined,		undefined,		{type: ERDF.RESOURCE, value: 'http://oryx-editor.org/canvas'}).each(					function(c) {				var anchor = c.subject.value;				var id = anchor.substring(1, anchor.length);				ORYX.Log.trace("Initializing instance #%0.", id);				new ORYX.Editor(id);				ORYX.Log.trace("Finished Initializing instance #%0.", id);			});}/** * Init namespaces */if(!ORYX) {var ORYX = {};}/** * The Editor class. */ORYX.Editor = {	/**	 * Constructor.	 */	construct: function(id) {		ORYX.Log.debug("Constructing Editor %0", this.id);		// initialization.		this._eventsQueue = [];		this.loadedPlugins = [];		this.pluginsData = [];		this.selection = [];		this.zoomLevel = 1.0;		this.movedDrag = undefined;		this.id = id;		var canvasStencil;		var numberOfTypeTriples;		this._loadStencilSets();		// get type of canvas.		var canvasTypeTriples = DataManager.query(			{type: ERDF.RESOURCE, value: ''},			{prefix: 'oryx', name: 'type'},			undefined);		if(canvasTypeTriples.length == 0)			ORYX.Log.warn("The loaded resource has no property of type 'oryx-type'.");		if(canvasTypeTriples.length > 1)			ORYX.Log.fatal("Oryx initialisation failed, because the loaded resource has too many properties of type 'oryx-type'.");				// get the stencil associated with the type		canvasStencil = ORYX.Core.StencilSet.stencil(			(numberOfTypeTriples == 1) ?				canvasTypeTriples[0].object.value :				this.getStencilSets().values()[0].findRootStencilName());					if (!canvasStencil) 			ORYX.Log.fatal("Oryx initialisation failed, because the stencil with the id %0 is not part of one of the loaded stencil sets.", canvasType[0].object);				// create the canvas		this._canvas = new ORYX.Core.Canvas({			width:  ORYX.CONFIG.CANVAS_WIDTH,			height: ORYX.CONFIG.CANVAS_HEIGHT,			'eventHandlerCallback': this.handleEvents.bind(this)		}, canvasStencil);		// create all dom		// TODO fix border, so the visible canvas has a double border and some spacing to the scrollbars		var div = ORYX.Editor.graft("http://www.w3.org/1999/xhtml", null, ['div']);						div.appendChild(this._canvas.getRootNode());		div.appendChild(this._canvas.getHTMLContainer());		// set class for custom styling		div.addClassName("ORYX_Editor");			// get fullscreen option		var fullscreen = DataManager.query(			{type: ERDF.RESOURCE, value: '#'+this.id},			{prefix: 'oryx', name: 'mode'},			undefined).any(function(triple){				return triple.object.value === ORYX.CONFIG.MODE_FULLSCREEN;			});					//TODO make the height be read from eRDF data from the canvas.		// default, a non-fullscreen editor shall define its height by layout.setHeight(int) 		var layoutHeight = 400;						/* Ext 1.1 code. Replaced by Ext 2.0.		var parentContainer = fullscreen ? document.body : $(this.id);		this.layout = new Ext.BorderLayout(parentContainer, {					hideOnLayout: false,					center: {	                        	titlebar: false,	                        	autoScroll:true	                    	}					});		this.layout.beginUpdate();		this.layout.add('center', new Ext.ContentPanel(div, {title: 'Editor', closable: false}));		this.layout.endUpdate();*/		// stores DOM references to the specific regions of the layout		this.layout_regions = {			north: new Ext.Panel({ //TOOO make a composite of the oryx header and addable elements (for toolbar), second one should contain margins				region: 'north',				autoEl: 'div',				border: false			}),			east: new Ext.Panel({				region: 'east',				layout: 'fit',				autoEl: 'div',				collapsible: true,				split: true,				title: "East"			}),			south: new Ext.Panel({				region: 'south',				autoEl: 'div'			}),			west: new Ext.Panel({				region: 'west',				layout: 'fit',				autoEl: 'div',				collapsible: true,				split: true,				title: "West"			}),			center: new Ext.Panel({				region: 'center',				autoScroll: true,				items: {					layout: "fit",					autoHeight: true,					el: div				}			})		}				for (region in this.layout_regions) {			if (region != "center") {				this.layout_regions[region].hide();			}		}		 		var layout_config = {			layout: 'border',			items: [				this.layout_regions.north,				this.layout_regions.east,				this.layout_regions.south,				this.layout_regions.west,				this.layout_regions.center			]		}		// determine where to put the canvas and do so.		if (fullscreen) {			this.layout = new Ext.Viewport(layout_config)				} else {			layout_config.renderTo = this.id;			layout_config.height = layoutHeight;			this.layout = new Ext.Panel(layout_config)		}			 	// set the editor to the center, and refresh the size	 	div.parentNode.setAttributeNS(null, 'align', 'center');	 	div.setAttributeNS(null, 'align', 'left');		this._canvas.setSize({			width: ORYX.CONFIG.CANVAS_WIDTH,			height: ORYX.CONFIG.CANVAS_HEIGHT		});			// Register on Events		document.documentElement.addEventListener('keydown', this.catchKeyDownEvents.bind(this), true);		document.documentElement.addEventListener('keyup', this.catchKeyUpEvents.bind(this), true);		this.DOMEventListeners = $H({			'mousedown': [],			'mousemove': [],			'mouseup': [],			'mouseover': [],			'mouseout': [],			'mousedown': [],			'selectionchanged': []});		// get readonly option		var readonly = DataManager.query(			{type: ERDF.RESOURCE, value: '#'+this.id},			{prefix: 'oryx', name: 'mode'},			undefined).any(function(triple){				return triple.object.value === ORYX.CONFIG.MODE_READONLY;			});					// load plugins and stencil sets, if applicable		if(!readonly) window.setTimeout(this.loadPlugins.bind(this), 100);		// load content of this editor instance		window.setTimeout(this.loadContent.bind(this), 10);						// The Drop-Target from Yui-Ext		new Ext.dd.DropTarget(div.parentNode);				//new PeriodicalExecuter(this._canvas.update.bind(this._canvas), 1);				// if the editor is loaded to use the whole page, add a header.		if (fullscreen) {						// the oryx header			this.addToRegion("north", new Ext.Panel({				height: 30,				autoHeight: false,				border: false,				html: "<div id='oryx_editor_header'><img src='"+ORYX.PATH+"images/oryx.small.gif'/><div style='clear: both;'></div></div>" 			}))		}				// Close the loading Panel		window.setTimeout(function(){Ext.getCmp('oryx-loading-panel').hide()}, 500);						 	},		/**	 * adds a component to the specified region	 * 	 * @param {String} region	 * @param {Ext.Component} component	 * @param {String} title, optional	 * @return {Ext.Component} dom reference to the current region or null if specified region is unknown	 */	addToRegion: function(region, component, title) {				if (region.toLowerCase && this.layout_regions[region.toLowerCase()]) {			var current_region = this.layout_regions[region.toLowerCase()];			current_region.add(component);						ORYX.Log.debug("original dimensions of region %0: %1 x %2", current_region.region, current_region.width, current_region.height)			// update dimensions of region if required.			if  (!current_region.width && component.initialConfig && component.initialConfig.width) {				ORYX.Log.debug("resizing width of region %0: %1", current_region.region, component.initialConfig.width)					current_region.setWidth(component.initialConfig.width)			}			if  (component.initialConfig && component.initialConfig.height) {				ORYX.Log.debug("resizing height of region %0: %1", current_region.region, component.initialConfig.height)				var current_height = current_region.height || 0;				current_region.height = component.initialConfig.height + current_height;				current_region.setHeight(component.initialConfig.height + current_height)			}						// set title if provided as parameter.			if (typeof title == "string") {				current_region.setTitle(title);				}									// trigger doLayout() and show the pane			current_region.doLayout();			current_region.ownerCt.doLayout();			current_region.show();			if(Ext.isMac)				ORYX.Editor.resizeFix();						return current_region;		}				return null;	}, 	/**	 *  Laden der Plugins	 */	loadPlugins: function() {		// if there should be plugins but still are none, try again.		// TODO this should wait for every plugin respectively.		if (!ORYX.Plugins && ORYX.availablePlugins.length > 0) {			window.setTimeout(this.loadPlugins.bind(this), 100);			return;		}				var me = this;		var newPlugins = [];		// Available Plugins will be initalize		ORYX.availablePlugins.each((function(value) {			ORYX.Log.debug("Initializing plugin '%0'", value.name);			try {				var className = eval(value.name);				newPlugins.push(new className(this._getPluginFacade(), value));			} catch(e) {				ORYX.Log.warn("Plugin %0 is not available", value.name);			}		}).bind(this));		newPlugins.each(function(value) {			// If there is an GUI-Plugin, they get all Plugins-Offer-Meta-Data			if(value.registryChanged)				value.registryChanged(me.pluginsData);			// If there have an onSelection-Method it will pushed to the Editor Event-Handler			if(value.onSelectionChanged)				me.registerOnEvent('selectionchanged', value.onSelectionChanged.bind(value));		});		this.loadedPlugins = newPlugins;				// Hack for the Scrollbars		if(Ext.isMac) {//			window.setTimeout("window.resizeBy(0,0)", 10);			ORYX.Editor.resizeFix();		}				this.updateSelection();	},	_loadStencilSets: function() {				// for each stencilset url ...		DataManager.query(			{type: ERDF.RESOURCE, value: '#'+this.id},			{prefix: 'oryx', name: 'stencilset'},			undefined).each((					// ... load it.		function(triple) {						var url = triple.object.value;			//this.loadStencilSet(url);			ORYX.Core.StencilSet.loadStencilSet(url, this.id);		}).bind(this));	},	/**	 * Responsible for loading the content into the editor. This method will	 * be called by the editor once at initialization time.	 */	loadContent: function() {				// init shape array and get canvas.		var canvas = this.getCanvas();		var me = this;		var newEdges = [];		var newShapes = [];		// for each renderable entry in this canvas ...		var renderables = DataManager.query(			{type: ERDF.RESOURCE, value: '#'+this.id},			{prefix: 'oryx', name: 'render'},			undefined).each((						function(triple) {								// Get resource id				var resourceId = triple.object.value;								// Get stencil type												var stencilType = DataManager.query(									{type: ERDF.RESOURCE, value: resourceId},									{prefix: 'oryx', name: 'type'},									undefined);													stencilType = stencilType.length > 0 ? stencilType[0].object.value : undefined;								// If there is no stenciltype				if(!stencilType) {					ORYX.Log.warn("Ressource needs an oryx-type.");					return;				}								// Try to create a new Shape				try {					// Create a new Stencil													var stencil = ORYX.Core.StencilSet.stencil(stencilType);						// Create a new Shape					var newShape = (stencil.type() == "node") ?										new ORYX.Core.Node(											{'eventHandlerCallback':this.handleEvents.bind(this)},											stencil) :										new ORYX.Core.Edge(											{'eventHandlerCallback':this.handleEvents.bind(this)},											stencil);										// Set the resource id					newShape.resourceId = ERDF.__stripHashes(resourceId);						var serialize = [];					// Get all triple of prefix 'oryx' and 'raziel'					// TODO get triples with all prefixes					DataManager.query(	{type: ERDF.RESOURCE, value: resourceId},										{prefix: undefined, name: undefined},										undefined).each(						function(triple) {							serialize.push({	name: 	triple.predicate.name,		// Get the name												prefix: triple.predicate.prefix,	// Get the prefix												value:	triple.object.value			// Get the value											});												}					);										// Add the shape to the canvas					this.getCanvas().add(newShape);														// Add to new shapes					newShapes.push({shape:newShape, serialize: serialize});									} catch(e) {					ORYX.Log.warn("LoadingContent: Stencil could not create.");					return;				}															}).bind(this));				var serialize = [];		// Get Properties for the Canvas		DataManager.query(	{type: ERDF.RESOURCE, value: ""},							{prefix: undefined, name: undefined},							undefined).each(			function(triple) {				serialize.push({	name: 	triple.predicate.name,		// Get the name									prefix: triple.predicate.prefix,	// Get the prefix									value:	triple.object.value			// Get the value								});						}		);				// Add the Canvas for Deserialisation		newShapes.push({shape:this.getCanvas(), serialize: serialize});												// Deserialize the properties from the shapes		newShapes.each(			function(pair){				pair.shape.deserialize(pair.serialize);			}		);				// Update the canvas		canvas.update();		ORYX.Log.info("Loaded graph into editor shapes.");	},	/**	 * Returns a per-editor singleton plugin facade.	 * To be used in plugin initialization.	 */	_getPluginFacade: function() {		// if there is no pluginfacade already created:		if(!(this._pluginFacade))			// create it.			this._pluginFacade = {				offer:					this.offer.bind(this),				getStencilSets:			this.getStencilSets.bind(this),				getRules:				this.getRules.bind(this),				loadStencilSet:			this.loadStencilSet.bind(this),				createShape:			this.createShape.bind(this),				deleteShape:			this.deleteShape.bind(this),				getSelection:			this.getSelection.bind(this),				setSelection:			this.setSelection.bind(this),				updateSelection:		this.updateSelection.bind(this),				getCanvas:				this.getCanvas.bind(this),								registerOnEvent:		this.registerOnEvent.bind(this),				unregisterOnEvent:		this.unregisterOnEvent.bind(this),				registerEventType:		this.registerEventType.bind(this),				raiseEvent:				this.handleEvents.bind(this),				enableEvent:			this.enableEvent.bind(this),				disableEvent:			this.disableEvent.bind(this),								eventCoordinates:		this.eventCoordinates.bind(this),				getLayout:				this.getLayout.bind(this),				addToRegion:			this.addToRegion.bind(this)			};		// return it.		return this._pluginFacade;	},	getLayout: function() {		return this.layout;	},	disableEvent: function(eventType){		if(this.DOMEventListeners.keys().member(eventType)) {			var value = this.DOMEventListeners.remove(eventType);			this.DOMEventListeners['disable_' + eventType] = value;		}	},	enableEvent: function(eventType){		if(this.DOMEventListeners.keys().member("disable_" + eventType)) {			var value = this.DOMEventListeners.remove("disable_" + eventType);			this.DOMEventListeners[eventType] = value;		}	},	registerEventType: function(eventType) {		if(!(this.DOMEventListeners.keys().member(eventType))) {			this.DOMEventListeners[eventType] = [];		}	},	/**	 *  Methods for the PluginFacade	 */	registerOnEvent: function(eventType, callback) {		if(!(this.DOMEventListeners.keys().member(eventType))) {			this.DOMEventListeners[eventType] = [];		}		this.DOMEventListeners[eventType].push(callback);	},	unregisterOnEvent: function(eventType, callback) {		if(this.DOMEventListeners.keys().member(eventType)) {			this.DOMEventListeners[eventType] = this.DOMEventListeners[eventType].without(callback);		} else {			// Event is not supported			// TODO: Error Handling		}	},	getSelection: function() {		return this.selection;	},	getStencilSets: function() { 		return ORYX.Core.StencilSet.stencilSets(this.id); 	},		getRules: function() {		return ORYX.Core.StencilSet.rules(this.id);	},		loadStencilSet: function(source) {		try {			ORYX.Core.StencilSet.loadStencilSet(source, this.id);			this.handleEvents({type:"stencilSetLoaded"});		} catch (e) {			Ext.Msg.alert("Oryx", "Requesting stencil set file failed. (" + e + ")");		}	},	offer: function(pluginData) {		if(!this.pluginsData.member(pluginData)){			this.pluginsData.push(pluginData);		}	},	setSelection: function(elements, subSelectionElement) {		if(!elements) {elements = []}		this.selection = elements;		this._subSelection = subSelectionElement;				this.handleEvents({type:'selectionchanged', elements:elements, subSelection: subSelectionElement})	},		updateSelection: function() {		this.setSelection(this.selection)	},	getCanvas: function() {		return this._canvas;	},	/**	*	option = {	*		type: string,	*		position: {x:int, y:int},	*		connectingType:	uiObj-Class	*		connectedShape: uiObj	*		draggin: bool	*		namespace: url	*       parent: ORYX.Core.AbstractShape	*		template: a template shape that the newly created inherits properties from.	*		}	*/	createShape: function(option) {		if(option && option.serialize && option.serialize instanceof Array){					var type = option.serialize.find(function(obj){return (obj.prefix+"-"+obj.name) == "oryx-type"});			var stencil = ORYX.Core.StencilSet.stencil(type.value);					if(stencil.type() == 'node'){				var newShapeObject = new ORYX.Core.Node({'eventHandlerCallback':this.handleEvents.bind(this)}, stencil);				} else {				var newShapeObject = new ORYX.Core.Edge({'eventHandlerCallback':this.handleEvents.bind(this)}, stencil);				}					this.getCanvas().add(newShapeObject);			newShapeObject.deserialize(option.serialize);					return newShapeObject;		}		// If there is no argument, throw an exception		if(!option || !option.type || !option.namespace) { throw "To create a new shape you have to give an argument with type and namespace";}				var canvas = this.getCanvas();		var newShapeObject;		// Get the shape type		var shapetype = option.type;		// Get the stencil set		var sset = ORYX.Core.StencilSet.stencilSet(option.namespace);		// Create an New Shape, dependents on an Edge or a Node		if(sset.stencil(shapetype).type() == "node") {			newShapeObject = new ORYX.Core.Node({'eventHandlerCallback':this.handleEvents.bind(this)}, sset.stencil(shapetype))		} else {			newShapeObject = new ORYX.Core.Edge({'eventHandlerCallback':this.handleEvents.bind(this)}, sset.stencil(shapetype))		}				// when there is a template, inherit the properties.		if(option.template) {			newShapeObject._jsonStencil.properties = option.template._jsonStencil.properties;			newShapeObject.postProcessProperties();		}		// Add to the canvas		if(option.parent && newShapeObject instanceof ORYX.Core.Node) {			option.parent.add(newShapeObject);		} else {			canvas.add(newShapeObject);		}						// Set the position		var point = option.position ? option.position : {x:100, y:200};					var con;		// If there is create a shape and in the argument there is given an ConnectingType and is instance of an edge		if(option.connectingType && option.connectedShape && !(newShapeObject instanceof ORYX.Core.Edge)) {			// there will be create a new Edge			con = new ORYX.Core.Edge({'eventHandlerCallback':this.handleEvents.bind(this)}, sset.stencil(option.connectingType));						// And both endings dockers will be referenced to the both shapes			con.dockers.first().setDockedShape(option.connectedShape);						var magnet = option.connectedShape.getDefaultMagnet()			var cPoint = magnet ? magnet.bounds.center() : option.connectedShape.bounds.midPoint();			con.dockers.first().setReferencePoint( cPoint );			con.dockers.last().setDockedShape(newShapeObject);			con.dockers.last().setReferencePoint(newShapeObject.getDefaultMagnet().bounds.center());								// The Edge will be added to the canvas and be updated			canvas.add(con);				con.update();					} 				// Move the new Shape to the position		if(newShapeObject instanceof ORYX.Core.Edge && option.connectedShape) {			newShapeObject.dockers.first().setDockedShape(option.connectedShape);			newShapeObject.dockers.first().setReferencePoint(option.connectedShape.getDefaultMagnet().bounds.center());								newShapeObject.dockers.last().bounds.centerMoveTo(point);		} else {						var b = newShapeObject.bounds			b.centerMoveTo(point);						var upL = b.upperLeft();			b.moveBy( -Math.min(upL.x, 0) , -Math.min(upL.y, 0) )						var lwR = b.lowerRight();			b.moveBy( -Math.max(lwR.x-canvas.bounds.width(), 0) , -Math.max(lwR.y-canvas.bounds.height(), 0) )					}				// Update the shape		newShapeObject._update(false);				// And refresh the selection		if(!(newShapeObject instanceof ORYX.Core.Edge)) {			this.setSelection([newShapeObject]);		}				if(con && con.alignDockers) {			con.alignDockers();		} 		if(newShapeObject.alignDockers) {			newShapeObject.alignDockers();		}		return newShapeObject;	},		deleteShape: function(shape) {		//remove shape from parent		// this also removes it from DOM		shape.parent.remove(shape);				//delete references to outgoing edges		shape.getOutgoingShapes().each(function(os) {			var docker = os.getDockers().first();			if(docker) {				docker.setDockedShape(undefined);			}		});				//delete references to incoming edges		shape.getIncomingShapes().each(function(is) {			var docker = is.getDockers().last();			if(docker) {				docker.setDockedShape(undefined);			}		});				//delete references of the shape's dockers		shape.getDockers().each(function(docker) {			docker.setDockedShape(undefined);		});	},	/** **************************************	*	Event-Handler Methods	*	*/	_executeEvents: function() {				this._queueRunning = true;		while(this._eventsQueue.length > 0) {			var val = this._eventsQueue.shift();			if(this.DOMEventListeners.keys().member(val.event.type)) {				this.DOMEventListeners[val.event.type].each((function(value) {					value(val.event, val.arg);							}).bind(this));			}		}		this._queueRunning = false;	},		/**	 * Leitet die Events an die Editor-Spezifischen Event-Methoden weiter	 * @param {Object} event Event , welches gefeuert wurde	 * @param {Object} uiObj Target-UiObj	 */	handleEvents: function(event, uiObj) {		ORYX.Log.trace("Dispatching event type %0 on %1", event.type, uiObj);		switch(event.type) {			case 'mousedown':				this._handleMouseDown(event, uiObj);				break;			case 'mousemove':				this._handleMouseMove(event, uiObj);				break;			case 'mouseup':				this._handleMouseUp(event, uiObj);				break;			case 'mouseover':				this._handleMouseHover(event, uiObj);				break;			case 'mouseout':				this._handleMouseOut(event, uiObj);				break;		}		this._eventsQueue.push({event: event, arg: uiObj});		if(!this._queueRunning) {			this._executeEvents();		}				// TODO: Make this return whether no listener returned false.		// So that, when one considers bubbling undesireable, it won't happen.		return false;	},	catchKeyUpEvents: function() {		this.__currentKey = null;	},		catchKeyDownEvents: function(event) {				// assure we have the current event.        if (!event)             event = window.event;                // get the currently pressed key code.        var pressedKey = event.which || event.keyCode;				// This is a mac-specific fix. The mozilla event object has no knowledge		// of meta key modifier on osx, however, it is needed for certain		// shortcuts. This fix adds the metaKey field to the event object, so		// that all listeners that registered per Oryx plugin facade profit from		// this. The original bug is filed in		// https://bugzilla.mozilla.org/show_bug.cgi?id=418334		if (this.__currentKey == ORYX.CONFIG.KEY_CODE_META) {			event.appleMetaKey = true;		}		this.__currentKey = pressedKey;				ORYX.Log.debug("Key %0 was pressed. metaKey is %1", pressedKey, event.appleMetaKey);				// forward to dispatching.		this.handleEvents.apply(this, arguments);	},	_handleMouseDown: function(event, uiObj) {				// get canvas.		var canvas = this.getCanvas();		// find the shape that is responsible for this element's id.		var element = event.currentTarget;		var elementController = uiObj;		// gather information on selection.		var currentIsSelectable = (elementController !== null) &&			(elementController !== undefined) && (elementController.isSelectable);		var currentIsMovable = (elementController !== null) &&			(elementController !== undefined) && (elementController.isMovable);		var modifierKeyPressed = event.shiftKey || event.ctrlKey;		var noObjectsSelected = this.selection.length === 0;		var currentIsSelected = this.selection.member(elementController);		// Rule #1: When there is nothing selected, select the clicked object.		if(currentIsSelectable && noObjectsSelected) {			this.setSelection([elementController]);			ORYX.Log.trace("Rule #1 applied for mouse down on %0", element.id);		// Rule #3: When at least one element is selected, and there is no		// control key pressed, and the clicked object is not selected, select		// the clicked object.		} else if(currentIsSelectable && !noObjectsSelected &&			!modifierKeyPressed && !currentIsSelected) {			this.setSelection([elementController]);			//var objectType = elementController.readAttributes();			//alert(objectType[0] + ": " + objectType[1]);			ORYX.Log.trace("Rule #3 applied for mouse down on %0", element.id);		// Rule #4: When the control key is pressed, and the current object is		// not selected, add it to the selection.		} else if(currentIsSelectable && modifierKeyPressed			&& !currentIsSelected) {							var newSelection = this.selection.clone();			newSelection.push(elementController)			this.setSelection(newSelection)			ORYX.Log.trace("Rule #4 applied for mouse down on %0", element.id);		// Rule #6		} else if(currentIsSelectable && currentIsSelected &&			modifierKeyPressed) {			var newSelection = this.selection.clone();			this.setSelection(newSelection.without(elementController))			ORYX.Log.trace("Rule #6 applied for mouse down on %0", elementController.id);		// Rule #5: When there is at least one object selected and no control		// key pressed, we're dragging.		/*} else if(currentIsSelectable && !noObjectsSelected			&& !modifierKeyPressed) {			if(this.log.isTraceEnabled())				this.log.trace("Rule #5 applied for mouse down on "+element.id);*/		// Rule #2: When clicked on something that is neither		// selectable nor movable, clear the selection, and return.		} else if (!currentIsSelectable && !currentIsMovable) {						this.setSelection([]);						ORYX.Log.trace("Rule #2 applied for mouse down on %0", element.id);			return;		// Rule #7: When the current object is not selectable but movable,		// it is probably a control. Leave the selection unchanged but set		// the movedObject to the current one and enable Drag. Dockers will		// be processed in the dragDocker plugin.		} else if(!currentIsSelectable && currentIsMovable && !(elementController instanceof ORYX.Core.Controls.Docker)) {						// TODO: If there is any moveable elements, do this in a plugin			//ORYX.Core.UIEnableDrag(event, elementController);			ORYX.Log.trace("Rule #7 applied for mouse down on %0", element.id);				// Rule #8: When the element is selectable and is currently selected and no 		// modifier key is pressed		} else if(currentIsSelectable && currentIsSelected &&			!modifierKeyPressed) {						this._subSelection = this._subSelection != elementController ? elementController : undefined;									this.setSelection(this.selection, this._subSelection);						ORYX.Log.trace("Rule #8 applied for mouse down on %0", element.id);		}						// prevent event from bubbling, return.		Event.stop(event);		return;	},	_handleMouseMove: function(event, uiObj) {		return;	},	_handleMouseUp: function(event, uiObj) {		// get canvas.		var canvas = this.getCanvas();		// find the shape that is responsible for this elemement's id.		var elementController = uiObj;		//get event position		var evPos = this.eventCoordinates(event);		//Event.stop(event);	},	_handleMouseHover: function(event, uiObj) {		return;	},	_handleMouseOut: function(event, uiObj) {		return;	},	/**	 * Calculates the event coordinates to SVG document coordinates.	 * @param {Event} event	 * @return {SVGPoint} The event coordinates in the SVG document	 */	eventCoordinates: function(event) {		var canvas = this.getCanvas();		var svgPoint = canvas.node.ownerSVGElement.createSVGPoint();		svgPoint.x = event.clientX;		svgPoint.y = event.clientY;		var matrix = canvas.node.getScreenCTM();		return svgPoint.matrixTransform(matrix.inverse());	}};ORYX.Editor = Clazz.extend(ORYX.Editor);// TODO Implement namespace awareness on attribute level./** * graft() function * Originally by Sean M. Burke from interglacial.com, altered for usage with * SVG and namespace (xmlns) support. Be sure you understand xmlns before * using this funtion, as it creates all grafted elements in the xmlns * provided by you and all element's attribures in default xmlns. If you * need to graft elements in a certain xmlns and wish to assign attributes * in both that and another xmlns, you will need to do stepwise grafting, * adding non-default attributes yourself or you'll have to enhance this * function. Latter, I would appreciate: martin�apfelfabrik.de * @param {Object} namespace The namespace in which * 					elements should be grafted. * @param {Object} parent The element that should contain the grafted * 					structure after the function returned. * @param {Object} t the crafting structure. * @param {Object} doc the document in which grafting is performed. */ORYX.Editor.graft = function(namespace, parent, t, doc) {    doc = (doc || (parent && parent.ownerDocument) || document);    var e;    if(t === undefined) {        throw "Can't graft an undefined value";    } else if(t.constructor == String) {        e = doc.createTextNode( t );    } else {        for(var i = 0; i < t.length; i++) {            if( i === 0 && t[i].constructor == String ) {                var snared;                snared = t[i].match( /^([a-z][a-z0-9]*)\.([^\s\.]+)$/i );                if( snared ) {                    e = doc.createElementNS(namespace, snared[1] );                    e.setAttributeNS(null, 'class', snared[2] );                    continue;                }                snared = t[i].match( /^([a-z][a-z0-9]*)$/i );                if( snared ) {                    e = doc.createElementNS(namespace, snared[1] );  // but no class                    continue;                }                // Otherwise:                e = doc.createElementNS(namespace, "span" );                e.setAttribute(null, "class", "namelessFromLOL" );            }            if( t[i] === undefined ) {                throw "Can't graft an undefined value in a list!";            } else if( t[i].constructor == String || t[i].constructor == Array ) {                this.graft(namespace, e, t[i], doc );            } else if(  t[i].constructor == Number ) {                this.graft(namespace, e, t[i].toString(), doc );            } else if(  t[i].constructor == Object ) {                // hash's properties => element's attributes                for(var k in t[i]) { e.setAttributeNS(null, k, t[i][k] ); }            } else {			}        }    }	if(parent) {	    parent.appendChild( e );	} else {	}    return e; // return the topmost created node};ORYX.Editor.provideId = function() {	while(true){		idCounter++;		if(!document.getElementById(ID_PREFIX + idCounter)) {			return ID_PREFIX + idCounter;		}	}};/** * When working with Ext, conditionally the window needs to be resized. To do * so, use this class method. Resize is deferred until 100ms, and all subsequent * resizeBugFix calls are ignored until the initially requested resize is * performed. */ORYX.Editor.resizeFix = function() {	if (!ORYX.Editor._resizeFixTimeout) {		ORYX.Editor._resizeFixTimeout = window.setTimeout(function() {			window.resizeBy(1,1);			window.resizeBy(-1,-1);			ORYX.Editor._resizefixTimeout = null;		}, 100); 	}};