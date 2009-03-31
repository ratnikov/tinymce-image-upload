<%@ Page Language="C#" AutoEventWireup="true" CodeFile="Upload.aspx.cs" Inherits="Webitects.Components.FileUpload" Trace="false" %><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Upload window</title>
	<link href="../../themes/advanced/skins/default/content.css" media="all" rel="stylesheet" type="text/css" />
	<link href="../../themes/advanced/skins/default/admin.css" media="all" rel="stylesheet" type="text/css" />
	<script src="../../../libraries/prototype-1.6.js" type='text/javascript'></script>
	<script src="jscripts/upload.js" type='text/javascript'></script>
    <script type="text/javascript">
        Event.observe(window, 'load', function() {
            <asp:Literal ID="jsOnLoad" runat="server" />

            //alert('upload frame loaded')
            if ($('btnUploadSingle'))
                Event.observe('tbxUploadSingle', 'change', inputFileChanged.bindAsEventListener(window, 'btnUploadSingle'));
            else if ($('btnUploadMulti')) {
                var fileChangedHandler = inputFileChanged.bindAsEventListener(window, 'btnUploadMulti');
                Event.observe('tbxUploadMulti1', 'change', fileChangedHandler);
                Event.observe('tbxUploadMulti2', 'change', fileChangedHandler);
                Event.observe('tbxUploadMulti3', 'change', fileChangedHandler);
                Event.observe('tbxUploadMulti4', 'change', fileChangedHandler);
                Event.observe('tbxUploadMulti5', 'change', fileChangedHandler);
            }
        });
    </script>
</head>
<body onbeforeunload="disableBtns(true);">
	<form id="uploadForm" runat="server" enctype="multipart/form-data">
		<input id="fileType" type="hidden" runat="server" />
		<input id="mode" type="hidden" runat="server" />
		<input id="path" type="hidden" runat="server" />
		<input id="ext" type="hidden" runat="server" />
		<input id="custom_fields" type="hidden" runat="server" />

        <div class="win" style="height:400px; width:400px; background:#fff; border:0;">
    	    <h2 id="formHeader" runat="server">Upload <asp:Literal ID="fileUploadType" runat="server" /></h2>
            <p><asp:Literal id="errMsg" runat="server" /></p>
            
            <asp:PlaceHolder ID="phOverwriteDialog" runat="server" Visible="false">
	            <p>
					<input id="btnOverwriteYes" class="btn" type="submit" value="Yes, overwrite" onserverclick="UploadFileClick" runat="server" /> 
					<a href="#" onclick="return startUpload();">Start over</a>
				</p>
			</asp:PlaceHolder>

            <asp:PlaceHolder ID="phUpload" runat="server">
	            <p><strong>Note:</strong> Large <asp:Literal ID="ltlNoteType" runat="server" /> will take a little longer to upload</p>
                <p>
                    <asp:Label AssociatedControlID="tbxUploadSingle" runat="server">Select <asp:Literal ID="ltlSelectType" runat="server" /> from your computer:</asp:Label> 
                    <input class="txt" id="tbxUploadSingle" type="file" runat="server" />
                </p>
                <asp:PlaceHolder id="phCustomFields" runat="server" Visible="false">
                    <p id="pCustomField1" runat="server" visible="false">
                        <asp:Label AssociatedControlID="tbxCustomField1" runat="server"><asp:Literal ID="ltlCustomField1" runat="server" /></asp:Label> 
                        <input class="txt" id="tbxCustomField1" type="text" runat="server" />
                    </p>
                    <p id="pCustomField2" runat="server" visible="false">
                        <asp:Label AssociatedControlID="tbxCustomField2" runat="server"><asp:Literal ID="ltlCustomField2" runat="server" /></asp:Label> 
                        <input class="txt" id="tbxCustomField2" type="text" runat="server" />
                    </p>
                    <p id="pCustomField3" runat="server" visible="false">
                        <asp:Label AssociatedControlID="tbxCustomField3" runat="server"><asp:Literal ID="ltlCustomField3" runat="server" /></asp:Label> 
                        <input class="txt" id="tbxCustomField3" type="text" runat="server" />
                    </p>
                </asp:PlaceHolder>

                <p id="pMultiLink" runat="server"><a href="?view=multi<%=qStr%>">Upload multiple <asp:Literal ID="ltlMultiLinkType" runat="server" /></a></p>

	            <p><input class="btn" type="submit" id="btnUploadSingle" value="Upload" disabled="disabled" onserverclick="UploadFileClick" runat="server" causesvalidation="true" /> 
	            <a href="#" onclick="return cancelUpload();">Cancel</a></p>
			    <p><strong id="waitMsg" class="hide"><img alt="loading..." src="images/loadingbar.gif" /></strong></p>
		    </asp:PlaceHolder>

            <asp:PlaceHolder ID="phMultiUpload" runat="server" Visible="false">
                <p>Select <asp:Literal ID="ltlMultiSelectType" runat="server" /> to upload</p>
	            <p><input class="txt" id="tbxUploadMulti1" type="file" style="width:98%;" runat="server" /></p>
	            <p><input class="txt" id="tbxUploadMulti2" type="file" style="width:98%;" runat="server" /></p>
	            <p><input class="txt" id="tbxUploadMulti3" type="file" style="width:98%;" runat="server" /></p>
	            <p><input class="txt" id="tbxUploadMulti4" type="file" style="width:98%;" runat="server" /></p>
	            <p><input class="txt" id="tbxUploadMulti5" type="file" style="width:98%;" runat="server" /></p>

	            <p><input id="btnUploadMulti" class="btn disabled" type="submit" value="Upload" disabled="disabled" onserverclick="UploadFileClick" runat="server" /> 
	            <a href="#" onclick="return cancelUpload();">Cancel</a></p>
	            <p><strong id="waitMsg" class="hide"><img alt="loading..." src="images/loadingbar.gif" /></strong></p>
            </asp:PlaceHolder>
        </div>
	</form>
</body>
</html>