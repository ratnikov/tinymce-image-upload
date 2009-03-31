var FM_Instance = Class.create();
FM_Instance.prototype = {
	active: false,
	initialize:function(element, settings) {
		this.opts = Object.extend({
			context:"view", type:"image", folder:"",
			prefetch:false, init_onload:true, draggable:true,
			animate:false, bg:true, show_folder_path:false,
			close_effect:"switchoff", reference_url:"", manager:"",
			page_size:50, default_sort:"date",
            disabled_tools:"", upload_image_exts:'', upload_document_exts:'',
			onFileSelected:Prototype.emptyFunction,
			response:null, crop:null, filters:null,
			include_default_filters:true,
			custom_fields:null,
            //when context='element'...
			launcher:null, crop_tip:null,
	        type_name:"", preview_img:null,
	        preview_img_default:"", preview_setting:"",
            //when context='view'...
			show_switcher:true, image_folder:"", document_folder:"",
            //when context='editor'...
            disabled_fields:"",
			markup:null, sizes:null,
            default_size:"medium", include_default_sizes:true
		}, settings || {});

	    this.opts.id = element; //store id of element for this manager
		this.opts.element = $(element); //try to get DOM element...
		if (!this.validateOptions()) return; //failed to initialize

		//filter options; only extend defaults if asked for or no filters passed
		if(this.opts.include_default_filters || !this.opts.filters) {
			this.opts.filters = Object.extend({ //filters for images (by width)
		        Small:"1-250",
		        Medium:"251-600",
		        Large:"601-1200"
	        }, this.opts.filters || {});
		}

		//crop options; will add callback below for when crop dims change
		this.opts.crop = Object.extend({ //(can also pass additional options like captureKeys,minWidth,minHeight,maxWidth,maxHeight
		    border:50,          //padding around initial crop frame
		    ratioDim:{x:0,y:0}  //ratio constraint; leave x=y=0 for no constraint
	    }, this.opts.crop||{});
		
		//allowed types to upload
		if (!this.opts.upload_document_exts || this.opts.upload_document_exts == '') this.opts.upload_document_exts = FileManager.default_ext['document'];
		else this.opts.upload_document_exts = this.opts.upload_document_exts.replace(/,/g,'|'); //fix comma/pipes

		if (!this.opts.upload_image_exts || this.opts.upload_image_exts == '') this.opts.upload_image_exts = FileManager.default_ext['image'];
		else this.opts.upload_image_exts = this.opts.upload_image_exts.replace(/,/g,'|'); //fix comma/pipes

		this.opts.type_definite = (this.opts.type == "image")? "an image":"a document";

		if (this.opts.prefetch) this.load();

        //if context is 'view', don't need response, bounds
        if (this.opts.context == "view") return;

		//crop_tip options (only applicable to 'element' type managers)
		if (this.opts.context == "element" && this.opts.crop_tip) {
		    this.opts.crop_tip = Object.extend({
                title: "Tip title", //title of the tip
                body: "Tip body text", //body of the tip (can include images)
                alert: null,
                alerts: null //can also pass array of alerts for this tip, if multiple tips are needed
            }, this.opts.crop_tip);

            //didn't pass array of alerts; set to empty array
            if (!this.opts.crop_tip.alerts) this.opts.crop_tip.alerts = [];
            //passed single, add to array
            if (this.opts.crop_tip.alert) this.opts.crop_tip.alerts.push(this.opts.crop_tip.alert);

            this.opts.alerts = []; //create array of alerts
            for (var i=0; i<this.opts.crop_tip.alerts.length; i++) { //create each alert obj
		        this.opts.alerts.push(new FM_Alert(this.opts.crop_tip.alerts[i])); //see FM_Alert for default opts
    		}
		}

	    //response options...
	    this.opts.response = Object.extend({
	        value:"path",               // [path|name] what type of value will be returned
	        width:"", height:"",        // width and/or height of img (each can be int or range); leave blank to allow all sizes (if img too small, will be greyed out)
	        //resize_with_handler ONLY applies when file doesn't match size chosen or width/height bounds passed in response
	        resize_with_handler:true,   //flag; determines if ok to use handler params to return desired size; if false, will save new, resized file to use
	        ext:""                      //file extensions allowed (use | or ; to separate multiple exts) if left blank, will use defaults
        }, this.opts.response || {});

		if (!this.opts.response.ext || this.opts.response.ext == "")
		    this.opts.response.ext = FileManager.default_ext[this.opts.type]; //get default exts
        else
	        this.opts.response.ext = this.opts.response.ext.replace(/\./g,'').replace(/,/g,'|'); //remove periods, replace commas w/ pipes

        //bounds (if any) on the size/dims of the file to return
        this.opts.bounds = {
            apply:false,                //flag to indicate if we need to check bounds 
            msg:'',                     //message to display if file doesn't meet bounds
            size:0,                     // # of bytes (not working yet...)
            width:0, height:0,          //w/h used for: exact value, or min value from range
            max_width:0, max_height:0   //max w/h used for: exact value, or max value from range
        };

        if (this.opts.type == "image") { //right now only have dim bounds on imgs...
            var greyed_type = (this.opts.type_name && this.opts.type_name != "")? this.opts.type_name:"this context";
            this.opts.bounds.msg = "Greyed out images are too small for " + greyed_type + ".";
            if (this.opts.response.width != "") { //parse passed width
		        var w = this.opts.response.width.split('-'); //try to get max/min from required value
		        if(w.length == 1) this.opts.bounds.width = this.opts.bounds.max_width = parseInt(w[0], 10);
		        else if(w.length >= 2) {
			        this.opts.bounds.width = Math.min(parseInt(w[0], 10), parseInt(w[1], 10));
			        this.opts.bounds.max_width = Math.max(parseInt(w[0], 10), parseInt(w[1], 10));
		        }
            }
            if (this.opts.response.height != "") { //parse passed height
		        var h = this.opts.response.height.split('-'); //try to get max/min from required value
		        if(h.length == 1) this.opts.bounds.height = this.opts.bounds.max_height = parseInt(h[0], 10);
		        else if(h.length >= 2) {
			        this.opts.bounds.height = Math.min(parseInt(h[0], 10), parseInt(h[1], 10));
			        this.opts.bounds.max_height = Math.max(parseInt(h[0], 10), parseInt(h[1], 10));
		        }
            }
            // if any bounds present, set flag to indicate bounds need to be applied
            if (this.opts.bounds.width>0 || this.opts.bounds.height>0 || this.opts.bounds.max_width>0 || this.opts.bounds.max_height>0)
                this.opts.bounds.apply = true;

            //if we have both w & h, apply ratio to crop
            if (this.opts.bounds.width > 0 && this.opts.bounds.height > 0)
                this.opts.crop.ratioDim = {x:this.opts.bounds.width, y:this.opts.bounds.height};
        }

		//options only needed for editor
		if (this.opts.context == "editor") {
		    //parse editorId from passed id
		    this.opts.editorId = element.replace(/_(image|document)manager$/i, "");

		    //markup options (either for images or docs)
		    if (this.opts.type == "image") {
        		this.opts.markup = Object.extend({ //html markup settings for inserting img
		            tag:"div", // tag element to wrap img with
		            align_left_class:"call-l", //css classes for left/right alignment (will be applied to 'tag' element above)
		            align_right_class:"call-r",
		            caption_tag:"p", // tag to wrap caption
		            caption_class:"", // css class for caption tag
		            credit_tag:"p", // tag to wrap caption
		            credit_class:"info" // css class for caption tag
	            }, this.opts.markup || {});
	            
	            //auto disable extra fields if only inserting img tag
	            if (this.opts.markup.tag == "" || this.opts.markup.tag == "img") this.opts.disabled_fields += ",caption,credit";
        	}
        	else {
        		this.opts.markup = Object.extend({ //html markup settings for inserting document
        		    target:"_blank", //target for document links
		            pdf_class:"", //css class for anchor (only for .pdf files)
		            doc_class:"" //css class for anchor (only for .doc files)
	            }, this.opts.markup || {});
        	}

		    //size options; only extend defaults if asked for or no sizes passed
		    if(this.opts.include_default_sizes || !this.opts.sizes) {
			    this.opts.sizes = Object.extend({ //sizes to constrain image chosen (by width)
		            Small:150,
		            Medium:350,
		            Large:500
	            }, this.opts.sizes || {});
		    }
		    if (!this.opts.default_size) this.opts.default_size = "";
		    this.opts.default_size = this.opts.default_size.toLowerCase(); //make sure it's lower case for comparison
        }
	},
	

	validateOptions:function() {
        //fix plural type (removing trailing 's')
		if (this.opts.type && this.opts.type.lastIndexOf('s') == this.opts.type.length-1)
		    this.opts.type = this.opts.type.substr(0, this.opts.type.length-1);

        //check for config errors...
		if (this.opts.context != "editor" && this.opts.launcher && !$(this.opts.launcher))
			return FileManager.kill("FileManager warning: launcher element '" + this.opts.launcher + "' not found.");

		if (this.opts.context != "editor" && !this.opts.element && !this.opts.launcher)
		    //didn't find the element in the DOM... (only 'editor' context uses an ID that doesn't correspond to DOM element)
			return FileManager.kill("FileManager warning: element '" + this.opts.id + "' not found.");

		if (this.opts.context != "view" && this.opts.context != "element" && this.opts.context != "editor") //unrecognized context
			return FileManager.kill("FileManager warning: context specified '" + this.opts.context + "' not valid (only 'view' or 'element' allowed).");

		if (this.opts.type != "image" && this.opts.type != "document") //unrecognized type
			return FileManager.kill("FileManager warning: type specified '" + this.opts.type + "' not valid (only 'image' and 'document' allowed).");

	    var f = this.currFld();
		if (f == "") //no folder paths
			return FileManager.kill("FileManager warning: no file path specified for '" + this.opts.type + "' type.");

		this.active = true; //only active after checking for config errors above
		return true;
	},

	hasSwitchFld:function() {
	    if (this.opts.type == "image" && this.opts.document_folder && this.opts.document_folder != "")
	        return true;
	    if (this.opts.type == "document" && this.opts.image_folder && this.opts.image_folder != "")
	        return true;

        return false;
	},

	currFld:function() {
	    if (this.opts.type == "image" && this.opts.image_folder && this.opts.image_folder != "")
	        return this.opts.image_folder;
	    if (this.opts.type == "document" && this.opts.document_folder && this.opts.document_folder != "")
	        return this.opts.document_folder;

        return (this.opts.folder || ""); //default to generic folder
	},
	
	setPreselectedFile:function(file) {
	    this.preselected = file;
	},

	load:function(force_list, bg) {
	    var f = this.currFld();
	    //var bg = "";
	    if (!FM_Data.filesLoaded(f)) {
	        var curr_file = null;
	        var curr_mgr = ((this.opts.manager && this.opts.manager!="")?"&FileManager="+this.opts.manager:"");
	        if (this.opts.context == "element") curr_file = $F(this.opts.element);
	        else if (this.preselected && this.preselected.path) curr_file = this.preselected.path;

    		if (!force_list && curr_file && curr_file != "") {
    	        //if (!curr_file.include(f)) curr_file = f + curr_file;
        	    curr_file = FM_Util.getPathFromHandlerUrl(f, curr_file);
    	        
    		    FM_Data.load("action=detail&path=" + f + "&file=" + curr_file + "&inst=" + this.opts.id + curr_mgr, f);
    		    bg = true; //load the list in bg
    		    //return;
    		}

    		FM_Data.load("path=" + f + "&type=" + this.opts.type + curr_mgr + (bg?"&bg=1":""), f);
        }
	},
	
	switchType:function(type) { //switching only applies if in 'view' context
	    this.opts.type = type;
        //this.load(); //load files for new type
	}
}


