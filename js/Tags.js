/**
 * Keyword Tagging Component
 * This class describes a system for adding keyword tags to just about anything.
 * It includes the "Add Tag" button, and only requires a <ul> element with a tagSetId data attribute.
 * The basic idea is that each time a tag is added, updated or removed, the contents of the <ul> are
 * re-rendered to ensure a complete set. Event handling is done via delegation at the parent element
 * level to avoid memory leaks from tags being added and removed in different sets. Tags are also kept
 * in 'tag sets', even when only one tag set is required, so that an object of this class only needs
 * to be instanciated once, but can control multiple sets of tags and their associated events.
 *
 * Usage Examples:
 *
 * 1. Create a single set of tags. Useful for adding tags to a single product/item. A tagSetId is required.
 *   HTML:
 *   <ul data-tagSetId="default"></ul>
 *
 *   JS:
 *   var xxxTags = new Tags();
 *   xxxTags.setTags('default',['tag 1','tag 2','tag n']);
 *
 * 2. Create two separate sets of tags. Useful for managing tags for multiple items at once. Use different tagSetIds.
 *   HTML:
 *   <ul data-tagSetId="set1"></ul>
 *   <ul data-tagSetId="set2"></ul>
 *
 *   JS:
 *   var multiTags = new Tags(); // only need to create once
 *   multiTags.setTags('set1',['set1-tag 1','set1-tag 2','set1-tag n']);
 *   multiTags.setTags('set2', ['set2-tag 1', 'set2-tag 2', set2-tag n']);
 *
 *
 * Potential Pitfalls:
 * In order to keep tag sets and tag items separated in DOM, tag sets will have "tagSet_" prepended to the id
 * attribute and tag items will have "tag_" appended to their id attributes. Often we replace this prefix and
 * provide a "cleanTagSetId" or "cleanTagId" to match id attributes with the values in the data model. This is
 * important when adding sets, editing tags, or deleting them. Update: because getting a clean tag set id, or
 * a clean tag id is something that is done more than once, and becuase of the use of regexp to do this, there
 * is now a getCleanId method to handle this.
 *
 */
