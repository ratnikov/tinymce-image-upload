
function showNewFileDetail(new_path, fld) {
    if(window.parent && typeof(window.parent.FileManager.addUploadedFiles) != 'undefined')
        window.parent.FileManager.addUploadedFiles(new_path, fld);
    else alert('cannot find FileManager.addUploadedFiles!');
}

function cancelUpload() {
    if(window.parent && typeof(window.parent.FileManager.cancelUpload) != 'undefined')
        window.parent.FileManager.cancelUpload();
    return false;
}

function startUpload() {
    if(window.parent && typeof(window.parent.FileManager.showUpload) != 'undefined')
        window.parent.FileManager.showUpload();
    return false;
}

function toggleBtn(btn, disable) {
    btn = $(btn);
    if(!btn) return;
    btn.disabled = disable;
    if(disable) btn.addClassName("disabled");
    else btn.removeClassName("disabled");
}

//fired onbeforeunload
function disableBtns() {
    toggleBtn('btnUploadSingle', true);
    toggleBtn('btnUploadMulti', true);
    var wait = $("waitMsg");
    if(wait) wait.className = "alert";
}

function inputFileChanged(e, btn) {
    var sel = false;
    $$('input[type=file]').each(function(tbx) {
        if (tbx.value != '') sel = true;
    });

    var input = Event.element(e);
    if (sel && input) { //only validate if something selected
        var exts = $('ext').value.toUpperCase();
        //allow new office extensions
        exts = exts.gsub(/(DOC|PPT|XLS)/, "#{1}|#{1}X");
        var ext_re = new RegExp("^.+\\.(" + exts + ")$", "gi");
        if (input.value.search(ext_re)==-1) {
            alert("File type chosen is NOT an allowed type (" + exts.gsub(/\|/, ", ") + ").\n\nChoose a valid file and try again.");
            sel = false;
        }
        if (sel) { //only check punct if ok so far
            //checking file name format... 
            // only word chars, dashes, periods and spaces allowed (must also end with word char), then period and 3 or 4 char file ext
            var name_pattern = "(\\w|-|\\.|\\s)*\\w{1}\\.\\w{3,4}$";

			//probably (but not always; ff3 only uses the filename not path) some path before last slash (could be forward or back slash, depending on PC v MAC)...
            var path_re = new RegExp("^.+(\\\\|/){1}" + name_pattern);
            var name_re = new RegExp("^" + name_pattern);

            if (input.value.search(path_re)==-1 && input.value.search(name_re)==-1) {
                alert("File names cannot contain punctuation other than periods and dashes.\n\nRename the file and try again.");
                sel = false;
            }
        }
    }
    toggleBtn(btn, !sel);
}