var FileManager = {
	instances:{}, //hash of manager objects; key is id passed to manager instance
	default_ext:{ image:"gif|jpg|png", document:"xls|ppt|pot|doc|dot|pdf|txt" },
	handler_ext:".ImageHandler",
	base_url:"/tinymce/jscripts/tiny_mce/plugins/filemanager/", // can modify this with setBaseUrl...
	curr_inst:null, //holds ID of current manager
	curr_mgr:"", //querystring w/ curr mgr, if any
	initialized:false,
	visible: false, //manager always start as hidden
	allow_select: true, //flag for enforcing alerts
	force_load: false,
	
	setBaseUrl:function(base) { //add in front of standard tinyMCE path
	    if (base && this.base_url.indexOf(base) != 0) this.base_url = base + this.base_url;
	},

	//the normal call to create a filemanager (for 'view' or 'element' mode; for editor, manager will be created for you; just pass opts in tinyMCE init)
	create:function(id, params) {
	    if (!id || typeof id != 'string') return this.kill("To create a FileManager, the first argument must be a string which is the id of a DOM element.");
	    if (!params) return this.kill("To create a FileManager, the second argument must be a hash of configuration options.");
	    if (this.instances[id] && this.instances[id].opts.type == params.type) return this.kill("A FileManager has already been associated with '" + id + "'.");

        if (params.context != "editor") {
            //add opening listener now; so if init fails, listener is still called on element click to display err msg
		    if(params.launcher && $(params.launcher))
		        Event.observe(params.launcher, "click", this._openClick.bindAsEventListener(this, id));
		    if($(id))
		        Event.observe(id, "click", this._openClick.bindAsEventListener(this, id));
		}

	    //create and store instance obj (will call initialize func)
	    this.instances[id] = new FM_Instance(id, params);

	    if (this.instances[id].active && this.instances[id].opts.init_onload) this.initFM(); //only init the global manager once

	    return this.instances[id].opts; //return final opts (so tinyMCE code has opts)
	},
	
	//call to remove a filemanager attached to an element
	remove:function(id) {
	    if (!id || typeof id != 'string') return this.kill("To remove a FileManager, the only argument must be a string which is the id of a DOM element.");
	    if (!this.instances[id]) return this.kill("A FileManager cannot be found associated with '" + id + "'.");

	    //remove instance obj
	    this.instances[id] = null;
	},

	initFM:function() {
        if (!this.initialized) { //only init once
		    this.initialized = true;
		    this.bindFunctions();
		    FM_Util.createWinInDOM();
		}
	},

	_openClick:function(e, id) { // manager id is passed because of binding
	    if (typeof($) == 'undefined') return; //Prototype library not loaded yet
	    this.open(id);
		Event.stop(e);
	},

    kill:function(msg, e) {
		alert(msg);
		if (e) Event.stop(e);
		return false;
    },
    
    setInst:function(inst) {
        if (typeof(inst) == 'string') inst = this.instances[inst]; //if it looks like an id passed, try to find inst
        if (!inst) return;
        this.curr_opts = inst.opts;
	    this.curr_inst = inst.opts.id; //store curr inst id
        this.curr_sort = inst.opts.default_sort;
    },

	open:function(inst, selected_file) {
        if (this.visible) return; //if already visible, skip

        if (typeof(inst) == 'string') inst = this.instances[inst]; //if it looks like an id passed, try to find inst

	    if (!inst) return this.kill("Manager cannot be found for this element. Check documentation and try again.");
		if (!inst.active) return this.kill("Manager is not available because initialization failed. Check documentation and try again.");
		// KSTD: move to instance validation...
		//if (this.curr_fld == "") return this.kill("Manager is not available because no folder path was supplied. Check documentation and try again.");

	    this.initFM(); //make sure global manager init

	    Event.observe(window, "resize", this.drawWin);
	    Event.observe(window, "scroll", this.drawWin);
	    Event.observe(document, "keydown", this.captureKeys);
	    Event.observe('win-search-txt', "keyup", this.search);

		this.curr_fld = inst.currFld();

        if(selected_file && selected_file.path) {
            this.sel_file = selected_file; //store attr of file existing in editor
            inst.setPreselectedFile(selected_file); //also store in inst
        }
        else if(inst.opts.context == "element") {
            this.sel_file = $F(inst.opts.element); //parse value from form element, if any
            if (!this.sel_file || this.sel_file == "") this.sel_file = null;
        }
        else this.sel_file = null;
        
        if (inst.opts.context == "editor") { //for IE, need to store the curr selection, to be able to restore selection once win is closed
		    var ed_inst = tinyMCE.selectedInstance;
			if (ed_inst) ed_inst.selectionBookmark = ed_inst.selection.getBookmark(true);
        }

        this.configureContext(inst);
        //instance or type changed
        if (!this.curr_opts || this.curr_inst != inst.opts.id || this.curr_opts.type != inst.opts.type) this.configureType(inst);

        //wait until configure methods called to set curr opts, inst
        this.setInst(inst);

        this.hideMsg();
		if (Prototype.Browser.IE) this.toggleSelectBoxes(false);
   		this.resetSearch(); //always reset search on open
        this._drawWin(inst.opts);
        this.visible = true;
	    this.setSort(this.curr_sort);

        //KSTD: move elsewhere?
	    if (!FM_Data.filesLoaded(this.curr_fld)) {
	        //this.debug('FileManager.open; files not loaded...')
            FM_Util.loading(true, 'files');
	        this.displayPanel();
	        inst.load();
	        return;
	    }

        if (this.sel_file && this.sel_file.path) { //if a file was passed in...
            this.curr_file = FM_Data.findFileFromPath(this.curr_fld, this.sel_file.path);
            if (this.curr_file && this.curr_file.isImage()) //found img, store attributes... will we need any attribs for doc?
                this.curr_file.opts.attr = Object.extend(this.curr_file.opts.attr, selected_file);
        }
        else if (this.curr_opts.context == "element" && this.sel_file) {
            this.curr_file = FM_Data.findFileFromPath(this.curr_fld, this.sel_file); //parse value from form element, if any
            if (!this.curr_file) this.fileNotFound();
            //if (this.curr_file) this.sel_file = this.curr_file.opts;
        }
	    
	    //this.debug('calling displayList from open; curr_file: ' + this.curr_file)
	    if (!this.curr_file) this.displayPanel();
        this.displayList();
	},

	_close:function(e) {
	    Event.stopObserving(window, "resize", this.drawWin);
	    Event.stopObserving(window, "scroll", this.drawWin);
	    Event.stopObserving(document, "keydown", this.captureKeys);
		Event.stopObserving('win-search-txt', "keyup", this.search);

		//var inst = this.instances[this.curr_inst];
		if (!this.curr_opts) return;

	    if (this.win_drag) this.win_drag.destroy();

        var win = $$('div.win')[0];
        $$('div.win-bg').invoke('hide');
        if (this.curr_opts.animate) {
            if (this.curr_opts.close_effect == "switchoff")
                Effect.SwitchOff(win, {duration:0.3, from:1.0, to:1.0, afterFinish:this.onClosed});
            else
                Effect.Fade(win, {duration:0.3, afterFinish:this.onClosed});
        }
        else {
            win.hide();
		    this._onClosed(); //call directly
        }
        this.visible = false;
		if (Prototype.Browser.IE) this.toggleSelectBoxes(true);

		if (e) Event.stop(e);
	},
	
	toggleSelectBoxes:function(show) {
	    //need to hide select boxes b/c they appear on top of win in IE6
        $$('select.mceSelectList', 'div.form select').invoke(show?'show':'hide');
	},

	_onClosed:function() { //things to call after close effect finished...
   		this.resetSearch();
		this.clearList();
        this.clearSelection();
		//this.clearDetail();
		this.prev_inst = this.curr_inst; //store previous inst
		this.curr_inst = this.curr_panel = null;
	},
	
	_drawWin:function(opts) {
        var win = $$('div.win')[0];
        var vp = FM_Util.getPageSize(); // idx 0,1 is full page size; 2,3 is view port size
        var curr_size = FileManager.curr_win_size;
        if (win.visible() && curr_size && vp[0] == curr_size['w'] && vp[1] == curr_size['h']) return;

        FileManager.curr_win_size = {'w':vp[0], 'h':vp[1]};

        var basetop, xy;
		//check position; might be scrolled down
        if (FM_Util.convertVersionString(Prototype.Version) < FM_Util.convertVersionString("1.6.0")) {
			xy = Position.page(win); 
	        basetop = 0-xy[1];
        }
        else { //document.viewport only available in prototype 1.6 or later
			xy = document.viewport.getScrollOffsets();
			basetop = xy.top;
        }
        if (basetop < 0) basetop = 0;

        //assuming 800/600 (set in stylesheet)
        var left = Math.round((vp[2]-800)/2), top = Math.round((vp[3]-600)/2);
        if (left < 0) left = 0;
        if (top < 0) top = 0;

        var bg = $$('div.win-bg')[0];
        bg.setStyle({height:vp[1]+'px', position:'absolute'});
        win.setStyle({left:left+'px',top:(basetop+top)+'px', position:'absolute'});

	    if (!win.visible()) { //show win and bg
            var op = (opts.bg)? 0.3 : 0.0;
	        if (opts.animate) {
                Effect.Appear(bg, {duration:0.2, to:op});
	            Effect.Appear(win, {duration:0.3});
	        }
	        else {
                //bg always uses appear, to stop at 30% opacity (or 0 if we don't want to see bg)
                Effect.Appear(bg, {duration:0.2, to:op, afterFinish:function(){ win.show(); }});
            }
            //handle is h1; draggable will change opacity unless you null the start/end effects
            var h1 = $$('div.win h1')[0];
            if (opts.draggable) this.win_drag = new Draggable(win, {handle:h1, starteffect:null, endeffect:null});
            h1.setStyle({"cursor":(opts.draggable)?"move":"default"});
	    }
	    else FileManager.debug('win already visible, not showing')
	},
	
	_cancel:function(e) {
		var link = Event.element(e);
	    var next = link? link.readAttribute('goto'):''; //link should have 'goto' attribute for where to return to
	    if (next == "info") this.showInfo();
        if (next == "detail" || next == "fields") this.showDetail();
        if (next == "list") this.showFiles();
		Event.stop(e);
	},
	
	_captureKeys:function(e) {
		var elm = Event.element(e);
		if (e.keyCode == Event.KEY_BACKSPACE && elm) { //if not typing, stop bksp to avoid going to prev page in browser
		    if(elm.tagName.toLowerCase() != 'input' && elm.tagName.toLowerCase() != 'textarea') Event.stop(e);
		}
		if (e.keyCode == Event.KEY_ESC) { //esc key pressed...
		    var action_bc = $($('win-crumbs-action').parentNode); //crop or info breadcrumb
		    if (action_bc.visible()) this.showDetail(); //when crop or info, show detail
		    else if (this.curr_file || $('win-search-txt').value != "" || $('win-content-upload').visible()) this.showFiles(); //esc when viewing file, go to list
		    else this._close(); //when viewing list, close
    		//Event.stop(e);
		}
	},

	configureContext:function(inst) {
        if (this.curr_opts && this.curr_opts.context == inst.opts.context && this.curr_inst == this.prev_inst) {
            this.debug('skipping configureContext...')
            return; //context hasn't changed...
        }
        //set curr manager querystring, if any
        this.curr_mgr = ((inst.opts.manager && inst.opts.manager!="")?"&FileManager="+inst.opts.manager:"");

        var filter = $('win-file-filter');
        while (filter.firstChild) filter.removeChild(filter.firstChild);
        for(var f in inst.opts.filters)
            filter.appendChild(Builder.node("option", {"value":inst.opts.filters[f]}, [f]));
        filter.appendChild(Builder.node("option", {"value":""}, ["All sizes"]));
        this.resetFilter();

		//custom fields
        var custom_fields = $('win-content-custom-attr');
        while (custom_fields.firstChild) custom_fields.removeChild(custom_fields.firstChild);
		if (inst.opts.custom_fields) {
			custom_fields.show();
			$A(inst.opts.custom_fields).each(function(cf) {
				custom_fields.appendChild(Builder.node("dt", cf.title));
				custom_fields.appendChild(Builder.node("dd", {"id":"win-content-custom-attr-" + cf.key}));
			});
        }
		else custom_fields.hide();

        //set window title
        var hdr = $$('div.win h1')[0];
	    if (inst.opts.context == "view") {
	        hdr.innerHTML = "Files";
	        if (inst.hasSwitchFld())
                this.swapSwitcher(inst.opts.type);
            else
                $$('ul.win-switcher').invoke('hide'); //hide switcher
	    }
        else {
	        hdr.innerHTML = (inst.opts.context == "editor"? "Insert ":"Select ");
            if (inst.opts.type_name && inst.opts.type_name != "") hdr.innerHTML += inst.opts.type_name;
		    else hdr.innerHTML += inst.opts.type_definite;
            $$('ul.win-switcher').invoke('hide'); //hide switcher
    	}

        // imgs might needs fields (editor: caption, credit, size; element might have crop tips)
        var extra_fields = false;
        if (inst.opts.type == "image") {
            if (inst.opts.context == "editor") {
                FM_Util.createFileFields(inst.opts.disabled_fields);  //create fields if not already
                extra_fields = true;
            }
            else if (inst.opts.context == "element") {
                if (inst.opts.crop_tip) {
                    FM_Util.createCropTips(inst.opts.crop_tip); //create tip if not already
                    extra_fields = true;
                }
                else FM_Util.removeFieldsDIV();
            }
        }

        //sizes
        var size = $('win-fields-size');
        if (inst.opts.context == "editor" && size) {
            while (size.firstChild) size.removeChild(size.firstChild); //clear prev
            for(var s in inst.opts.sizes) {
                if (s.toLowerCase() != "custom")
                    size.appendChild(Builder.node("option", {"value":inst.opts.sizes[s]}, [s]));
            }
            size.appendChild(Builder.node("option", {"value":""}, ["Custom"])); //add custom after; can't be selected by default
            //size.selectedIndex = selected_idx;
            this.setPreviewSize(size, inst.opts.default_size);
        }

        //hide any disabled btns
	    if (inst.opts.disabled_tools && inst.opts.disabled_tools != "") {
	        var btns = FM_Util.getBtns(inst.opts.disabled_tools);
	        if (btns.length) btns.invoke('hide');
	        else btns.hide(); //single btn
	    }
	    else FM_Util.getBtns().invoke('show'); //show all

        //if 'view', can't select
        var select_cancel = $("win-file-select-cancel");
        //don't need select, cancel if context = view; if editor, then no fields used, keep select,cancel
        //if (inst.opts.context == "element" || (inst.opts.context == "editor" && inst.opts.type == "document")) select_cancel.show();
        if (inst.opts.context != "view" && !extra_fields) select_cancel.show();
        else select_cancel.hide();

        //back to links from detail
        var backto_list = $$("#win-link-backto-links a[goto=list]")[0];
        var backto_fields = $$("#win-link-backto-links a[goto=fields]")[0];
        //only when fields div exists for imgs do we need link from info back to fields
        if (extra_fields) {
            backto_list.hide();
            backto_fields.show();
            $('win-content-file-detail').hide(); //hide detail
        }
        else {
            backto_fields.hide();
            backto_list.show();
        }
	},

	configureType:function(inst) {
	    this.prev_file_list = this.force_load = null; //clear prev files and force_load flag
        var parent = this.getCurrList(inst.opts.type);
        this.setPaging(parent.page_count);
        if (inst.opts.context == 'view') {
            //this.swapSwitcher(inst.opts.type);
	        if (inst.hasSwitchFld())
                this.swapSwitcher(inst.opts.type);
            else
                $$('ul.win-switcher').invoke('hide'); //hide switcher
        }

        var filter = $('win-file-filter'); //list filter; prev is label
   	    var dims_info = $($('win-content-file-info-width').parentNode); //dd for img w/h; prev is dt
   	    var dims_lbl = dims_info.previous();

        var btn_type = inst.opts.context != 'editor'? 'Select ':(this.sel_file? 'Update ':'Insert ');
        btn_type += inst.opts.type;
		$$('#win-file-select-cancel input', '#win-file-select-btn').each(function(b){b.value=btn_type});

        if (inst.opts.type == 'image') {
            if (inst.opts.animate) {
                Effect.Fade($('win-content-doc-list'), { duration:0.1, queue:{scope:'file_list', position:'front'} });
                Effect.Appear($$('ul.win-thumbs')[0], { duration:0.1, queue:{scope:'file_list', position:'end'} });
            }
            else {
                $('win-content-doc-list').hide();
                $$('ul.win-thumbs')[0].show();
            }

            //only show crop if not disabled
    	    if (!inst.opts.disabled_tools || inst.opts.disabled_tools.indexOf('crop') == -1)
    	        FM_Util.getBtns('crop').show();

            //$$('div.win-work-area')[0].show();
            /*
            this.debug('showing work-area... already visible? ' + work_area.visible())
            if (!work_area.visible()) {
                this.debug('showing work-area b/c not visible', true)
                work_area.show();
            }*/
            filter.show();
            filter.previous().show();
            dims_info.show();
            dims_lbl.show();
        }
        else { //documents
            if (inst.opts.animate) {
                Effect.Fade($$('ul.win-thumbs')[0], { duration:0.1, queue:{scope:'file_list', position:'front'} });
                Effect.Appear($('win-content-doc-list'), { duration:0.1, queue:{scope:'file_list', position:'end'} });
            }
            else {
                $$('ul.win-thumbs')[0].hide();
                $('win-content-doc-list').show();
            }

    	    FM_Util.getBtns('crop').hide();
            //$$('div.win-work-area')[0].hide();
            filter.hide();
            filter.previous().hide();
            dims_info.hide();
            dims_lbl.hide();
        }
	},
	
	swapSwitcher:function(type) {
        $('win-switcher-'+type).show();
        $('win-switcher-'+(type=='image'?'document':'image')).hide(); //opposite
	},

	resetTools:function(panel) {
   	    FM_Util.setBreadcrumb('browse',true,true,'',false);
	    FM_Util.setBreadcrumb('action',false);
	    FM_Util.setBreadcrumb('detail',false);
	    FM_Util.getBtns('download,delete,crop').invoke('addClassName','disabled');
	    if (panel == 'upload') {
    	    //this.clearSelection();
            Effect.Appear($$('div.win-cover')[0], { duration:0.1, to:0.5 });
	    }
	    else { //for list
    	    FM_Util.getBtns('upload').removeClassName('disabled').removeClassName('current');
            $$('div.win-cover')[0].hide();
        }
	},

	displayMsg:function(txt, crop) {
	    //this.debug('displayMsg: ' + txt)
	    var msg = [];
        msg.push(txt + ' ');
        if (crop) msg.push(Builder.node('a', {'href':'#'}, ['Undo']));
	    //add notice between h1 and it's next sib
        FM_Util.loading(false);
	    $$('div.win')[0].insertBefore(Builder.node("div", {"id":"win-notice-msg", "class":"win-notice"}, [Builder.node('span',msg)]), $$('div.win h1')[0].next());
	    if (crop) Event.observe($$('div.win-notice a')[0], 'click', this.cropUndo.bindAsEventListener(this));
	},

	highlightMsg:function(elm, q) {
	    var scope = (q || "msg");
        Effect.Appear(elm, { duration:0.1, queue:{scope:scope, position:'front'} });
        new Effect.Highlight(elm, { duration:3, queue:{scope:scope, position:'end'} });
	},

	hideMsg:function() {
	    var msgs = $$('#win-notice-msg');
	    //this.debug('hiding msg... ' + msgs.length + ' msgs found')
	    msgs.invoke('remove');
        this.curr_msg = null;
	    //$$('#win-notice-msg').invoke('remove');
	},
	
	imageLoaded:function() {
	    //preview img is initially hidden to hide prev preview img... show it now
        var img = $('win-preview-img');
        if (img) img.show();
	    FM_Util.loading(false); //hide loading msg

        //if undoing crop, crop might be created before img loads; make sure crop size shown is correct
        if (this.curr_crop) this._onCropChanged();
	},
	
	_switchTypeClick:function(e) {
		var btn = Event.findElement(e, 'A');
        if (btn) this.switchType(btn.readAttribute('goto')); //btn should have 'goto' attribute for which type to view
        Event.stop(e);
	},
	
	switchType:function(type) {
	    if (!type) return;
        var inst = this.instances[this.curr_inst];
        if (!inst) return;

	    if (this.curr_opts.type == type) return;

        this.curr_opts.type = type;
        this.clearSelection();
        //this.clearDetail();
		this.resetSearch();
        inst.switchType(type);
		this.curr_fld = inst.currFld();
        this.configureType(inst);

        var files_loaded = FM_Data.filesLoaded(this.curr_fld);

        if (this.curr_panel == 'upload') { //don't load if trying to upload
            //this.debug('forcing upload panel from configureType')
    	    if (!files_loaded) inst.load(false, true); //load files in bg
            this._showUpload();
            return;
        }

	    if (!files_loaded) inst.load(); //once file data loaded, displayList will be called
        else this.displayList(true); //force redraw
	},

	displayPanel:function(panel) {
		var show = (panel || 'list'); //default to list
		var hide = (show == 'list')? 'detail':'list';
		var hide2 = (show == 'upload')? 'detail':'upload';
	    var p = 'win-content-';
	    //this.debug('in displayPanel, show,hide,hide2: ' + show + ',' + hide + ',' + hide2 + '; curr_panel: ' + this.curr_panel)
		if (this.curr_panel != show) { //only change if needed
		    this.curr_panel = show;
            if (show != 'list') this.hideMsg(); //clear prev msg

		    var anim = this.curr_opts.animate;
		    hide = $(p+hide);
		    hide2 = $(p+hide2);
		    show = $(p+show);
            if (hide.visible()) {
                if (anim) Effect.Fade(hide, {duration:0.01, from:0.5, queue:{scope:'panel', position:'front'} });
                else hide.hide();
            }
            if (hide2.visible()) {
                if (anim) Effect.Fade(hide2, {duration:0.01, from:0.1, queue:{scope:'panel', position:'front'} });
                else hide2.hide();
            }
            if (!show.visible()) {
                if (anim) Effect.Appear(show, {duration:0.2, queue:{scope:'panel', position:'end'} }); //queue at 'end' to run after fade finishes
                else show.show();
            }
        }
	},

	switchFilePanel:function(panel, for_detail) {
        this.hideMsg(); //clear prev msg
	    var p = 'win-content-file-';
	    var show = panel;
	    var hide = $(p + (show == 'detail'? 'fields':'detail'));
	    var hide2 = $(p + (show == 'crop'? 'fields':'crop'));

        if (Prototype.Browser.IE) $$('div.win-work-area').invoke('setStyle',{visibility:'visible'}); //fix strange ie bug

	    if (this.curr_opts.animate) { //use scriptaculous effects
            if (hide) Effect.Fade(hide, {duration:0.1, from:0.5, queue:{scope:'detail', position:'front'} });
            if (hide2) Effect.Fade(hide2, {duration:0.1, from:0.1, queue:{scope:'detail', position:'front'} });
            Effect.Appear($(p+show), {duration:0.2, queue:{scope:'detail', position:'end'} }); //queue at 'end' to run after fade finishes
        }
        else { //no effects
            if (hide) hide.hide();
            if (hide2) hide2.hide();
            $(p+show).show();
        }

	    this.curr_file_panel = show;
	    //this.debug("switchFilePanel('"+panel+"',"+for_detail+"): show=" + show)

        if (for_detail) { //ok to skip crumbs if clearing isn't for detail
    	    FM_Util.getBtns('download,delete,crop').invoke('removeClassName','disabled');
    	    FM_Util.setBreadcrumb('browse',false,true,'',false);
            // show search at 50% opacity
            Effect.Appear($$('div.win-cover')[0], { duration:0.1, to:0.5 });

            if (show == 'detail' || show == 'fields') {
        	    FM_Util.getBtns('crop').removeClassName('current');
        	    FM_Util.getBtns('download,delete,upload').invoke('removeClassName','disabled');

                if (show == 'detail' && $(p+'fields') && this.curr_opts.type == "image") { //imgs in editor use fields; detail (info) needs special breadcrumb
        	        FM_Util.setBreadcrumb('detail',false,true);
        	        FM_Util.setBreadcrumb('action',true,true,"Info");
                }
                else {
            	    FM_Util.setBreadcrumb('detail',true,true,this.curr_opts.type);
            	    FM_Util.setBreadcrumb('action',false);
                }
            }
            else if (show == 'crop') { //if cropping, upload, download, del btns are disabled
           	    FM_Util.getBtns('download,delete,upload').invoke('addClassName','disabled');
           	    FM_Util.getBtns('crop').addClassName('current');
    	        FM_Util.setBreadcrumb('detail',false,true);
    	        FM_Util.setBreadcrumb('action',true,true,show);
            }
        }
	},

	_showFiles:function(e) { //used by 'browse' btn
		//reset view if file list already visible...
		var force = false, p = null;
        if (this.curr_panel == 'list') {
    		this.prev_file_list = null; //clear prev files
	    	this.resetSearch();
	    	this.resetFilter();
	    	force = true;
	    	p = 1;
	    }
        else FM_Util.loading(true, 'files');

        //this.hideMsg(); //clear prev msg
        this.clearSelection();
		//this.clearDetail();
		this.displayList(force, p);
        if (e) Event.stop(e);
	},

	_downloadFile:function(e) {
		if (!FM_Util.validBtn(e)) return; //can't download if btn disabled
	    if(!this.curr_file) alert("No file currently selected.");
	    else {
            //FM_Util.loading(true, 'download');
	        //Event.observe('win-download-frame', 'load', function(){FM_Util.loading(false, 'download');});
	        $('win-download-frame').src = this.base_url+"download.aspx?path=" + this.curr_file.path + this.curr_mgr;
	    }
		Event.stop(e);
	},

	_deleteFile:function(e) { //don't have event if called by cropUndo
		if (e && !FM_Util.validBtn(e)) {
		    if (this.curr_file) alert('This file cannot be deleted because it is being used elsewhere.');
		    return; //can't delete if btn disabled
		}

		var params = "?action=delete&path=" + this.curr_fld + "&file=" + this.curr_file.name + "&type=" + this.curr_opts.type + this.curr_mgr;
		if(!e) params += "&bg=1"; //if deleting for 'undo' function, load result in background
		if(!e || confirm("Are you sure you want to delete this " + this.curr_opts.type + "?\n\n" + this.curr_file.name + "\n\nIf deleted, the " + this.curr_opts.type + " cannot be recovered. Continue?"))
			FM_Util.loadXml(this.base_url + "jsonFileData.aspx" + params, null, this.actionCompleted, 'delete');

		if (e) Event.stop(e);
	},

	_showUpload:function(e) {
		if (e && !FM_Util.validBtn(e)) return; //can't upload if btn disabled
	    FM_Util.getBtns('upload').addClassName('current');
	    this.resetTools('upload'); //make sure btns are disabled
	    
	    if (!this.curr_opts) return this.kill("FileManager error: showUpload failed, couldn't find current instance.", e);
	    
	    var exts = this.curr_opts['upload_'+this.curr_opts.type+'_exts'];
        FM_Util.loading(true, 'upload');
	    var url = "upload.aspx?path=" + this.curr_fld + "&type=" + this.curr_opts.type + "&ext=" + exts + this.curr_mgr; //reload frame each time
	    if (this.curr_opts.custom_fields) {
	        var custom_qstr = "";
			$A(this.curr_opts.custom_fields).each(function(cf) {
			    if (cf.gather) {
                    if (custom_qstr != "") custom_qstr += ",";
			        custom_qstr += cf.key + "|" + cf.title;
			    }
    	    });
    	    if (custom_qstr != "") url += "&custom_fields=" + custom_qstr;
	    }
	    $('win-content-upload-frame').src = this.base_url+url; //reload frame each time
	    Event.observe('win-content-upload-frame', 'load', this.uploadFrameLoaded);

	    //display allowed ext
	    var curr_type = this.curr_opts.type;
	    var types = exts.toLowerCase().split('|');
	    var ul = $('win-upload-types');
	    while (ul.firstChild) ul.removeChild(ul.firstChild);

        var type_count = 0;
	    types.each(function(t) {
	        t = FM_Util.typeNames[curr_type][t]; //get friendly name
	        if (!t) return; //invalid ext
	        //group microsoft exts together...
	        if (t.include('Microsoft') && ul.lastChild && ul.lastChild.innerHTML.include('Microsoft'))
	            ul.lastChild.innerHTML += ',' + t.replace('Microsoft','');
	        else
	            ul.appendChild(Builder.node('li', t));
	        type_count++;
	    });
	    if (type_count == 0) alert('Error in specified upload types!');
	    
		if (e) Event.stop(e);
	},
	
	uploadFrameLoaded:function() {
		var frame = $('win-content-upload-frame');
		var title = "";
		if (frame && frame.contentDocument && frame.contentDocument.title) title = frame.contentDocument.title;
		
        FM_Util.loading(false, 'upload');
		if (title == "You are not authorized to view this page") {
            alert("You are not authorized to upload files.");
            FileManager.showFiles();
        }
        else FileManager.displayPanel("upload");
	},

	cancelUpload:function() { //will be coming from upload frame
	    FM_Util.getBtns('upload').removeClassName('current');
		this._showFiles();
	},
	
	addUploadedFiles:function(path, fld) { //will be coming from upload frame via FileManager
	    //this.debug('in addUploadedFiles(' + path + ',' + fld + ')...')
	    this.curr_file = this.prev_file_list = null; //clear curr file & list so we always go to list to see new files
	    var inst = this.instances[this.curr_inst];
	    //check to make sure there is a current instance
		if (!inst) return this.kill("[FileManager.addUploadedFiles] Cannot find current manager instance!");

		FM_Data.load("action=add-new&file=" + path + this.curr_mgr, fld);
	},

	showInfo:function() {
        this.switchFilePanel('detail', true);
	},

	fillInfo:function() {
        var p = 'win-content-file-info-';
        $(p+'name').innerHTML = this.curr_file.name;
        $(p+'size').innerHTML = this.curr_file.getAttr('s');
        $(p+'date').innerHTML = this.curr_file.getAttr('u');
	    if(this.curr_file.isImage()) {
            $(p+'width').innerHTML = this.curr_file.getAttr('w');
            $(p+'height').innerHTML = this.curr_file.getAttr('h');
	    }
	    var file_path = $(p+'path');
	    if (this.curr_opts.show_folder_path) {
	        file_path.show();
	        file_path.previous().show(); //header
            file_path.innerHTML = FM_Data.cleanPath(this.curr_fld);
	    }
	    else {
	        file_path.hide();
	        file_path.previous().hide(); //header
	    }

		//custom fields
		if (this.curr_file.opts.custom) {
			for (var a in this.curr_file.opts.custom) {
				var field = $('win-content-custom-attr-' + a);
				if (field) field.innerHTML = this.curr_file.opts.custom[a];
			}
        }
	    
	    var clear_btn = $("win-file-fields-clear");
	    if (!clear_btn || this.curr_opts.type == "document") clear_btn = $("win-file-info-clear");
	    if (this.sel_file) clear_btn.show();
	    else clear_btn.hide();

        //show/hide full size link as needed
        var fs = $(p+'full');
	    if(this.curr_file.full_size) fs.hide();
	    else {
	        var fs_url = this.curr_file.path;
	        if (this.curr_mgr) fs_url = FM_Util.buildHandlerPath(fs_url, "");
	        fs.href = fs_url;
	        fs.show();
	    }
	},
	
	getReferences:function() {
	    //var inst = this.instances[this.curr_inst];
	    this.setReferences(); //clear
	    if (this.curr_opts && this.curr_opts.reference_url && this.curr_opts.reference_url != "") {
	        if (!this.curr_file.opts.references) //references not already retreived
	            FM_Util.loadXml(this.curr_opts.reference_url, "file=" + this.curr_file.path, this.referencesLoaded);
	        else //already loaded...
        		this.setReferences(this.curr_file.opts.references);
	    }
	},

	_referencesLoaded:function(xml) { //xml request for file references returned a result...
        var ref_arr = []; //init array of references
		var nodes, refs = $A(xml.responseXML.getElementsByTagName("FileReference"));
		if (!refs || !refs.length || refs.length == 0) {
		    this.curr_file.opts.references = true; //set to something, so we don't call again
		    return;
		}

		//var title, link;
	    for (var i = 0; i < refs.length; i++) {
	        var r = {title:'', link:''};
	        nodes = refs[i].childNodes;
		    for (var j = 0; j < nodes.length; j++) {
			    if(FM_Util.elHasTextNode(nodes[j])) {
				    if (nodes[j].nodeName == "title" || nodes[j].nodeName == "link") r[nodes[j].nodeName] = nodes[j].firstChild.nodeValue;
			    }
			}
			if (r.title != "" && r.link != "") ref_arr.push(r);
		}
        this.curr_file.opts.references = ref_arr;
		this.setReferences(ref_arr);
	},

    setReferences:function(refs) {
        var ref_ul = $('win-content-file-info-references');
        while (ref_ul.firstChild) ref_ul.removeChild(ref_ul.firstChild);
        if (!refs || !refs.length || refs.length == 0) {
            ref_ul.previous().hide();
            return;
        }
	    FM_Util.getBtns('delete').addClassName('disabled'); //if references exist, can't del
        ref_ul.previous().show();
        var ul = ref_ul.appendChild(Builder.node("ul"));
        $A(refs).each(function(r) {
            ul.appendChild(Builder.node("li", [Builder.node("a", {"href":r["link"], "target":"_blank"}, [r["title"]])]));
        });
    },

	_showDetail:function(e) {
        this.clearCrop();
        var pnl = ($('win-content-file-fields') && this.curr_opts.type == "image")? 'fields':'detail';
        this.switchFilePanel(pnl, true);

		if (e) Event.stop(e);
	},

/*
	clearDetail:function(for_detail) { //clearDetail not needed anymore?? replace w/ clearSelection

        //if (!for_detail && this.curr_panel != 'upload' && this.curr_panel != 'fields') {
        //    this.switchFilePanel('detail', for_detail); //reset file panels for next time
        //    this.debug("from clearDetail, just reset file panel to 'detail', curr_panel:" + this.curr_panel + ", for_detail? " + for_detail);
        //}
        this.clearSelection();
	},
*/

	clearSelection:function() {
        this.clearCrop();
		if(this.curr_image) this.curr_image.clear();
		this.curr_file = this.curr_image = null;
	},

    _updatePreview:function(e) {
		var elm = Event.element(e);
		var field, value, text;
		if (elm) {
    		field = elm.readAttribute('preview');
    		value = $F(elm);
    		text = elm.options[elm.selectedIndex].text;
    	}

        if (field == 'align') $('win-preview-img').setStyle({'float':value}); //set float
		else if (field == 'size' && text.toLowerCase() == "custom") this.initCustomPreview();
        else this.renderPreview();
    },

    _updateCustomPreview:function(e) {
		var dim = Event.element(e);
		if (!dim || !this.curr_file) return; //might not have curr_file if keypress was esc

		var which = dim.id.replace('win-fields-',''), val = dim.value;
		var parsedVal = parseInt(val, 10);

		if (isNaN(parsedVal) || val != parsedVal) {
		    if (isNaN(parsedVal)) parsedVal = $('win-dimensions-' + which).innerHTML;
		    dim.value = parsedVal;
		    alert("Size entered not valid!");
		}
	    else this.renderPreview(FM_Util.transformDims(this.curr_file.dims, which.charAt(0), parsedVal));
    },

    initCustomPreview:function() {
        //set tbxs to curr size
        $('win-fields-width').value = $('win-dimensions-width').innerHTML;
        $('win-fields-height').value = $('win-dimensions-height').innerHTML;

        $($('win-dimensions-width').parentNode).hide();
        $($('win-fields-width').parentNode).show();
		Event.observe('win-fields-width', "keyup", this.updateCustomPreview);
		Event.observe('win-fields-height', "keyup", this.updateCustomPreview);
    },

    clearCustomPreview:function() {
		Event.stopObserving('win-fields-width', "keyup", this.updateCustomPreview);
		Event.stopObserving('win-fields-height', "keyup", this.updateCustomPreview);
        $($('win-fields-width').parentNode).hide();
        $($('win-dimensions-width').parentNode).show();
        $('win-fields-width').value = '';
        $('win-fields-height').value = '';
    },

    initPreview:function() {
        if (!this.curr_file) return;

        var show_custom = false;
        this.clearCustomPreview();
        //check for size in handler path; only selected files from editor will have 'path' attrib
        var sizes = $('win-fields-size');
        var dims = FM_Util.parseHandlerSize(this.curr_file.opts.attr.path);
        if (dims) { //found handler size... 
            var size_opts = sizes.getElementsBySelector('option[value='+dims.width+']');
            if (size_opts && size_opts.length > 0) { //found a size opt matching size...
                size_opts[0].selected = true;
                //$$('#win-fields-align option[value=right]')[0].selected = true; //select first item so custom not selected
                dims = null; //don't want to pass custom dims; will use selected option
            }
            else show_custom = true;
        }
        else { //only reset size if no dims found
            //sizes.selectedIndex = 0; //select first item so custom not selected
            if ($F(sizes) == "") { //if custom already selected, pass in dims
                dims = this.curr_file.dims;
                show_custom = true;
            }
            else this.setPreviewSize(sizes);
        }

        if (show_custom) { //didn't find matching size option; will be custom
            $('win-dimensions-width').innerHTML = dims.width;
            $('win-dimensions-height').innerHTML = dims.height;
            //sizes.selectedIndex = sizes.options.length-1; //select last item (custom)
            this.setPreviewSize(sizes, "custom");
            this.initCustomPreview();
        }

        $('win-preview-img').setStyle({'float':$F('win-fields-align')}); //set float
        this.renderPreview(dims);
	},
	
	setPreviewSize:function(size_sel, curr_size) {
        var sel_idx = 0;
        if (!curr_size) { //if not passed, find default from inst
    	    //var inst = this.instances[this.curr_inst];
    	    curr_size = (this.curr_opts)? this.curr_opts.default_size:"";
        }
        $A(size_sel.options).each(function(o, i) { //look for any matches on the curr_size
            if(curr_size == o.text.toLowerCase()) sel_idx = i;
        });
        size_sel.selectedIndex = sel_idx;
	},

    renderPreview:function(custom_dims) {
        if (!this.curr_file) return;
        var dims = custom_dims;

        if (!dims) { //no custom size passed, use current field settings
            this.clearCustomPreview();
            dims = FM_Util.transformDims(this.curr_file.dims, 'w', parseInt($F('win-fields-size'), 10));
        }

        var alert = $('win-preview-alert');
        if (this.curr_file.dims.width < dims.width || this.curr_file.dims.height < dims.height) {
            dims = this.curr_file.dims;
            alert.innerHTML = "Full size (width " + dims.width + ", height " + dims.height + ")";
            alert.show();
        }
        else alert.hide();

        //show curr size (if hidden, still use this to store curr size)
        $('win-dimensions-width').innerHTML = dims.width;
        $('win-dimensions-height').innerHTML = dims.height;
        if (custom_dims) { //set custom fields
            $('win-fields-width').value = dims.width;
            $('win-fields-height').value = dims.height;
        }
        
        var reduce = 0.3; //preview is ~1/3 size
        var size = {width:Math.round(dims.width * reduce)+'px', height:Math.round(dims.height * reduce)+'px'};
        var img = $('win-preview-img');
        img.src = this.curr_image.curr_url; //use url of curr detail; should be cached
        img.setStyle(size);
    },
    
    checkBounds:function(f) {
        if (!this.curr_opts) return;
        
        if (!this.curr_opts.bounds || !this.curr_opts.bounds.apply) return false; //no bounds
        if (f.checked_bounds) return !f.size_in_range; //already checked this img; if not in range, then file is restricted

        //if orig is larger than max w; transform
        if (this.curr_opts.bounds.max_width > 0 && f.max_size.width > this.curr_opts.bounds.max_width)
            f.max_size = FM_Util.transformDims(f.dims, 'w', this.curr_opts.bounds.max_width);
        //if final is larger than max h; transform
        if (this.curr_opts.bounds.max_height > 0 && f.max_size.height > this.curr_opts.bounds.max_height)
            f.max_size = FM_Util.transformDims(f.dims, 'h', this.curr_opts.bounds.max_height);

        //check if max size is within min w/h
        if (this.curr_opts.bounds.width > 0 && f.max_size.width < this.curr_opts.bounds.width)
            f.size_in_range = false;        
        if (this.curr_opts.bounds.height > 0 && f.max_size.height < this.curr_opts.bounds.height)
            f.size_in_range = false;
        
        f.checked_bounds = true; //keep track of files already checked
        return !f.size_in_range; //if not in range, then file is restricted
    },
    
    checkAlerts:function(alerts) {
        this.allow_select = true; //reset
        var err = "";
        var size = this.curr_file.max_size;
        for (var i=0; i<alerts.length; i++) { //extend each alert from default alert
            if (!alerts[i].isValid(size)) {
                err += (err!=''?' ':'') + alerts[i].opts.text;
                if (this.allow_select) this.allow_select = !alerts[i].opts.enforce;
            }
        }
        var alert_div = $('win-fields-alerts');
        if (!alert_div) return;
        this.debug('in checkAlerts, displaying msg: "'+err+'"')
        if (err != "") { //display alert
            alert_div.firstChild.firstChild.innerHTML = err; //first child in alerts div should be p, which has span...
    		this.highlightMsg(alert_div);
        }
        else alert_div.hide();
    },
    
    getAlertSize:function(alerts) {
        var size = {width:0, height:0};
        alerts.each(function(a) {
            if (size.width > 0 && size.height > 0) throw $break;;
            //if (size.width == 0) size.width = a.opts.max_width;
            if (size.width == 0) size.width = a.opts.min_width;
            //if (size.height == 0) size.height = a.opts.max_height;
            if (size.height == 0) size.height = a.opts.min_height;
        });
        return size;
    },

    /* -- fileSelected -- */
	fileSelected:function(f, for_crop) {
		//this.debug('in fileSelected...')
        if (!this.visible) return; //fileSelected might be called before manager open...

        if (!this.curr_opts) return this.kill("[FileManager.fileSelected] Manager instance ["+this.curr_inst+"] not found!");
		if(!f) return this.kill("[FileManager.fileSelected] Bad file selected!");
		//reload file details if we don't have everything
		if(!f.fully_loaded) { FM_Data.load("file=" + f.path + this.curr_mgr, this.curr_fld); return; }

		var cropped_url = this.final_crop_url; //store now in different var, this.final_crop_url will be cleared by clearDetail
		var set_fields = false, right = false, left = false, cap = "", cred = "", alt = "";
        if (cropped_url && this.curr_opts.context == "editor") { //get fields from prev file (orig of new crop)
            set_fields = true;
            cap = $('win-fields-caption').value;
            cred = $('win-fields-credit').value;
            alt = $('win-fields-alt').value;
            right = ($('win-fields-align').selectedIndex == 0);
            left = ($('win-fields-align').selectedIndex == 1);
        }

		//this.clearDetail(true); //will reset file panel to 'detail' (not anymore...)
        this.clearSelection();

		this.curr_file = f;
		this.fillInfo();
		this.displayPanel("detail"); //make sure detail panel shown

		//if (!no_detail) this.showDetail();
		if (for_crop) this.switchFilePanel('crop', true);
		else this.showDetail();

		this.getReferences(); //call after showDetail, to make sure delete is toggled correctly
        $$('#win-preview-img').invoke('hide'); //hide prev preview (keep as $$ call to return array; might not exist)

        var img_opts = {element:$$('div.win-aligner')[0]};
	    if(this.curr_file.isImage()) { //create img (will load automatically)
	        img_opts.path = this.curr_file.path;
	        img_opts.cache = this.curr_file.opts.cache;
	        //cropUndo not working in IE...
	        if (cropped_url) img_opts.onLoad = function(){FileManager.displayMsg("Image successfully cropped.", !Prototype.Browser.IE)};
	        this.curr_image = new FM_Image(img_opts);

	        this.curr_file.opts.cache = true; //cache now that it's loaded once
	        if (!set_fields && this.curr_opts.context == "editor") {
                set_fields = true;
                cap = this.curr_file.getAttr('caption');
                cred = this.curr_file.getAttr('credit');
                alt = this.curr_file.getAttr('alt');
                right = (this.curr_file.getAttr('align') == 'right');
                left = (this.curr_file.getAttr('align') == 'left');
                if (this.curr_file.getAttr('align') != 'none' && !right && !left)
					right = true; //default to right align if nothing detected
	        }
	        else if (this.curr_opts.context == "element" && this.curr_opts.alerts) this.checkAlerts(this.curr_opts.alerts);
        }
        else { //document icon
            img_opts.path = this.base_url+'../../themes/advanced/img/file-'+this.curr_file.ext+'.gif';
            img_opts.icon = true;
	        this.curr_image = new FM_Image(img_opts);
	        //img_cont.appendChild(this.curr_file.getThumb());
	    }

        if (set_fields) {
            $('win-fields-caption').value = cap;
            $('win-fields-credit').value = cred;
            $('win-fields-alt').value = alt;
            $('win-fields-align').selectedIndex = (right? 0 : (left? 1 : 2));
            this.initPreview(); //reset rendering
        }
	},

	getCurrList:function(type) {
	    if (!type) type = this.curr_opts.type;
        return (type=='image')? $$('ul.win-thumbs')[0] : $$('#win-content-doc-list tbody')[0];
	},

	displayList:function(force, p, bg) { //p is page #, bg is flag to load the list in the background
	    //this.debug('in displayList (' + force + ', ' + p + ', ' + bg + ')...')
        if (!this.visible) return;

        var files = this.prev_file_list;
		if(force || !files) files = FM_Data.getFiles(this.curr_fld);
		if(!files) { //if didn't prefetch, need to load files //KSTD should check against cache instead
			if(bg) return;
            this.debug('returning from displayList b/c files not yet loaded...')
            this.displayPanel(); //display list panel before loading
            var inst = this.instances[this.curr_inst];
		    if (inst) inst.load(true);
		    return;
		}
		if(!bg && this.curr_file && files) { //show detail for current file
		    this.debug('displayList will display file instead of list')
		    this.fileSelected(this.curr_file);
		    return;
		}
		this.drawList(files, force, p, bg);
    },

	drawList:function(files, force, p, bg) {
	    //this.debug('in drawList (files[' + files.length + '], ' + force + ', ' + p + ', ' + bg + ')')
        this.hideMsg();

        this.prev_file_list = files; //store prev
        var parent = this.getCurrList();
        var f, n, page = (p || this.curr_page || 1); //if curr pg not specified, default to 1st pg
        if(!force && parent.file_count > 0 && parent.file_count == files.length && this.curr_page == page) {
		    //this.debug('drawList not doing anything! calling filesLoaded? !' + bg)
		    if (!bg) this._filesLoaded(); // skipping list creation; just show existing files
            return;
        }
        this.clearList(bg);

        var s = (this.curr_sort || '');
        //sort the files...
		files.sort(function(a, b) {
			var rev = 1;
			if(s.indexOf("desc") > -1) rev *= -1; //reverse sort
			if(s.indexOf("date") == 0) rev *= -1; //reverse date for most recent
			var key = (s.indexOf("n") == 0)? 'n':'m'; //name(n) or millisecond(m) sort key
    	    var v1 = a.getAttr(key), v2 = b.getAttr(key);
	        if(v1 == v2) { //if equal, use secondary sort key
			    var skey = (s.indexOf("n") == 0)? 'm':'n';
    	        var s1 = a.getAttr(skey), s2 = b.getAttr(skey);
	            if (s1 == s2) return 0;
                if (s1 > s2) return rev*1;
                return rev*-1;
	        }
            if(v1 > v2) return rev*1;
            return rev*-1;
		});

        var type = this.curr_opts.type;
        var fCnt = 0, pCnt = Math.ceil(files.length/this.curr_opts.page_size);
        var end = (page * this.curr_opts.page_size) - 1;
        var start = end - this.curr_opts.page_size + 1;
        //this.debug('generating new file list... start/end: ' + start + '/' + end + ', files.len: ' + files.length + ', search_txt: ' + this.search_txt);
        end = Math.min(end, files.length-1);
        var loaded = false, is_restricted = false;
        var upload_cnt = 0;
        this.greyed = false;
        var search_re = null;
        if (this.search_txt && this.search_txt != "")
            search_re = new RegExp("(" + FM_Util.prepStringForRE(this.search_txt) + ")", "i");

        for (var i=0; i<files.length; i++) {
            if(i < start || i > end) continue; //skip files not on curr page

            is_restricted = false; //reset flag
            n = Builder.node("a", {"href":"#"});
            if(type == "image") {
                //check if file is restricted
                is_restricted = this.checkBounds(files[i]);

                // ul based list of imgs...
                f = parent.appendChild(Builder.node("li", {"title":files[i].getAttr('n')}, [
	                Builder.node("a", {"href":"#", "class":"win-thumb-image"}, [Builder.node("span"), files[i].getThumb()]), ' ', n
                ]));
            }
            else { //documents (table based)
                f = parent.appendChild(Builder.node("tr", {"title":files[i].getAttr('n')}, [
	                Builder.node("td", [files[i].getThumb(), ' ', n]),
	                Builder.node("td", [files[i].getAttr('s')]),
	                Builder.node("td", [files[i].getAttr('d')])
                ]));
                if (fCnt % 2 == 0) f.className = "alt";
            }
            n.innerHTML = files[i].getTrimmedName(search_re);

            //simple handler for clicks on restricted files
            if (is_restricted) {
                Event.observe(f, "click", function(e) { return FileManager.kill("This "+type+" is too small to be selected.", e); });
                this.greyed = true;
                f.setStyle({background:'none'}); //so :hover highlight isn't visible
                new Effect.Opacity(f, { duration:0.1, to:0.3 });
            }
            else Event.observe(f, "click", files[i].onClick);

            if(files[i].opts.uploaded || files[i].opts.cropped) {
                if (files[i].opts.uploaded) upload_cnt++;
                files[i].opts.uploaded = files[i].opts.cropped = false; //reset so highlight doesn't show next time
                f.addClassName("new-highlighted");
            }
            fCnt++;
        }
        parent.file_count = files.length;
        parent.page_count = pCnt;
        parent.show();

        this.curr_page = page;
        this.setPaging(pCnt); //always re-write pages to highlight curr page

        if (!bg && upload_cnt > 0) {
            if (!this.curr_msg || this.curr_msg == "") {
                var type_name = this.curr_opts.type.capitalize();
                if (upload_cnt > 1) type_name += 's'; //plural
		        this.curr_msg = type_name + " successfully uploaded.";
		    }
        }
        this._filesLoaded(bg);
	},
	
	_filesLoaded:function(bg) {
        FM_Util.loading(false); //, 'files'
        if (!bg) this.resetTools();

        if (this.greyed) this.curr_msg = this.curr_opts.bounds.msg;
        if (!bg && this.curr_msg && this.curr_msg != "") this.displayMsg(this.curr_msg);

        if (this.curr_panel != 'detail' || !this.curr_file) this.displayPanel(); //don't have to wait for thumbs to load

        if (bg) return;

        $$((this.curr_opts.type == "image"?"li":"tr") + ".new-highlighted").each(function(h) {
            h.removeClassName("new-highlighted");
            new Effect.Highlight(h, { duration:3, afterFinish:FileManager.hlFinished });
        });
	},
	
	hlFinished:function(e) { //remove the inline style on highlighted files; to show :hover
	    e.element.removeAttribute('style');
	},
	
	clearList:function(bg) {
        var parent = this.getCurrList();
        while (parent.firstChild) parent.removeChild(parent.firstChild);
        parent.file_count = parent.page_count = this.curr_page = 0;
        this.curr_msg = null;
        this.setPaging(0);

        if (!bg && Prototype.Browser.IE) $$('div.win-work-area').invoke('setStyle',{visibility:'hidden'}); //fix strange ie bug
	},
	
	setPaging:function(s) {
	    var top = $('win-pages-top'), bottom = $('win-pages-bottom');
	    top.innerHTML = bottom.innerHTML = '';
        if (s > 1) {
            top.innerHTML = "Page: ";
            bottom.innerHTML = "Page: ";

			var tooMany = (s > 20);
			var padding = 7;
			var overflow = false;
            for (var j=1; j<=s; j++) {
                if (j == this.curr_page) {
                    top.appendChild(Builder.node("strong", [j]));
                    bottom.appendChild(Builder.node("strong", [j]));
                    overflow = false; //reset
                }
                else if (tooMany && Math.abs(j - this.curr_page) > padding) {
					if (!overflow) {
						top.appendChild(Builder.node("strong", {'class':'paging-overflow'}));
						bottom.appendChild(Builder.node("strong", {'class':'paging-overflow'}));
                    }
                    overflow = true;
                }
                else {
					top.appendChild(Builder.node("a", {"href":"#"}, [j]));
					Event.observe(top.lastChild, "click", this.pageClick);
					bottom.appendChild(Builder.node("a", {"href":"#"}, [j]));
					Event.observe(bottom.lastChild, "click", this.pageClick);
	            }
            }

			//add hellip using innerHTML (b/c of ie bug) if tooMany
			if (tooMany)
				$$('strong.paging-overflow').each(function(a){ a.innerHTML = '&hellip;'; });
        }
	},
	
	_pageClick:function(e) {
		var link = Event.element(e);
		if (link) this.displayList(true, parseInt(link.innerHTML));
		//KSTD need to scroll to top of list...
		Event.stop(e);
	},

	_search:function(e) {
		var input = Event.element(e);
		if (!input) {
		    this.resetSearch();
		    return;
		}
		if (this.search_txt == input.value) return; //search hasn't changed
		if (e.keyCode == Event.KEY_ESC) { //ignore if esc key pressed...
		    input.value = ""; //reset search bx
		    return;
		}

		this.search_txt = input.value;
        this.resetFilter();
		this.drawList(FM_Data.search(this.curr_fld, this.search_txt), true);
	},
	
	resetSearch:function() {
		$("win-search-txt").value = this.search_txt = ""; //clear search box
	},

	_filter:function(e) {
        //var inst = this.instances[this.curr_inst];
        //if (!inst) return;
		this.resetSearch();
		var ddl = Event.element(e);
		this.drawList(FM_Data.filter(this.curr_fld, ddl? ddl.value:""));
	},
	
	resetFilter:function() {
        var filter = $('win-file-filter');
        filter.selectedIndex = filter.options.length-1; //make sure 'all' is selected
	},

	_sort:function(e) {
		var link = Event.element(e);
		if(link) {
		    var sort = link.readAttribute('sort'); //used to be 'id'
		    this.setSort(sort);
		    //var rev = (this.curr_sort == sort)?"desc":""; //if curr_sort already same, reverse sort
    		this.curr_sort = sort; // + rev;
	    	//this.displayList(true); //can't call displayList w/ force, will clear prev_file_list
	    	this.drawList(this.prev_file_list, true);
	    }
	    Event.stop(e);
	},
	
	setSort:function(s) {
	    var c = (s.include('name')? 'name':'date');
	    var o = (s.include('name')? 'date':'name');
	    $('win-file-sort-' + c).show();
	    $('win-file-sort-' + o).hide();
	},

	clearCrop:function() {
		if(this.cropper) this.cropper.remove();
		this.cropper = this.curr_crop = this.final_crop_url = null;
	},

	_onCropChanged:function(coords, dims) { //bound to this.onEndCrop; NOTE: when bound, 'dims' param doesn't have dims but is same as coords ...?
		// ... so, manually calc w/h as difference between (x1, y1) and (x2, y2) coords
		if (coords)
		    this.curr_crop = {coords:coords, dims:{width:coords.x2-coords.x1, height:coords.y2-coords.y1}};
		
        var pct = 1;
        if (this.curr_image) pct = this.curr_image.reductionPct(this.curr_file.dims);
        
        var alert_txt = "";
        var actual_w = Math.round(this.curr_crop.dims.width / pct);
        var actual_h = Math.round(this.curr_crop.dims.height / pct);
        if (isNaN(actual_w)) actual_w = 0;
        if (isNaN(actual_h)) actual_h = 0;

        if (this.curr_opts.crop) { //put notice re: max final size of crop
	        var max_crop_size = {width:this.curr_opts.crop.maxFinalWidth, height:this.curr_opts.crop.maxFinalHeight};
            if (max_crop_size.width && max_crop_size.height && (max_crop_size.width < actual_w || max_crop_size.height < actual_h)) {
				//check which dim to transform by
				var transformByWidth = ((actual_w - max_crop_size.width) > (actual_h - max_crop_size.height));
				var transformMaxDim = transformByWidth? max_crop_size.width : max_crop_size.height;

				var final_crop_size = FM_Util.transformDims({width:actual_w, height:actual_h}, transformByWidth? 'w':'h', transformMaxDim);
		        actual_w = final_crop_size.width;
		        actual_h = final_crop_size.height;
				alert_txt = "The cropped image will be resized to<br />";
			}
        }

		var status = $('win-crop-size-status');
		status.innerHTML = alert_txt + "Width: <strong>" + actual_w + "</strong> &times; Height: <strong>" + actual_h + "</strong>";
		status.setStyle({color: (alert_txt == "")? "#000000" : "#ee0000"});
	},

	_cropBegin:function(e, initialCoords) {
		if (e && !FM_Util.validBtn(e)) return; //can't crop if btn disabled
		if (!this.curr_file) return; //invalid btn or file
		if (this.cropper) return; //don't create crop again if already created

        //var inst = this.instances[this.curr_inst];
        if (!this.curr_opts) return;
        this.switchFilePanel('crop', true);

		if(this.curr_image) { // cropper will wait for img to load  && this.curr_image.loaded) { //apply crop to detail img
		    $('win-file-crop-btn').disabled = false;
		    //enforce bounds
		    var crop_opts = this.curr_opts.crop;
	        if (this.curr_opts.bounds && this.curr_opts.bounds.apply) {
		        var pct = this.curr_image.reductionPct(this.curr_file.dims);
		        var min_size = {width:this.curr_opts.bounds.width, height:this.curr_opts.bounds.height};
	            if (this.curr_opts.alerts && (min_size.width == 0 || min_size.height == 0)) {
	                var alert_size = this.getAlertSize(this.curr_opts.alerts);
       	            if (min_size.width == 0) min_size.width = alert_size.width;
       	            if (min_size.height == 0) min_size.height = alert_size.height;
	            }
	            crop_opts.minWidth = Math.round(min_size.width * pct);
	            crop_opts.minHeight = Math.round(min_size.height * pct);
	        }
		    //if coords passed, use those
		    if (initialCoords) crop_opts.onloadCoords = initialCoords;
		    else { //calc coords
			    var pad = crop_opts.border;
	            var w = this.curr_image.width(), h = this.curr_image.height();
			    crop_opts.onloadCoords = {x1:pad, y1:pad, x2:w-pad, y2:h-pad};
			}
            crop_opts.onEndCrop = this.onEndCrop;
            crop_opts.displayOnInit = true; //always show crop window on init
			this.cropper = new Cropper.Img(this.curr_image.image, crop_opts); //create crop object w/ crop options 
		}
		//else this.debug('cropBegin not creating crop; img not loaded')
		if (e) Event.stop(e);
	},

	_cropFinish:function(e) {
		var btn = Event.element(e);
		if(!btn || !this.curr_file) return; //invalid btn or file

		if(this.curr_crop.coords && this.curr_crop.dims && this.curr_crop.dims.width > 0 && this.curr_crop.dims.height > 0) {
		    if(this.curr_image.setting != "") this.curr_image.setting += ";";
		    this.curr_image.setting += "crop$"+this.curr_crop.coords.x1+","+this.curr_crop.coords.y1+","+this.curr_crop.dims.width+","+this.curr_crop.dims.height;
	        if (this.curr_opts.bounds && this.curr_opts.bounds.apply) { //apply bounds to restrict final size of crop
    	        var min_size = {width:this.curr_opts.bounds.width, height:this.curr_opts.bounds.height};
                //if (min_size.width > 0 || min_size.height > 0) this.curr_image.setting += ";max$" + min_size.width + "," + min_size.height;
            }

	        if (this.curr_opts.crop) { //try to apply max to final size of crop
    	        var max_crop_size = {width:this.curr_opts.crop.maxFinalWidth, height:this.curr_opts.crop.maxFinalHeight};
                if (max_crop_size.width && max_crop_size.width > 0 && max_crop_size.height && max_crop_size.height > 0)
					this.curr_image.setting += ";max$" + max_crop_size.width + "," + max_crop_size.height;
            }

		    //store file path, crop dims so can undo crop
		    this.prev_crop_coords = $H(this.curr_crop.coords); //clone the hash... ie bug?
		    this.prev_file = this.curr_file;
		    //create handler url based on crop setting
		    this.final_crop_url = FM_Util.buildHandlerPath(this.curr_file.path, this.curr_image.setting);

            btn.disabled = true;
			//save the cropped file (with 'crop' prefix)
			var del_url = this.base_url + "jsonFileData.aspx?action=save-copy&prefix=crop&file=" + this.final_crop_url + this.curr_mgr;
			FM_Util.loadXml(del_url, null, this.actionCompleted, 'save-copy');
		}
		else alert("Crop selection was not valid. Please try again.");
	},
	
	cropUndo:function() {
	    if (!this.prev_file) return;
	    this._deleteFile(); //calling w/out event will skip confirm, pass additional param
	    this.fileSelected(this.prev_file, true); //pass for_crop flag, to display crop filepanel right away
	    this._cropBegin(null, this.prev_crop_coords);
	},

	_actionCompleted:function(transport) { //action request returned a result...
		var raw = transport.responseText;
	    if (!raw.isJSON()) {
	        alert('Data retreived is not in valid JSON format!');
	        return;
	    }
	    var data = raw.evalJSON(true); //sanitize just in case (probably not needed)

		if(data.fm.s == "true") {
		    this.prev_file_list = null; //clear prev files
            FM_Util.loading(false, data.fm.a);
			if(data.fm.a == "save-copy") { //saved copy of file ('result' contains new path)
				//pass ajax result to FM_Data for parsing
    			FM_Data.parse(data.f, data.fm.p, data.fm.m, data.fm.a);
			}
			else if(data.fm.a == "delete") { //deleted file
				FM_Data.remove(data.fm.p, data.fm.r); //remove the file from the list....
				if (!data.fm.b) { // if b (background), then don't display list  // mode=none when undoing crop
                    this.clearSelection();
    				//this.clearDetail(); //remove detail
	    			this.displayList(true); //refresh list
	            }
			}
		}
		else this.debug("action '" + data.fm.a + "' failed: " + data.fm.e);
	},

    setPreviewImg:function(url) {
        var img = $(this.curr_opts.preview_img);
        if (!img) return;
        if (!url || url == "") url = this.curr_opts.preview_img_default;
        if (url && url != "") {
            img.show();
            img.src = url;
        }
        else img.hide();
    },
    
    fileNotFound:function(inst) {
        alert("File not found.");
        if (inst) this.setInst(inst);
        this._removeSelection(null, true); //remove any selection, but keep win open
        this.force_load = true; //try forcing list display
    },

	_removeSelection:function(e, leave_open) {
        //var inst = this.instances[this.curr_inst];
        if (!this.curr_opts) return;
	    if (!leave_open) this.close(); //close first, then clear selection

        if (this.curr_opts.context == "element") {
            var input = $(this.curr_opts.element);
            if (input) input.value = ""; //clear value
            this.setPreviewImg();
    	    //if (this.curr_opts.preview_img) $(this.curr_opts.preview_img).hide();
    	}
    	else if (this.curr_opts.context == "editor") {
            var img_cont = $(this.sel_file.img_container);
		    if (img_cont && img_cont.parentNode) img_cont.parentNode.removeChild(img_cont);

            if (this.curr_opts.editorId && this.sel_file.link_node) {
                tinyMCE.execInstanceCommand(this.curr_opts.editorId, 'unlink', false);
            }
    	}
        this.clearSelection();
        this.sel_file = null;
		if (e) Event.stop(e);
	},


    //function to select a file and close manager
	_selectFile:function(e) { //don't need event...
        //var inst = this.instances[this.curr_inst];
        if (!this.curr_opts) return;
		if(!this.curr_file) {
		    alert("No file selected!");
	        return;
		}
	    if (!this.allow_select) {
	        alert("This image must be cropped to the correct size before it can be selected.");
	        return;
	    }

		var result = "", title = ""; //will there ever be a title??
		switch(this.curr_opts.response.value) { //get correct value to return
			case "path":
				result = this.curr_file.path;
				break;
			case "name":
				result = this.curr_file.name;
				break;
		}
		
		//check curr ext against allowed exts (delimited w/ | or ; )
	    var valid_type = (this.curr_opts.response.ext.search(new RegExp("(^|;|\|)" + this.curr_file.ext + "(\||;|$)", "i")) > -1);
		var valid_size = !this.curr_opts.bounds.apply;

		if(valid_type && !valid_size) { //check size against allowed sizes
		    valid_size = this.curr_file.dimInRange('width', this.curr_opts.bounds.width, 0);
		    if (valid_size) valid_size = this.curr_file.dimInRange('height', this.curr_opts.bounds.height, 0);
		    
		    //TODO: not checking max b/c assuming it's ok to return handler url to reduce size; 
		}

        var type = this.curr_opts.type.capitalize();
		if(!valid_type) alert(type + " type '"+this.curr_file.ext+"' is not allowed!");
		else if(!valid_size) alert(type + " size chosen is not allowed!");
		else if(result == "") alert(type + " value to be returned not specified!");
		else { //file is valid...
		    var final_size = null;
			if(this.curr_opts.context == "editor" && this.curr_opts.type == "image") { //$('win-fields-size')
			    if ($F('win-fields-width') != '') //custom dims; should already be proportional to orig dims
			        final_size = { width:$F('win-fields-width'), height:$F('win-fields-height')};
			    else
    		        final_size = FM_Util.transformDims(this.curr_file.dims, 'w', parseInt($F('win-fields-size'), 10));
			}

		    if (this.curr_opts.context != "editor" && this.curr_opts.bounds.apply && this.curr_opts.bounds.max_width < this.curr_file.dims.width) {
		        final_size = FM_Util.transformDims(this.curr_file.dims, 'w', this.curr_opts.bounds.max_width);
		    }

	        if (final_size != null && (this.curr_file.dims.width > final_size.width || this.curr_file.dims.height > final_size.height)) //need to restrict final size...
	            result = FM_Util.buildHandlerPath(result, "size$" + final_size.width + "," + final_size.height);

			if(this.curr_opts.context == "element" && this.curr_opts.element) { //set text box value
			    this.curr_opts.element.value = result;
			    if (this.curr_opts.preview_img) {
			        var url = this.curr_file.path; //always use path for preview
			        if (this.curr_opts.preview_setting != "") { //check handler setting format...
            			var re = new RegExp("^" + FM_Util.handler_pattern + "$", "i");
            			if (re.exec(this.curr_opts.preview_setting))
                            url = FM_Util.buildHandlerPath(result, this.curr_opts.preview_setting);
                        else this.debug('not using handler for img; patt: ' + this.curr_opts.preview_setting)
                    }
                    this.setPreviewImg(url);
			    }
			}
			else if(this.curr_opts.context == "editor") { // if manager used for tinymce, need to callback with data...
			    var cmd = (this.curr_opts.type == "image")? 'mceInsertImage':'mceInsertDocument';
			    var params = { path:result, title:title };

			    if (this.curr_opts.type == "image") {
			        params['caption'] = $('win-fields-caption').value;
			        params['credit'] = $('win-fields-credit').value;
			        params['alt'] = $('win-fields-alt').value;
			        params['align'] = $('win-fields-align').value;
			    }
			    else { //docs
			        params['target'] = this.curr_opts.markup.target;
			    }
			    this.execTinyMCECmd(this.curr_opts.editorId, cmd, params);
			}
			this.close();
			this.curr_opts.onFileSelected(result); //user can pass callback func
		}
	},
	
	execTinyMCECmd:function(id, cmd, params) {
	    if (typeof(tinyMCE) == 'undefined') return this.kill("FileManager error: TinyMCE code not detected. Selection will not be inserted.");

        //simulating functionality of tinyMCEPopup.restoreSelection();
	    var ed_inst = tinyMCE.activeEditor; //selectedInstance;
	    if (ed_inst) {
	        ed_inst.getWin().focus();
	        if (ed_inst.selectionBookmark) ed_inst.selection.moveToBookmark(ed_inst.selectionBookmark);
	    }
        //tinyMCE.execInstanceCommand(id, cmd, false, params);
        tinyMCE.activeEditor.execCommand(cmd, false, params);
	},

	bindFunctions:function() { //bind listeners for later use
		this.close = this._close.bindAsEventListener(this);
		this.pageClick = this._pageClick.bindAsEventListener(this);
		this.search = this._search.bindAsEventListener(this);
		this.filter = this._filter.bindAsEventListener(this);
		this.sort = this._sort.bindAsEventListener(this);
		this.switchTypeClick = this._switchTypeClick.bindAsEventListener(this);
		this.captureKeys = this._captureKeys.bindAsEventListener(this);
		this.filesLoaded = this._filesLoaded.bindAsEventListener(this);

		this.cancel = this._cancel.bindAsEventListener(this);
		this.cropBegin = this._cropBegin.bindAsEventListener(this);
		this.actionCompleted = this._actionCompleted.bindAsEventListener(this);
		this.referencesLoaded = this._referencesLoaded.bindAsEventListener(this);

		this.updatePreview = this._updatePreview.bindAsEventListener(this);
		this.updateCustomPreview = this._updateCustomPreview.bindAsEventListener(this);

	    //callback for crop; to capture changes to crop dims
	    this.onEndCrop = this._onCropChanged.bindAsEventListener(this);

		this.downloadFile = this._downloadFile.bindAsEventListener(this);
		this.deleteFile = this._deleteFile.bindAsEventListener(this);
		this.showUpload = this._showUpload.bindAsEventListener(this);
		this.drawWin = this._drawWin.bindAsEventListener(this);
		this.showFiles = this._showFiles.bindAsEventListener(this);
		this.showDetail = this._showDetail.bindAsEventListener(this);
		this.selectFile = this._selectFile.bindAsEventListener(this);
		this.removeSelection = this._removeSelection.bindAsEventListener(this);
		this.cropFinish = this._cropFinish.bindAsEventListener(this);
		
		this.onClosed = this._onClosed.bindAsEventListener(this);
	},

	//temporary debugging... only in FF console
	debug:function(txt, force_alert) {
		if(typeof console != "undefined") console.log("debug: %d", txt);
		else if (force_alert) alert("debug: " + txt);
	}
}