var Tags = function(config){
	var self = {
		// this object will hold all tags in tag sets.
		// this is what allows it to do multiple sets with a single instance.
		tagSets: [],

		// this objects configuration values. use this to make the object
		// configurable, meaning changable without having to change code.
		config: {
			// the element that gets event handlers attached
			// should be the closest non-changing 'wrapper' of the tag sets
			evtHandlerTarget: 'body',
			// the text that will display inside the input field when user adds a tag
			addTagInputText: 'Add Tag Here',
			// the label for the add tag button
			addTagBtnLabel: 'Add Tag',
			// the label for the button users click to submit their tag text
			editTagBtnLabel: 'OK',
			// if set to true, the tag input field will submit as soon as a user clicks anywhere else.
			// this can cause problems with them wanting to click the 'x' button while in edit mode.
			// the problem being that the blur event happens before the click event, so the click isn't fired.
			submitOnBlur: false,
			// this is the max number of tags allowed per tag set, if set to zero than infinite tags are allowed
			maxTagLimit: 0
		},

		/**
		 * @function 	mo.widget.Tags.init
		 * @description Calls methods to start up and run the tagging system
		 * @author 		Jacob
		 * @arguments 	none
		 * @returns 	undefined
		 */
		init: function(config){
			for(var c in config){ this.config[c] = config[c]; }
			this.initEventHandlers();
		},

		/**
		 * @function 	mo.widget.Tags.initEventHandlers
		 * @description Handles event delegation for all the events required by the tagging system
		 * @author 		Jacob
		 * @arguments 	none
		 * @returns 	undefined
		 */
		initEventHandlers: function(){
			// add tags via 'add tag' button
			$(this.config.evtHandlerTarget).delegate('.itemTagWrapper .addTagBtn', 'click', function(evt){
				evt.stopPropagation();
				self.doAddTag($(this).parents('ul').attr('id'));
			});

			// put existing tag into edit mode when clicked
			$(this.config.evtHandlerTarget).delegate('.itemTagWrapper .tagLabel', 'click', function(evt){
				evt.stopPropagation();
				self.doEditTag($(this).parents('ul').attr('id'), $(this));
			});

			// save tag when text field is defocused (from editing or adding)
			// but only if that feature is enabled
			if(this.config.submitOnBlur){
				$(this.config.evtHandlerTarget).delegate('.itemTagWrapper .tagLabelInput', 'blur', function(evt){
					evt.stopPropagation();
					self.doSaveTag($(this));
				});
			}

			// save when submit is clicked
			$(this.config.evtHandlerTarget).delegate('.itemTagWrapper .tagSubmitBtn', 'click', function(evt){
				evt.stopPropagation();
				self.doSaveTag($(this).siblings('.tagLabelInput'));
				
				// return false so that the .tagLabel click event doesn't fire as a result of bubbling
				// using preventDefault and stopPropagation don't seem to get the job done.
				// not doing this results in an extra call to doEditTag, but without a tagSetId (JS error)
				return false;
			});

			// delete tags when tags' delete button is clicked
			$(this.config.evtHandlerTarget).delegate('.itemTagWrapper .tagDeleteBtn', 'click', function(evt){
				evt.stopPropagation();
				self.doDeleteTag($(this).parents('ul').attr('id'), $(this).parent());
			});
		},

		/**
		 * @function 	mo.widget.Tags.setTags
		 * @description Accepts a list of tags and uses that to populate the tag list for a particular tag set.
		 * @author 		Jacob
		 * @arguments 	tagSetId String, tagArray Object
		 * @returns 	undefined
		 */
		setTags: function(tagSetId, tagArray){
			// make sure to strip away extra id info from tagSetId
			var cleanTagSetId = this.getCleanId(tagSetId, 'tagSetId');
			
			// make sure the tag set is defined, create if not
			if(typeof this.tagSets == 'undefined' || typeof this.tagSets[cleanTagSetId] == 'undefined'){
				this.tagSets[cleanTagSetId] = {
					// the tags in this set are stored in this array
					tags: [],
					// this will determine whether tags in this set can be added, edited or removed
					isEditable: true,
					// this value is toggled internally, it prevents multiple tags from being added
					// at once, or tags being added while another tag in this set is being edited
					isLocked: false
				};
			}
			// otherwise, empty the tags in this set so that we can start fresh.
			// if we don't do this, everytime we set tags, it will append to the list
			// we do not need to worry about isEditable here, leave as is
			else { this.tagSets[cleanTagSetId].tags = []; }
			
			// now fill it with the tags that were passed in
			for(var t in tagArray){ this.setTag(cleanTagSetId, tagArray[t]); }
			
			// we must refresh the list to show the changes
			this.refreshTagList(cleanTagSetId);
		},

		/**
		 * @function 	mo.widget.Tags.getAllTags
		 * @description Returns an object with all the tags for all tag sets in this object
		 * @author 		Jacob
		 * @arguments 	none
		 * @returns 	Object
		 */
		getAllTags: function(){
			var output = {};
			for(var s in this.tagSets){ output[s] = this.getTagsByTagSetId(s); }
			return output;
		},

		/**
		 * @function 	mo.widget.Tags.getTagsByTagSetId
		 * @description Returns an array with all the tags for a particular tag set
		 * @author 		Jacob
		 * @arguments 	tagSetId String
		 * @returns 	Array
		 */
		getTagsByTagSetId: function(tagSetId){
			return this.tagSets[tagSetId].tags;
		},

		/**
		 * @function 	mo.widget.Tags.setTag
		 * @description Updates a tag if tagId is passed and found; otherwise, a new tag will be created
		 * @author 		Jacob
		 * @arguments 	tagSetId String, tagLabel String, tagId String
		 * @returns 	undefined
		 */
		setTag: function(tagSetId, tagLabel, tagId){
			if(typeof tagId == 'undefined'){ this.tagSets[tagSetId].tags.push(tagLabel); }
			else { this.tagSets[tagSetId].tags[tagId] = tagLabel; }
		},

		/**
		 * @function	mo.widget.Tags.refreshTagList
		 * @description Updates the HTML tag list by regenerating the list from the current set of tags
		 * @author 		Jacob
		 * @arguments 	tagSetId String
		 * @returns 	undefined
		 */
		refreshTagList: function(tagSetId){
			// it's likely that tagSetId was 'cleaned' before it got here,
			// make sure to make it 'dirty' again so we get the right element
			var tagSet = $('#tagSet_' + tagSetId);
			
			// we will include the 'add tag' button as the first tag, if adding tags is allowed
			// using .html() will add the "add tag" button AND clear the tag set in one swoop.
			// if the add tag button is not enabled, we must then clear the html anyway
			if(this.tagSets[tagSetId].isEditable){
				tagSet.html($('<li class="addTagItem"><a class="addTagBtn">' + this.config.addTagBtnLabel + '</a></li>'));
			}
			else { tagSet.empty(); }
			
			for(var t in this.tagSets[tagSetId].tags){
				var tagItem = $('<li id="tagSet_' + tagSetId + '-tag_' + t + '"></li>');
				var tagLabel = $('<span class="tagLabel view">' + this.tagSets[tagSetId].tags[t] + '</span>');
				var tagDeleteBtn = $('<button class="tagDeleteBtn"></button>');
				
				// add this tag to the set, with/without remove button
				tagItem.append(tagLabel);
				if(this.tagSets[tagSetId].isEditable) tagItem.append(tagDeleteBtn);
				tagSet.append(tagItem);
			}
		},

		/**
		 * @function 	mo.widget.Tags.setTagsEditable
		 * @description Changes the isEditable value for a single tag set
		 * @author 		Jacob
		 * @arguments 	tagSetId String, value Bool
		 * @returns 	undefined
		 */
		setTagsEditable: function(tagSetId, value){
			// make sure we only set to true or false, don't trust input
			var cleanValue = (value == 'true' || value == true) ? true : false;
			this.tagSets[tagSetId].isEditable = cleanValue;
			
			// updating the tags will add any markup needed to add/edit/remove
			this.refreshTagList(tagSetId);
		},

		/**
		 * @function 	mo.widget.Tags.doAddTag
		 * @description Creates a new tag element in a particular tag set, but it's in edit mode so the user can set the text.
		 * @author 		Jacob
		 * @arguments 	tagSetId String
		 * @returns 	undefined
		 */
		doAddTag: function(tagSetId){
			// make sure to strip away extra id info from tagSetId
			var cleanTagSetId = this.getCleanId(tagSetId, 'tagSetId');
			
			// use length property to get the next sequential tag number
			var nextTagSeq = this.tagSets[cleanTagSetId].tags.length;
			
			// only add tags if adding tags is allowed on this set,
			// and we don't have any tags being added/edited (i.e. locked) in this set
			// if we are allowing infinite tags or the maxTagLimit has not been reached
			if(this.tagSets[cleanTagSetId].isEditable
				&& this.tagSets[cleanTagSetId].isLocked == false
				&& (this.config.maxTagLimit == 0 || nextTagSeq <= this.config.maxTagLimit)){
				// doing it this way keeps it separated and organized,
				// it also helps if we need to do things to any of the elements, like focus on the input field
				var newTag = $('<li id="tempTag_' + nextTagSeq + '"></li>');
				var newTagLabel = $('<span class="tagLabel edit"></span>');
				var newTagInput = $('<input type="text" value="' + this.config.addTagInputText + '" class="tagLabelInput" />');
				var newTagSubmitBtn = $('<button class="tagSubmitBtn">' + this.config.editTagBtnLabel + '</button>');
				var newTagDeleteBtn = $('<button class="tagDeleteBtn"></button>');
				
				// add it all together, and append it to the tag set list
				newTagLabel.append(newTagInput, newTagSubmitBtn);
				newTag.append(newTagLabel, newTagDeleteBtn);
				$('#tagSet_' + cleanTagSetId).append(newTag);
				
				// like mentioned before, focus the input field so user can start typing immediately
				newTagInput.focus().select();

				// also remember to lock this set so tags cannot be added/edited until this one is done
				this.tagSets[cleanTagSetId].isLocked = true;
			}
		},

		/**
		 * @function 	mo.widget.Tags.doEditTag
		 * @description Puts an established tag into edit mode; putting the value into an input field, and adding a submit button
		 * @author 		Jacob
		 * @arguments 	tagSetId String, tagLabel Object
		 * @returns 	undefined
		 */
		doEditTag: function(tagSetId, tagLabel){
			// make sure to strip away extra id info from tagSetId
			var cleanTagSetId = this.getCleanId(tagSetId, 'tagSetId');
			
			// make sure that tag is not already in edit mode, and that editing tags is allowed.
			// otherwise, strange markup things will happen (markup inside/outside input field)
			// and that this tag set is not locked because another tag is being added/edited.
			if(this.tagSets[cleanTagSetId].isEditable && tagLabel.hasClass('view') && this.tagSets[cleanTagSetId].isLocked == false){
				
				// use css classes to determin edit/view mode
				// also set an original value that we can reset back to if needed
				tagLabel.removeClass('view').addClass('edit');
				tagLabel.data('origValue', tagLabel.html());

				// the 'editing form' elements
				var input = $('<input type="text" value="' + tagLabel.html() + '" class="tagLabelInput" />');
				var submit = $('<button class="tagSubmitBtn">' + this.config.editTagBtnLabel + '</button>');
				
				// clear the label text, then replace with the input field and submit btn
				tagLabel.empty().append(input, submit);
				
				// make sure input field is focused and all content selected
				input.focus().select();

				// also remember to lock this set so tags cannot be added/edited until this one is done
				this.tagSets[cleanTagSetId].isLocked = true;
			}
		},

		/**
		 * @function 	mo.widget.Tags.doSaveTag
		 * @description If the tag is worthy, it is saved to the list; otherwise, it is removed.
		 * @author 		Jacob
		 * @arguments 	tagItemInput Object
		 * @returns 	undefined
		 */
		doSaveTag: function(tagItemInput){
			var tagLabel = tagItemInput.parent(); // we will use this a couple of times
			var cleanTagSetId = this.getCleanId(tagLabel.parents('ul').attr('id'), 'tagSetId');
			var cleanTagId = this.getCleanId(tagLabel.parents('li').attr('id'), 'tagId');
			var tagValue = tagItemInput.val();

			// only save if not empty, and the user actually typed something meaningful
			if(tagItemInput.val() != '' && tagItemInput.val() != this.config.addTagInputText){
				// update data model
				this.setTag(cleanTagSetId, tagValue, cleanTagId);
				
				// tell anyone listening that we added a tag
				$.event.trigger('addedTag');
				
				// refresh the tag list
				this.refreshTagList(cleanTagSetId);
			}
			else {
				// if we are editing a tag, then the tag should have an 'origValue' property.
				// if it does, then reset back to that property; effectively making sure that
				// a user cannot remove a tag by editing it into an empty string.
				// by 'reset', I mean refresh the list again to remove the 'edit' mode
				if(tagLabel.data('origValue')){ this.refreshTagList(cleanTagSetId); }
				// otherwise, this tag is being added, and we can just remove it.
				else { this.doDeleteTag(cleanTagSetId, tagItemInput.parents('li')); }
			}

			// in either case, unlock this tag set
			this.tagSets[cleanTagSetId].isLocked = false;
		},

		/**
		 * @function 	mo.widget.Tags.doDeleteTag
		 * @description Removes a tag from the list then refreshes the UI, only fires an event if the tag was pre-existing.
		 * @author 		Jacob
		 * @arguments 	tagSetId String, tagItem Object, isPreExisting Boolean
		 * @returns 	undefined
		 */
		doDeleteTag: function(tagSetId, tagItem){
			var isPreExisting = (tagItem.attr('id').indexOf('tempTag') == -1) ? true : false;
			
			// make sure to strip away extra id info from tagSetId
			var cleanTagSetId = this.getCleanId(tagSetId, 'tagSetId');
			var cleanTagId = this.getCleanId(tagItem.attr('id'), 'tagId');
			
			// only remove if removing is allowed
			if(this.tagSets[cleanTagSetId].isEditable){
				// remove from data model
				this.tagSets[cleanTagSetId].tags.splice(cleanTagId, 1);
				
				// tell anyone listening that we removed a tag (but only if preExisting)
				if(isPreExisting){ $.event.trigger('removedTag'); }
				
				// update the view
				this.refreshTagList(cleanTagSetId);
			}
		},

		/**
		 * @function 	mo.widget.Tags.getCleanId
		 * @description There are a couple of places where we need to strip out text from an ID. This method does it so the code is only in one place.
		 * @author 		Jacob
		 * @arguments 	dirtyId String, idType String
		 * @returns 	String
		 */
		getCleanId: function(dirtyId, idType){
			switch(idType){
				case 'tagSetId': return dirtyId.replace(/tagSet_/, '');
				case 'tagId': return dirtyId.replace(/(tagSet_[^-]+-)?(tag|tempTag)_/, '');
			}
		}
	}

	// must init before return or events will not work
	self.init(config);
	return self;
}
