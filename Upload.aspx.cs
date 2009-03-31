using System;
using System.Configuration;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Web.UI.HtmlControls;
using System.Xml;


namespace Webitects.Components
{
	public partial class FileUpload : Page
	{
		//private OFolder CurrFolder;
        protected string qStr = "";
        protected string defType = "";

		protected void ReloadForm(string newParams)
		{
			Response.Redirect("UploadFrame.aspx?" + newParams + "&" + Request.ServerVariables["QUERY_STRING"]);
		}

		protected void Page_Load(object sender, EventArgs e)
		{
			if (!IsPostBack)
			{
				fileType.Value = Request.QueryString["type"];
                if (string.IsNullOrEmpty(fileType.Value)) fileType.Value = "file";
                if (Regex.IsMatch(fileType.Value, "^[aeiou].+$", RegexOptions.IgnoreCase)) defType = "an ";
                else defType = "a ";
                defType += fileType.Value;

                fileUploadType.Text = fileType.Value;
                btnUploadMulti.Value += " " + fileType.Value + "s";
                btnUploadSingle.Value += " " + fileType.Value;
                ltlSelectType.Text = defType;
                ltlMultiLinkType.Text = ltlMultiSelectType.Text = ltlNoteType.Text = fileType.Value + "s";

				if (!string.IsNullOrEmpty(Request.QueryString["path"]))
				{
					path.Value = Request.QueryString["path"];
                    ext.Value = Request.QueryString["ext"];
                    qStr = "&path=" + path.Value + "&type=" + fileType.Value;
                    if (!string.IsNullOrEmpty(ext.Value)) qStr += "&ext=" + ext.Value;

                    if (Request.QueryString["view"] == "multi")
                    {
                        phMultiUpload.Visible = true;
                        phUpload.Visible = false;
                        fileUploadType.Text += "s";
                    }

                    custom_fields.Value = Request.QueryString["custom_fields"];
                    if (!string.IsNullOrEmpty(custom_fields.Value))
                    {
                        pMultiLink.Visible = false; //can't do multiple files if custom fields
                        phCustomFields.Visible = true;
                        string[] fields = custom_fields.Value.Split(new char[] { ',' });
                        if (fields.Length >= 1)
                        {
                            pCustomField1.Visible = true;
                            ltlCustomField1.Text = fields[0].Substring(fields[0].LastIndexOf("|") + 1);
                        }
                        if (fields.Length >= 2)
                        {
                            pCustomField2.Visible = true;
                            ltlCustomField2.Text = fields[1].Substring(fields[1].LastIndexOf("|") + 1);
                        }
                        if (fields.Length >= 3)
                        {
                            pCustomField3.Visible = true;
                            ltlCustomField3.Text = fields[2].Substring(fields[2].LastIndexOf("|") + 1);
                        }
                    }
				}
				else if (Request.QueryString.HasKeys())
				{
					uploadForm.Visible = false;
					errMsg.Text = "No folder passed!";
				}
			}
		}


		private string Mode
		{
			get
			{
				if (ViewState["_FileUpload_Mode"] == null) ViewState["_FileUpload_Mode"] = "";
				return (string)ViewState["_FileUpload_Mode"];
			}
			set { ViewState["_FileUpload_Mode"] = value; }
		}

		private string NewFileFolder
		{
			get
			{
				if (ViewState["_FileUpload_FileFolder"] == null) ViewState["_FileUpload_FileFolder"] = "";
				return (string)ViewState["_FileUpload_FileFolder"];
			}
			set { ViewState["_FileUpload_FileFolder"] = value; }
		}

		private string NewFileName
		{
			get
			{
				if (ViewState["_FileUpload_FileName"] == null) ViewState["_FileUpload_FileName"] = "";
				return (string)ViewState["_FileUpload_FileName"];
			}
			set { ViewState["_FileUpload_FileName"] = value; }
		}

		private byte[] NewFileBytes
		{
			get
			{
				if (ViewState["_FileUpload_FileBytes"] == null) ViewState["_FileUpload_FileBytes"] = new byte[0];
				return (byte[])ViewState["_FileUpload_FileBytes"];
			}
			set { ViewState["_FileUpload_FileBytes"] = value; }
		}

		private MFile FileInMem
		{
			get
			{
				MFile retFile = new MFile();
				retFile.Name = NewFileName;
				retFile.File = NewFileBytes;
				retFile.Path = NewFileFolder;
				return retFile;
			}
			set
			{
				NewFileName = value.Name;
				NewFileBytes = value.File;
				NewFileFolder = value.Path;
			}
		}