var FM_Data = {
    folders:{}, //hash of all file data; key is folder, value is array of files
    pending:{}, //hash of flags; key is folder, bool indicates if xml request is pending
    notify:{},  //hash of flags; key is folder, bool indicates if FileManager needs to be notified of data load (to show file detail)
    
    cleanPath:function(fld) {
        var p = fld.toLowerCase();
        if (p.startsWith('~')) p = p.substr(1); //remove tilde(~)
		if (p.include("%")) p = unescape(p);
        return p;
    },
    
    getFiles:function(fld) {
        var p = this.cleanPath(fld);
        //KSTD need auto-loader??
        return this.folders[p];
    },

    filesLoaded:function(fld) {
        var p = this.cleanPath(fld);
        return (this.folders[p] && this.folders[p].length > 0);
        //FileManager.debug('checking if filesLoaded: ' + l)
    },

	findFileFromPath:function(fld, val) { //tries to parse string (could be name, path or handler format) to find valid file
	    if (!val || val == "") return null;
	    
	    val = FM_Util.getPathFromHandlerUrl(fld, val);
		//if(val.indexOf("/") > -1 && val.lastIndexOf(FileManager.handler_ext) == val.length-FileManager.handler_ext.length) //looks like handler format...
		//    val = val.substring(val.lastIndexOf("/", val.lastIndexOf("/")-1)+1, val.lastIndexOf("/")); //parse orig file name from handler path

		//if(val.indexOf("/") == -1) val = fld + val; //add folder in front of file name
		val = this.cleanPath(val);
		return this.find(fld, val);
	},

	index:function(fld, path) { //returns array index of file
		var idx = -1, p = this.cleanPath(path);
		var _f = this.getFiles(fld);
		$A(_f).each(function(f, i) {
			if(f.path == p) { idx = i; throw $break; } //special break exception to exit each loop
		});
		return idx;
	},

	find:function(fld, path) {
		var curr_idx = this.index(fld, path);
		if (curr_idx == -1) return null;
		return this.getFiles(fld)[curr_idx];
	},

	append:function(fld, opts, idx, return_file) { //create FM_File and append or replace
	    //opts.prefetch = this.opts.prefetch; //files inherit prefetch setting from manager (for thumb) KSTD
		var f = new FM_File(opts); //create file obj
		if(idx && idx >=0 && idx < this.folders[fld].length) this.folders[fld][idx] = f; //have index of file to replace
		else this.folders[fld].push(f);
		if(return_file) return f;
	},

	remove:function(fld, path) {
		var del_idx = this.index(fld, path);
		if(del_idx > -1) {
    		var _f = this.getFiles(fld); //KSTD don't need variable?
		    _f.splice(del_idx, 1);
		}
	},

	load:function(param, fld) {
	    if(!fld) return;

        var p = this.cleanPath(fld);
        if (!param.include("action=")) { //always let action requests be loaded
            if (this.folders[p]) return; //to skip loading if another inst has cache
            if (this.pending[p]) return; //skip loading if already requested
            this.pending[p] = true; //set pending, only if not loading single file
        }

	    if (!this.jsonLoaded) //bind 1st time
    		this.jsonLoaded = this._jsonLoaded.bindAsEventListener(this);

   		FM_Util.loadXml(FileManager.base_url + "jsonFileData.aspx?" + param, null, this.jsonLoaded, 'files');
	},

	_jsonLoaded:function(transport, json) {
	    var isXML = false; // (typeof(transport.responseXML) != 'undefined' && transport.responseXML != null && transport.responseXML != "");
	    //alert("jsonLoaded; status: " + transport.status + ", isXML: " + isXML + ", json: " + json) //+ ", raw: " + raw)
		var raw = (isXML)? FM_Util.extractXmlVal(transport.responseXML, "string") : transport.responseText;
	    if (!raw.isJSON()) {
	        alert('Data retreived is not in valid JSON format!');
	        return;
	    }

	    var data = raw.evalJSON(true); //sanitize just in case (probably not needed)
		if (data.fm.e && data.fm.e != "") {
		    alert('Error occurred: ' + data.fm.e);
	    }
		else if(data.fm.p == "") { //nothing returned...
		    if (data.fm.a == "detail" && data.fm.s == "false") FileManager.fileNotFound(data.fm.i);
		}
		else if(!data.f || data.f.length == 0) {
		    FileManager._filesLoaded();
		    alert("No files found.");
		    return; //do we care if no files returned??
		}
		else { //parse files...
			this.parse(data.f, data.fm.p, data.fm.m, data.fm.a, data.fm.b);
		}
	},

	parse:function(files, fld, mode, action, bg) { //parses xml data to create file array
        var p = this.cleanPath(fld);
        if (action != "detail" && !this.folders[p]) this.folders[p] = [];

		var nodes, new_file = null;
		for (var i = 0; i < files.length; i++) {
			if(p != "" && files[i].n != "") {
				//options for new file (attr holds a number of attributes)
				var f = { path:p + files[i].n, attr:files[i], custom:files[i].custom };
                if (action == "add-new") f.uploaded = true;
                if (action == "save-copy") f.cropped = true;
                if (action == "save-copy" || action == "add-new") f.cache = false;

				if(mode == "single" && action == "detail") //if showing detail, don't even store file
					new_file = new FM_File(f);
				else if(mode == "single" && action == "save-copy") //if appending new cropped file, get back file to pass back
					new_file = this.append(p, f, -1, true);
				else if (mode == "single" && action != "add-new") //pass idx of prev img in array to overwrite w/ new one
					this.append(p, f, this.index(p, f.path));
				else //mode should be 'multi'
					this.append(p, f);
			}
		}

        //FileManager.debug("parsed files...")
		if (this.pending[p] || action != "") {
			if (action == '') this.pending[p] = false;
            if (new_file) {
                FileManager.fileSelected(new_file);
                //if this is first load and found selected file, load list in bg
                //if (action == '') 
                FileManager.displayList(null, null, true); // FileManager.drawList(this.folders[p], null, null, true);
            }
			else if (!bg || FileManager.force_load) FileManager.displayList(true); //if not bg loading...
            //else FileManager.debug("... not doing anything b/c bg: " + bg)
		}
		else FileManager._filesLoaded(bg);
	},
	
	parseFileAttrFromXML:function(xml) {
	    var files = [];
		for (var i = 0; i < xml.length; i++) {
		    var nodes = xml[i].childNodes;
		    var attr = { n:"" };
		    for (var j = 0; j < nodes.length; j++) {
		        //collect into attribute hash
			    if(FM_Util.elHasTextNode(nodes[j])) attr[nodes[j].nodeName] = nodes[j].firstChild.nodeValue;
		    }
		    files.push(attr);
		}
		return files;
	},

	search:function(fld, s) {
   		var _f = this.getFiles(fld);
		if(s == "") return _f; //all files

		var re = new RegExp(FM_Util.prepStringForRE(s), "i"); // s.toLowerCase();
		var matches = [];
		//start w/ name attr, check if starts w/ search...
		_f.pluck('name').invoke('match', re).each(function(m, i) {
			if(m) matches.push(_f[i]); //add to matches
		});
        return matches;
	},

	filter:function(fld, f) {
   		var _f = this.getFiles(fld);
		if (f == "") return _f; //all files

		var matches = [];
		var min = 0, max = 0;
		var widths = f.split('-'); //try to get max/min from filter value
		if(widths.length == 1) {
		    min = max = parseInt(widths[0], 10);
		    if (f.endsWith('+')) max = 0;
		}
		else if(widths.length == 2) {
			min = Math.min(parseInt(widths[0], 10), parseInt(widths[1], 10));
			max = Math.max(parseInt(widths[0], 10), parseInt(widths[1], 10));
		}
		if(min > 0) {
			var m = _f.invoke('dimInRange', 'width', min, max);
			for(var i=0; i<m.length; i++) { //check if matched width filter
				if(m[i]) matches.push(_f[i]);
			}
		}
        return matches;
	}
};




var FM_Util = {
    work_area_max:{width:436, height:430}, //maximum size for detail image using handler (user can't change)

    monthNames:["January","February","March","April","May","June","July","August","September","October","November","December"],
    typeNames:{
        //images
        image: {gif:'GIF', jpg:'JPG', tif:'Tagged image format (TIF)', png:'Portable network graphics (PNG)', bmp:'Bitmap (BMP)'}, 
        //documents
        document: {pdf:'Adobe PDF', txt:'Plain text (TXT)', xls:'Microsoft Excel (XLS, XLSX)', ppt:'Microsoft PowerPoint (PPT, PPTX, POT)', doc:'Microsoft Word (DOC, DOCX, DOT)', wmv:'Windows Media Video (WMV)', mp3:'MP3 audio'}
    },

	validBtn:function(e) { //btn is valid if doesn't have disabled class
		var btn = Event.findElement(e, 'A');
		return (btn && !btn.hasClassName("disabled"));
	},

    getBtns:function(ids) {
        var btns = [];
        $$('div.win ul[class~=tools] a').each(function(btn){
            if(!ids || ids.indexOf(btn.readAttribute('name')) > -1) btns.push(btn);
        });
        if (btns.length==1) return btns[0]; //single btn
        return btns;
    },

    setBreadcrumb:function(id, curr, show, txt, hide) {
        var a = $('win-crumbs-'+id);
        var bc = $(a.parentNode); //li in ul.win-crumbs
        if (hide) curr = show = false; //overriding flags to hide browse...
        if (curr) bc.addClassName('current');
        else bc.removeClassName('current');
        if (txt && txt != '') a.innerHTML = txt.capitalize();
        if (show && !bc.visible())
            Effect.Appear(bc, {duration:0.1}); //, queue:{scope:'nav', position:'front'}
        else if (!show) bc.hide();
    },

	createWinInDOM:function() { //create DOM elements
        //add global admin css
    	var now = new Date();
    	var stamp = "?u=" + now.valueOf(); //add unique date stamp

    	$$("head")[0].appendChild(Builder.node('link', 
    	    {'rel':'stylesheet', 'type':'text/css', 'media':'all', 'href':FileManager.base_url+'../../themes/advanced/skins/default/admin.css'+stamp}
    	));
        //add cropper js (temporary)
    	$$("head")[0].appendChild(Builder.node('script', 
    	    {'language':'javascript', 'type':'text/javascript', 'src':FileManager.base_url+'jscripts/cropper.js'}
    	));

		var body = $$("body")[0];
		body.appendChild(Builder.node("div", {"class":"win-bg", "style":"display:none;"})); //add bg
		//add win as last element in body
		var win = body.appendChild(Builder.node("div", {"class":"win", "style":"display:none;"}, [
		    Builder.node("h1", ["File Manager"]),
	        Builder.node("div", {"id":"win-loading", "class":"win-notice", "style":"display:none"}, [
                Builder.node("span", ["Loading ", Builder.node("img", {"src":FileManager.base_url+"../../themes/advanced/img/loading-small.gif"})])
            ])
		]));

		//creation of DOM elements broken into chunks...

        // --------- admin bar --------- 
	    win.appendChild(Builder.node("div", {"class":"admin"}, [
	        Builder.node("div", {"class":"ribbon"}, [
                Builder.node("div", {"class":"page"}, [
                    Builder.node("div", {"class":"content"}, [
                        Builder.node("ul", {"class":"content-main tools"}, [
                            Builder.node("li", [Builder.node("a", {"href":"#", "name":"download", "class":"disabled"}, [Builder.node("span", {"class":"icon-download"}), "Download"])]),
                            Builder.node("li", [Builder.node("a", {"href":"#", "name":"delete", "class":"disabled"}, [Builder.node("span", {"class":"icon-delete"}), "Delete"])]),
                            Builder.node("li", [Builder.node("a", {"href":"#", "name":"crop", "class":"disabled", "style":"display:none"}, [Builder.node("span", {"class":"icon-crop"}), "Crop"])])
                        ]),
                        Builder.node("ul", {"class":"content-sub tools"}, [
                            Builder.node("li", [Builder.node("a", {"href":"#", "name":"close"}, [Builder.node("span", {"class":"icon-exit"}), "Close"])]),
                            Builder.node("li", [Builder.node("a", {"href":"#", "name":"upload", "class":"disabled"}, [Builder.node("span", {"class":"icon-upload"}), "Upload"])])
                        ])
                    ])
                ])
	        ])
        ]));

        //attach listeners for top level btns (all anchors in tools ul)
        $$('div.win ul[class~=tools] a').each(function(btn) {
            switch(btn.readAttribute('name')) {
                case 'download': Event.observe(btn, "click", FileManager.downloadFile); break;
                case 'delete': Event.observe(btn, "click", FileManager.deleteFile); break;
                case 'crop': Event.observe(btn, "click", FileManager.cropBegin); break;
                case 'upload': Event.observe(btn, "click", FileManager.showUpload); break;
                case 'close': Event.observe(btn, "click", FileManager.close); break;
		    }
		});


        // --------- nav bar --------- 
	    win.appendChild(Builder.node("div", {"class":"win-nav"}, [
	        Builder.node("ul", {"class":"win-crumbs"}, [
                Builder.node("li", {"class":"first current"}, [Builder.node("a", {"id":"win-crumbs-browse", "href":"#"}, ["Browse"])]),
                Builder.node("li", {"style":"display:none"}, [Builder.node("a", {"id":"win-crumbs-detail", "href":"#"}, ["img/doc"])]),
                Builder.node("li", {"style":"display:none"}, [Builder.node("a", {"id":"win-crumbs-action", "href":"#"}, ["Crop"])])
	        ]),
            Builder.node("ul", {"id":"win-switcher-image", "class":"win-switcher", "style":"display:none"}, [
                Builder.node("li", [Builder.node('strong','Images')]),
                Builder.node("li", [Builder.node("a", {"href":"#", "goto":"document"}, ["Documents"])])
            ]),
            Builder.node("ul", {"id":"win-switcher-document", "class":"win-switcher", "style":"display:none"}, [
                Builder.node("li", [Builder.node("a", {"href":"#", "goto":"image"}, ["Images"])]),
                Builder.node("li", [Builder.node('strong','Documents')])
            ]),
            Builder.node("div", {"class":"win-search"}, [
                Builder.node("label", {"for":"win-search-txt"}, ["Search"]), ' ',
                Builder.node("input", {"type":"text", "id":"win-search-txt", "class":"txt"}), ' ',
                //Builder.node("input", {"type":"button", "class":"btn", "value":"Go"}),
                Builder.node("a", {"href":"#", "id":"win-search-clear"}, ["Clear"]),
                Builder.node("div", {"class":"win-cover", "style":"display:none"})
            ]),
            Builder.node("div", {"class":"clear"})
        ]));

        //attach listeners for breadcrumbs, switcher
		Event.observe('win-crumbs-browse', "click", FileManager.showFiles);
		Event.observe('win-crumbs-detail', "click", FileManager.showDetail);
		Event.observe('win-search-clear', "click", FileManager.showFiles);
		$$('div.win-nav ul.win-switcher a').each(function(a) { Event.observe(a, "click", FileManager.switchTypeClick); });


        // --------- win content --------- 
		var content = win.appendChild(Builder.node("div", {"class":"win-content"}, [
		    Builder.node("iframe", {"id":"win-download-frame", "width":"1", "height":"1", "src":FileManager.base_url+"blank.htm", "frameborder":"0"}),
	        Builder.node("div", {"id":"win-content-list", "style":"display:none"}, [
                Builder.node("p", {"class":"win-sort"}, ["Sort: ",
	                Builder.node("span", {"id":"win-file-sort-date"}, [
    	                Builder.node("strong", "Recent"), " ",
    	                Builder.node("a", {"href":"#", "sort":"name"}, ["A-Z"])
    	            ]),
	                Builder.node("span", {"id":"win-file-sort-name", "style":"display:none"}, [
    	                Builder.node("a", {"href":"#", "sort":"date"}, ["Recent"]), " ",
    	                Builder.node("strong", "A-Z")
    	            ]), Builder.node('span', {'class':'win-fields-spacer'}),
                    Builder.node("label", {"for":"win-file-filter", "style":"display:none;"}, ["Filter: "]),
                    Builder.node("select", {"id":"win-file-filter", "style":"display:none;"})
                ]),
	            Builder.node("p", {"id":"win-pages-top", "class":"win-pages"}),
	            Builder.node("ul", {"class":"win-thumbs", "style":"display:none"}), 
	            Builder.node("table", {"id":"win-content-doc-list", "style":"display:none", "class":"clear"}, [
	                Builder.node("thead", [Builder.node("tr", [Builder.node("th", {"scope":"col"}, ["Document"]), Builder.node("th", {"scope":"col"}, ["Size"]), Builder.node("th", {"scope":"col"}, ["Date uploaded"])])]),
	                Builder.node("tbody")
	            ]),
	            Builder.node("p", {"id":"win-pages-bottom", "class":"win-pages", "style":"clear:both"})
	        ]),
	        Builder.node("div",{"id":"win-content-upload", "style":"display:none"}, [
	            Builder.node("div", {"class":"win-content-primary"}, [
		            Builder.node("iframe", {"id":"win-content-upload-frame", "frameborder":"0", "src":FileManager.base_url+"blank.htm", "style":"height:430px;"})
		        ]),
	            Builder.node("div", {"class":"win-content-secondary"}, [
		            Builder.node("h2", 'Types of files allowed'), // type_replace
		            Builder.node("ul", {"id":"win-upload-types"})
		        ])
	        ])
		]));
		
		//attach listeners for sort, filter
		$$('div.win-content p.win-sort a').each(function(a) { Event.observe(a, "click", FileManager.sort); });
		Event.observe('win-file-filter', "change", FileManager.filter);


        // --------- file detail --------- 
        content.appendChild(Builder.node("div", {"id":"win-content-detail", "style":"display:none"}, [
            Builder.node("div", {"class":"win-content-primary"}, [
	            Builder.node("div", {"class":"win-work-area"}, [Builder.node("div", {"class":"win-aligner"})])
            ]), 
            Builder.node("div", {"class":"win-content-secondary"}, [
                Builder.node("div", {"id":"win-content-file-detail"}, [
                    Builder.node("p", {'id':'win-link-backto-links'}, [
                        Builder.node('span', {'class':'win-link-arrow-l'}), " ", 
                        Builder.node("a", {"href":"#", "goto":"fields", "style":"display:none"}, ["Back to file detail"]),
                        Builder.node("a", {"href":"#", "goto":"list"}, ["Back to files"])
                    ]),
                    Builder.node("dl", [
                        Builder.node("dt","File name"), Builder.node("dd", {"id":"win-content-file-info-name"}),
                        Builder.node("dt","File path"), Builder.node("dd", {"id":"win-content-file-info-path"}),
                        Builder.node("dt","File size"), Builder.node("dd", {"id":"win-content-file-info-size"}),
                        Builder.node("dt","Dimensions (pixels)"),
                        Builder.node("dd",[
                            "Width ", Builder.node("span", {"id":"win-content-file-info-width"}),
                            ", Height ", Builder.node("span", {"id":"win-content-file-info-height"}),
                            Builder.node("br"),
                            Builder.node("a", {"href":"#", "id":"win-content-file-info-full", "target":"_blank"}, ["View full size"])
                        ]),
                        Builder.node("dt","Date uploaded"), Builder.node("dd", {"id":"win-content-file-info-date"})
                    ]),
                    Builder.node("dl", {"id":"win-content-custom-attr", "style":"display:none"}),
                    Builder.node("dl", [
                        Builder.node("dt","Where this file is being used"), Builder.node("dd", {"id":"win-content-file-info-references"}) //type_replace
                    ]),
					Builder.node("p", {"id":"win-file-select-cancel", "style":"padding-top:1.5em;"}, [
						Builder.node("input", {"type":"button", "class":"btn", "style":"width:11em;", "value":"Select"}),
						Builder.node('span', {'class':'win-fields-spacer'}), 
						Builder.node("a", {"href":"#", "goto":"list"}, ["Cancel"]),
						Builder.node('span', {'class':'win-fields-spacer'}), 
						Builder.node("a", {"href":"#", "id":"win-file-info-clear"}, ["Clear selection"])
					])
                ]),
                Builder.node("div", {"id":"win-content-file-crop", "style":"display:none"}, [
                    Builder.node("h2","Cropping tips"),
                    Builder.node("p", ["Adjust the cropping rectangle by dragging corners and edges."]),
                    Builder.node("p", [Builder.node("img", {"src":FileManager.base_url+"images/tip-cropping-resize.gif"})]),
                    Builder.node("p", ["Move the cropping rectangle by clicking and dragging it."]),
                    Builder.node("p", [Builder.node("img", {"src":FileManager.base_url+"images/tip-cropping-drag.gif"})]),
                    Builder.node("dl", [
                        Builder.node("dt","Crop dimensions (pixels, approximate)"),
                        Builder.node("dd", {"id":"win-crop-size-status"})
                    ]),
                    Builder.node("p", {"style":"padding-top:1.5em;"}, [
                        Builder.node("input", {"id":"win-file-crop-btn", "type":"button", "class":"btn", "value":"Crop image"}), ' ',
                        Builder.node("a", {"href":"#", "goto":"detail"}, ["Cancel"])
                    ])
                ])
            ])
        ]));

        //html entities MUST be added by setting innerHTML (unescapeHTML doesn't work; goddamn ie bug)
        $$('span.win-link-arrow-l').each(function(a){ a.innerHTML = '&laquo; '; });
        $$('div.win-content span.win-fields-spacer').each(function(a){ a.innerHTML = '&nbsp;&nbsp; '; });

        //attach listeners for select & crop btns, various links w/ goto attrib (all use cancel func)
        $$('#win-content-detail a[goto]').each(function(a){ Event.observe(a, "click", FileManager.cancel); });
		Event.observe($$('#win-file-select-cancel input')[0], "click", FileManager.selectFile);
		Event.observe('win-file-info-clear', "click", FileManager.removeSelection);
		Event.observe('win-file-crop-btn', "click", FileManager.cropFinish);
    },
    
    //detail fields container has info, browse, select, cancel, remove selection
    createFieldsDIV:function() {
	    //insert as first child in file detail panel
	    $("win-content-file-detail").parentNode.appendChild(Builder.node("div", {"id":"win-content-file-fields"}, [
            Builder.node("p", [
                Builder.node('span', {'class':'win-link-arrow-l'}), " ", Builder.node("a", {"href":"#", "goto":"list"}, ["Back to files"]),
                ' | ',
                Builder.node("a", {"href":"#", "goto":"info"}, ["File info"]), ' ', Builder.node('span', {'class':'win-link-arrow-r'})
            ]),
            Builder.node("div"),
            Builder.node("p", [
                Builder.node("input", {"id":"win-file-select-btn", "type":"button", "class":"btn", "value":"Select"}),
                Builder.node('span', {'class':'win-fields-spacer'}), 
                Builder.node("a", {"href":"#", "goto":"list"}, ["Cancel"]),
                Builder.node('span', {'class':'win-fields-spacer'}),
                Builder.node("a", {"href":"#", "id":"win-file-fields-clear"}, ["Clear selection"])
            ])
        ]));

		Event.observe('win-file-select-btn', "click", FileManager.selectFile);
		Event.observe('win-file-fields-clear', "click", FileManager.removeSelection);
        $$('#win-content-file-fields a[goto]').each(function(a){ Event.observe(a, "click", FileManager.cancel); });

        //html entities MUST be added by setting innerHTML (unescapeHTML doesn't work; goddamn ie bug)
        $$('span.win-link-arrow-l').each(function(a){ a.innerHTML = '&laquo; '; });
        $$('span.win-link-arrow-r').each(function(a){ a.innerHTML = '&raquo; '; });
        
        return $$('#win-content-file-fields div')[0]; //return fields container div
    },
    
    removeFieldsDIV:function() {
        var fields = $('win-content-file-fields');
        if (fields) fields.remove();
    },
    
    //file detail fields only used when inserting into editor
    createFileFields:function(disabled_fields) {
        if (!$('win-content-file-fields')) { //skip if already exists
			var fields = this.createFieldsDIV();
			fields.appendChild(Builder.node("div", [
				Builder.node("p", {"id":"win-fields-caption-p"}, [Builder.node("strong","Caption"), ' (optional)', Builder.node("br"), 
					Builder.node("textarea", {"id":"win-fields-caption", "rows":"3", "cols":"10", "class":"txt"})
				]),
				Builder.node("p", {"id":"win-fields-credit-p"}, [Builder.node("strong","Credit"), ' (photographer, illustrator, etc; optional)', Builder.node("br"),
					Builder.node("input", {"id":"win-fields-credit", "type":"text", "class":"txt"})
				]),
				Builder.node("p", {"id":"win-fields-alt-p"}, [Builder.node("strong","Alternate text"), " (appears if image doesn't load)", Builder.node("br"),
					Builder.node("input", {"id":"win-fields-alt", "type":"text", "class":"txt"})
				]),
				Builder.node("p", [
					Builder.node("label", {"for":"win-fields-size"}, [Builder.node("strong","Size")]), ' ', Builder.node("select", {"id":"win-fields-size", "style":"width:8em", "preview":"size"}), Builder.node('span', {'class':'win-fields-spacer'}),
					Builder.node("label", {"for":"win-fields-align"}, [Builder.node("strong","Alignment")]), ' ', Builder.node("select", {"id":"win-fields-align", "style":"width:6em", "preview":"align"}, [Builder.node("option", {"value":"right"}, ["Right"]),Builder.node("option", {"value":"left"}, ["Left"]),Builder.node("option", {"value":"none"}, ["None"])])
				]),
				Builder.node("p", {"style":"margin-bottom:0;"}, [
					Builder.node("strong", "Preview"),
					Builder.node('span', {'class':'win-fields-spacer'}),
					Builder.node("span", {"id":"win-preview-alert", "style":"color:#ee0000;display:none"})
				]),
				Builder.node("div", {"class":"win-preview"}, [Builder.node("img", {"id":"win-preview-img"}),
					Builder.node("p", ["Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Duis accumsan erat vite sapien. Fusce massa metus, scelerisque ut, rutrum ut, semper et, velit. Utcondime pellentesque nisi. Donec placerat. Duis et nibh ut enim fringilla ultricies. Proin vestibulum tempor velit. Donec at sem et metus posuere adipiscing. Praesent nulla nisl, facilisis posuere, suscipit vitae, mollis in, ligula. Fusce elementum laoreet pede. Etiam rutrum, lectus id ornare eleifend, metus urna iaculis leo, quis euismod urna tellus ac est. Fusce diam justo, cursus vestibulum, suscipit non, elementum quis, tortor. Donec vel risus ut lectus convallis sollicitudin. Sed elementum nibh. Donec eget ipsum vitae tortor elementum semper. Curabitur ac justo. Nunc at dui. Sed pulvinar, nunc et mollis molestie, tortor est auctor risus, eu pulvinar purus orci et nulla. Morbi iaculis pharetra felis. Vestibulum ac erat."])
				]),
				Builder.node("p", {"class":"win-dimensions"}, [
					"Width: ", Builder.node("strong", {"id":"win-dimensions-width"}), Builder.node('span', {'class':'win-fields-spacer'}), 
					"Height: ", Builder.node("strong", {"id":"win-dimensions-height"}),
				]),
				Builder.node("p", {"class":"win-dimensions", "style":"display:none"}, [
					"Width: ", Builder.node('input',{"id":"win-fields-width", "type":"text", "class":"txt"}), Builder.node('span', {'class':'win-fields-spacer'}),
					"Height: ", Builder.node('input',{"id":"win-fields-height", "type":"text", "class":"txt"})
				])
			]));

			//attach listeners for drop downs for img preview
			Event.observe('win-fields-align', "change", FileManager.updatePreview);
			Event.observe('win-fields-size', "change", FileManager.updatePreview);

			//html entities MUST be added by setting innerHTML (unescapeHTML doesn't work; goddamn ie bug)
			$$('#win-content-file-fields span.win-fields-spacer').each(function(a){ a.innerHTML = '&nbsp;&nbsp; '; });
		}
		
		["caption", "credit", "alt"].each(function(field) {
			if (disabled_fields.include(field))
				$("win-fields-"+field+"-p").hide();
			else
				$("win-fields-"+field+"-p").show();
		});
    },

    //file crop tips only used when inserting into element & alert(s) passed
    createCropTips:function(tip) {
        var fields;
        if ($('win-content-file-fields')) {
            fields = $$('#win-content-file-fields > div')[0];
            while (fields.firstChild) fields.removeChild(fields.firstChild);
        }
        else fields = this.createFieldsDIV();

	    fields.appendChild(Builder.node("div", [
            Builder.node("h2", [tip.title]),
            Builder.node("p", this.parseBodyForImgs(tip.body)),
            Builder.node("div", {'id':'win-fields-alerts', "class":"win-alert", "style":"display:none"}, [
                Builder.node('p', [
                    Builder.node('span'), ' ',
                    Builder.node("a", {'id':'win-fields-crop', "href":"#"}, ["Crop this image"]), ' ',
                    Builder.node('span', {'class':'win-link-arrow-r'})
                ])
            ])
        ]));
        
        Event.observe('win-fields-crop', "click", FileManager.cropBegin);

        //html entities MUST be added by setting innerHTML (unescapeHTML doesn't work; goddamn ie bug)
        $$('#win-content-file-fields span.win-fields-spacer').each(function(a){ a.innerHTML = '&nbsp;&nbsp; '; });
        $$('span.win-link-arrow-r').each(function(a){ a.innerHTML = '&raquo; '; });
    },

	convertVersionString: function(versionString) {
		var r = versionString.split('.');
		return parseInt(r[0])*100000 + parseInt(r[1])*1000 + parseInt(r[2]);
	},

    getPageSize:function() {
        var xScroll, yScroll;
        if (window.innerHeight && window.scrollMaxY) {
            xScroll = document.body.scrollWidth;
            yScroll = window.innerHeight + window.scrollMaxY;
        } else if (document.body.scrollHeight > document.body.offsetHeight){ // all but Explorer Mac
            xScroll = document.body.scrollWidth;
            yScroll = document.body.scrollHeight;
        } else { // Explorer Mac...would also work in Explorer 6 Strict, Mozilla and Safari
            xScroll = document.body.offsetWidth;
            yScroll = document.body.offsetHeight;
        }

        var windowWidth, windowHeight;
        if (self.innerHeight) { // all except Explorer
            windowWidth = self.innerWidth;
            windowHeight = self.innerHeight;
        } else if (document.documentElement && document.documentElement.clientHeight) { // Explorer 6 Strict Mode
            windowWidth = document.documentElement.clientWidth;
            windowHeight = document.documentElement.clientHeight;
        } else if (document.body) { // other Explorers
            windowWidth = document.body.clientWidth;
            windowHeight = document.body.clientHeight;
        }

        var pageWidth, pageHeight;
        // for small pages with total width less then width of the viewport
        if(xScroll < windowWidth) pageWidth = windowWidth;
        else pageWidth = xScroll;
        // for small pages with total height less then height of the viewport
        if(yScroll < windowHeight) pageHeight = windowHeight;
        else pageHeight = yScroll;

        return new Array(pageWidth,pageHeight,windowWidth,windowHeight)
    },
	   
	//function to create image handler path
	buildHandlerPath:function(path, setting, stamp) {
		var handler = "full";
		var prefix = path.substring(path.lastIndexOf('/')+1, path.lastIndexOf('.')); //remove ext from file path
		if(setting != "" && handler != "") handler += ";";
		if(setting != "" || handler != "") prefix += "-" + handler + setting;
		var qs = "";
		if (stamp) {
        	var now = new Date();
        	qs = "?u=" + now.valueOf(); //add unique date stamp
		}
		if (FileManager.curr_mgr != "") {
		    //qs += ((qs == "")?"?":"&") + "FileManager=" + FileManager.curr_mgr;
		    qs += FileManager.curr_mgr;
		    if (qs.startsWith('&')) qs = qs.replace('&','?');
		}
		return path + "/" + prefix + FileManager.handler_ext + qs;
	},
	
	getPathFromHandlerUrl:function(fld, val) { //tries to parse file path (name or full path) from handler url format
	    if (!val || val == "") return "";
		if(val.indexOf("?") > -1) //remove querystring...
			val = val.substr(0, val.indexOf("?"));
		if(val.indexOf("/") > -1 && val.lastIndexOf(FileManager.handler_ext) == val.length-FileManager.handler_ext.length) //looks like handler format...
		    val = val.substring(val.lastIndexOf("/", val.lastIndexOf("/")-1)+1, val.lastIndexOf("/")); //parse orig file name from handler path

		if(val.indexOf("/") == -1) val = fld + val; //add folder in front of file name
		return val;
	},

	transformDims:function(dims, d, val) {
	    if (val == 0 || (d != 'w' && d != 'h')) return dims;
	    if (!dims || !dims.width || !dims.height) return { width:0, height:0 };
	    var w = (d=='w')? val : Math.round((val * dims.width)/dims.height);
	    var h = (d=='h')? val : Math.round((val * dims.height)/dims.width);
	    return { width:w, height:h };
    },
    
    prepStringForRE:function(s) {
        //escape all special re chars...
        var prep = s.gsub(/([\.\$\^\{\[\(\|\)\]\}\*\+\?\\])/, function(m) {return '\\'+m[1]});
        return prep;
    },
    
    trimAndHighlightName:function(n, max_len, re) {
	    var trim_len = n.length - max_len; //calculate how much to trim before adding <strong> tags
	    if (re) n = n.sub(re, "<strong>#{1}</strong>"); //re passed in should capture a found search str

        //if we don't need to trim, return
		if (trim_len <= 0) return n;

        //if no search, trim & return
        if (!re) return n.substr(0, max_len) + "&hellip;";

        //need to correctly trim string, after it has strong tags
        var parts = n.split(/<\/?strong>/);
        n = ""; //clear name, will be rebuilt
        var len = 0;
        parts.each(function(p, i) {
            if (i % 2 == 1) n += "<strong>";
            // (max_len - len) is number of chars needed to get to max len
            if (p.length <= max_len - len) n += p;
            else n += p.substr(0, max_len - len);
            len += p.length;
            if (i % 2 == 1) n += "</strong>";
            if (len >= max_len) throw $break;
        });
        return n + "&hellip;";
    },

    handler_pattern: "(size|max)\\$(\\d+),(\\d+)", //used in a few places

    parseHandlerSize:function(path) {
		if(path && path.indexOf("/") > -1 && path.lastIndexOf(FileManager.handler_ext) == path.length-FileManager.handler_ext.length) { //looks like handler format...
			var re = new RegExp("^.+;" + this.handler_pattern + "\\"+FileManager.handler_ext+"$", "i");
			var m = re.exec(path); //if regex matches, m[0] is full match; m[1] is size/max, m[2],m[3] are w/h
            if(m) return {width:parseInt(m[2],10), height:parseInt(m[3],10)};
		}
		return null;
    },
    
    parseBodyForImgs:function(body) { //useful function to parse img tags from body txt and create dom images
        var parts = body.split(/<img[^>]+>/gi);
        if (parts.length == 1) return parts; //no imgs...
        var c = []; //composite array of strings and dom imgs
        if (parts[0] != "") c.push(parts[0]); //add first part of body
        var m = body.match(/<img[^>]+>/gi);
        var sm, src, re = new RegExp("src=[^\\s]+", "gi");
        for (var i=0; i<m.length; i++) {
            sm = m[i].match(re);
            if (sm) {
                src = sm[0].toQueryParams().src.replace(new RegExp("'|\"", 'g'), '');
                c.push(Builder.node("img", {'src':src}));
            }
            if (parts[i+1] != "") c.push(parts[i+1]);
        }
        return c;
    },

	extractXmlVal:function(xmlDOM, val) { //common task
		var nodes = $A(xmlDOM.getElementsByTagName(val));
		if(nodes.length == 1 && this.elHasTextNode(nodes[0])) return nodes[0].firstChild.nodeValue.toLowerCase();
		return "";
	},

	elHasTextNode:function(element) { 	//handy function to use when reading data from returned xml
		if (!element.hasChildNodes) return false;
		for (var i = 0; i < element.childNodes.length; i++) {
			if(element.childNodes[i].nodeType == 3) return true;
		}
		return false;
	},

	loadXml:function(url, params, successCallback, type) { //utility func for making AJAX xml request
	    if (!params) params = "";
	    if (type && !params.include("bg=1")) this.loading(true, type);
		var request = new Ajax.Request(url, {method:'post', parameters:params, onSuccess:successCallback, onFailure:this.handleAjaxError});
	},
	
	loading:function(show, key) {
	    var l = $('win-loading');
	    if (!l) return;
	    if (show && !l.visible()) {
            l.setAttribute('key', key);
            l.show();
        }
        else if (!show && (!key || l.readAttribute('key') == key))
            l.hide();
	},

	handleAjaxError:function() { alert("Ajax error occurred."); }
};