        private MFile CreateMFile(HtmlInputFile input, string path)
        {
            MFile f = new MFile();
            f.Name = Path.GetFileName(input.PostedFile.FileName);
            f.Path = path;
            f.ReadFileFromStream(input.PostedFile.InputStream); //read file bytes

            if (!string.IsNullOrEmpty(custom_fields.Value))
            {
                f.Attribs = new Hashtable();
                string[] fields = custom_fields.Value.Split(new char[] { ',' });
                if (fields.Length >= 1)
                    f.Attribs.Add(fields[0].Substring(0, fields[0].LastIndexOf("|")), tbxCustomField1.Value);
                if (fields.Length >= 2)
                    f.Attribs.Add(fields[1].Substring(0, fields[1].LastIndexOf("|")), tbxCustomField2.Value);
                if (fields.Length >= 3)
                    f.Attribs.Add(fields[2].Substring(0, fields[2].LastIndexOf("|")), tbxCustomField3.Value);
            }

            return f;
        }

        protected void UploadFileClick(object sender, EventArgs e)
        {
            //string errStr = "";
			if (((Control)sender).ID.Contains("OverwriteYes"))
			{
				UploadFile(FileInMem, true);
				return;
			}

			if (phMultiUpload.Visible) UploadMultipleFiles();
            else
            {
                if (string.IsNullOrEmpty(path.Value)) { errMsg.Text = "<strong class='alert'>No folder passed!</strong>"; }
                else if (tbxUploadSingle.PostedFile.FileName == "") { errMsg.Text = "<strong class='alert'>No file specified!</strong>"; }
                else //if (this.IsValid)
                {
                    UploadFile(CreateMFile(tbxUploadSingle, path.Value), false);
                }
            }
        }

		private void UploadFile(MFile fileToUpload, bool overwrite)
		{
            phUpload.Visible = phMultiUpload.Visible = false;

			string errStr = "", statusStr = ""; //written into literal at end of method
			string newFilePath = "";
			bool fileExists = FileManagerService.FileExists(fileToUpload.Path + fileToUpload.Name);

			if (fileExists && !overwrite)
			{
				phOverwriteDialog.Visible = true;
				errStr = "A file with the same name already exists.";
				//check if ok to overwrite
				if (FileManagerService.AllowOverwrite())
				{
					FileInMem = fileToUpload;
					statusStr += "Would you like to overwrite it?";
				}
				else
				{
					statusStr += "Overwriting files is not allowed. Rename your file and try again.";
					btnOverwriteYes.Visible = false;
				}
			}
			else
			{	//ok to upload
				newFilePath = FileManagerService.SaveFile(fileToUpload);

				//javascript to load detail
				if (newFilePath != "") ShowNewDetail(newFilePath);
				else
				{
					errStr = "Upload failed.";
					statusStr = "Please try again with a different file.";
				}
			}
			//statusMsg.Text = "<p>" + statusStr + "</p>";
			if (errStr.IndexOf("<strong") == -1) errStr = "<strong class='alert'>" + errStr + "</strong>";
			if (statusStr != "") errStr += "</p><p>" + statusStr;
			errMsg.Text = errStr;
		}


		private void UploadMultipleFiles()
		{
			phUpload.Visible = phMultiUpload.Visible = false;

			List<string> newFiles = new List<string>();
			if (tbxUploadMulti1.PostedFile != null && tbxUploadMulti1.PostedFile.FileName != "")
				newFiles.Add(FileManagerService.SaveFile(CreateMFile(tbxUploadMulti1, path.Value)));
			if (tbxUploadMulti2.PostedFile != null && tbxUploadMulti2.PostedFile.FileName != "")
				newFiles.Add(FileManagerService.SaveFile(CreateMFile(tbxUploadMulti2, path.Value)));
			if (tbxUploadMulti3.PostedFile != null && tbxUploadMulti3.PostedFile.FileName != "")
				newFiles.Add(FileManagerService.SaveFile(CreateMFile(tbxUploadMulti3, path.Value)));
			if (tbxUploadMulti4.PostedFile != null && tbxUploadMulti4.PostedFile.FileName != "")
				newFiles.Add(FileManagerService.SaveFile(CreateMFile(tbxUploadMulti4, path.Value)));
			if (tbxUploadMulti5.PostedFile != null && tbxUploadMulti5.PostedFile.FileName != "")
				newFiles.Add(FileManagerService.SaveFile(CreateMFile(tbxUploadMulti5, path.Value)));

			//int fileCnt = newFiles.Count;
			//newFiles.RemoveAll(delegate(string f) { return string.IsNullOrEmpty(f); });

			//javascript to load detail
			if (newFiles.Count > 0)
			{
				string filePaths = "";
				foreach (string p in newFiles)
				{
					if (filePaths != "") filePaths += "|";
					filePaths += p;
				}
				ShowNewDetail(filePaths);

			}
			else
			{
				//no files specified
			}
		}

        private void ShowNewDetail(string pathStr)
        {
            jsOnLoad.Text = "showNewFileDetail('" + pathStr + "','" + path.Value + "');";
        }
	}
}