var FM_File = Class.create();
FM_File.prototype = {
	path:"",
	name:"",
	ext:"",
	dims:null,
	thumb:null,
	thumb_setting:"max$134,134",
	fully_loaded:false,
	size_in_range:true,
	checked_bounds:false,

	initialize:function(settings) {
		this.opts = Object.extend({
			path:"", 
			cache:true, //set to false to add a unique date stamp to img url
			uploaded:false, //flag if newly uploaded
			cropped:false,  //flag if newly cropped
			attr:null, //hash of attributes
			custom:null //hash of custom attributes
		}, settings || {});

		//bind listener
		this.onClick = this._onClick.bindAsEventListener(this);

		this.path = this.opts.path.toLowerCase();
		this.name = this.opts.attr.n;
		//if name not passed, extract name from path
		if(this.name == "" && this.path != "") this.name = this.path.substr(this.path.lastIndexOf('/')+1);

		//extract file ext
		this.ext = this.name.substr(this.name.lastIndexOf('.')+1);

        if (this.opts.attr.m) { //create date from milliseconds
            this.date = new Date(parseFloat(this.opts.attr.m));
            if (!this.date) this.date = new Date();
            // 'u' attribute is for 'uploaded' date (formatted w/ month name)
            this.opts.attr.u = FM_Util.monthNames[this.date.getMonth()]+' '+this.date.getDate()+', '+this.date.getFullYear();
            var h = this.date.getHours();
            var m = this.date.getMinutes();
            var ampm = (h>11)?' pm':' am';
            if (h==0) h = 12;
            if (h>12) h -= 12;
            if (m<10) m = "0" + m;
            this.opts.attr.d = (this.date.getMonth()+1)+'/'+this.date.getDate()+'/'+this.date.getFullYear();
            this.opts.attr.d += ' '+h+':'+m+ampm;
        }

        this.full_size = true; //default

		//additional img settings
		if (this.isImage()) {
			this.dims = { //parse w/h passed as attributes (might have comma)
			    width: parseInt(this.opts.attr.w.replace(/,/g,''), 10),
			    height: parseInt(this.opts.attr.h.replace(/,/g,''), 10)
			}
			if (isNaN(this.dims.width)) this.dims.width = 0;
			if (isNaN(this.dims.height)) this.dims.height = 0;
    		this.fully_loaded = (this.dims.width > 0 && this.dims.height > 0);
    		
            // max size of this image for inserting (default is full size)
            this.max_size = { width:this.dims.width, height:this.dims.height };

            //check if full size
            this.full_size = (FM_Util.work_area_max.width >= this.dims.width && FM_Util.work_area_max.height >= this.dims.height);

            if (this.opts.prefetch) {
                this.createThumb();
		        this.thumb_loaded = true;
            }
		}
		else { // doc
    		this.fully_loaded = true;
    	}
	},
	
	_onClick:function(e) {
		FileManager.fileSelected(this); //just pass file back
		Event.stop(e);
	},
	
	createThumb:function() {
	    if(this.isImage())
	        this.thumb = Builder.node("img", {"src":FM_Util.buildHandlerPath(this.path, this.thumb_setting, !this.opts.cache)});
	    else //document icon
	        this.thumb = Builder.node("img", {"src":FileManager.base_url+"../../themes/advanced/img/icon-" + this.ext + ".gif"});
	},
	
	getThumb:function() {
	    if (!this.thumb) this.createThumb(); //create thumb first time
		else this.thumb_loaded = true;
		return this.thumb;
	},
	
	isImage:function() { //check if file name ends with recognized img ext
		return /^.*\.(gif|jpg|jpe|jpeg|tif|tiff|png|bmp)$/i.test(this.name);
	},

	dimInRange:function(dim, min, max) {
		if(min > 0 && this.dims[dim] < min) return false;
		if(max > 0 && this.dims[dim] > max) return false;
		return true;
	},
	
	getTrimmedName:function(re) {
        var max_len = (this.isImage()? 17:50);
        return FM_Util.trimAndHighlightName(this.name, max_len, re);
	},

	getAttr:function(a) {
	    var attr = (this.opts.attr[a] || "");
	    if(a == 'n') return attr.toLowerCase();
		return attr;
	}
};



var FM_Image = Class.create();
FM_Image.prototype = {
    loaded:false,

	initialize:function(settings) {
		this.opts = Object.extend({
		    path:"", //default url to load
		    icon:false, //flag if this is an icon
		    onLoad:Prototype.emptyFunction, //can pass in a function to be called on img load
		    element:null //DOM element to hold the img
		}, settings || {});

        //listener for image load
		this.imgLoaded = this._imgLoaded.bindAsEventListener(this);

        //default setting
		this.setting = "max$"+FM_Util.work_area_max.width+","+FM_Util.work_area_max.height;

        if(this.opts.path != "") {
            if (this.opts.icon)
                this.load(this.opts.path, true);
            else //normal img, apply max setting
                this.load(FM_Util.buildHandlerPath(this.opts.path, this.setting, !this.opts.cache));
        }
	},

	width:function() {
		return (this.image && this.loaded? this.image.width:0);
	},

	height:function() {
		return (this.image && this.loaded? this.image.height:0);
	},

	reductionPct:function(dims) { //calculate % this img is reduced from orig dims
	    if (!dims || !dims.width || !dims.height || dims.width <= 0 || dims.height <= 0) return 1;
	    var w = this.width(), h = this.height();
	    if (w == 0 || h == 0 || w == dims.width || h == dims.height) return 1;
	    if (w > h) return (w/dims.width); //using larger value to get more accurate %
	    return (h/dims.height);
	},

	clear:function(icon) {
		if(this.image) {
			if (!icon) Event.stopObserving(this.image, "load", this.imgLoaded);
			this.image.parentNode.removeChild(this.image);
			this.image = null;
		}
	},

	load:function(url, icon) {
	    if(this.image) this.prev_url = this.image.src; //store prev url
		this.clear(icon);
		if(this.opts.element) { //add img to DOM element
		    this.curr_url = url;
		    if (icon) {
    		    this.image = this.opts.element.appendChild(Builder.node("img", {"src":url}));
    		    return;
		    }
		    FM_Util.loading(true, 'image');
		    this.image = this.opts.element.appendChild(Builder.node("img", {"src":url, "style":"display:none"}));
		    Event.observe(this.image, "load", this.imgLoaded); //watch for img to finish loading
		}
	},

	_imgLoaded:function(e) {
		this.loaded = true;
		this.image.show();
	    FM_Util.loading(false, 'image');
	    this.opts.onLoad();
		FileManager.imageLoaded(); //notify fm that img has loaded
	}
};


var FM_Alert = Class.create();
FM_Alert.prototype = {
	initialize:function(settings) {
		this.opts = Object.extend({
            enforce: true, // if true, will force cropping; otherwise will still allow file to be selected
		    text:"", 
		    width:0, height:0, 
		    max_width:0, max_height:0,
		    min_width:0, min_height:0
		}, settings || {});
		
		if (this.opts.width > 0) this.opts.max_width = this.opts.width;
		else if (this.opts.min_width > 0) this.opts.width = this.opts.min_width;

		if (this.opts.height > 0) this.opts.max_height = this.opts.height;
		else if (this.opts.min_height > 0) this.opts.height = this.opts.min_height;
	},

	isValid:function(size) {
        if ((this.opts.max_width > 0 && this.opts.max_width < size.width) || (this.opts.max_height > 0 && this.opts.max_height < size.height))
            return false;
        if ((this.opts.width > 0 && this.opts.width > size.width) || (this.opts.height > 0 && this.opts.height > size.height))
            return false;
        return true;
	}
};