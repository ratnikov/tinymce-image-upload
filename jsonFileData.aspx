<%@ Page Language="C#" Buffer="true" Trace="false" EnableViewState="false" EnableSessionState="False" ContentType="application/jsonrequest" %>
<%@ Import Namespace="System.Collections.Generic" %>
<%@ Import Namespace="Webitects.Components" %>
<%@ Import Namespace="Webitects.Util" %>
<script runat="server">
    public void Page_Load(Object sender, EventArgs e)
    {
        List<MFile> files = null;
        bool success = false, set_cache = false, expire_cache = false, debug = false;
        bool all_fields = true; // (bool)(Request.QueryString["fields"] == "all");
        bool bg = (bool)(Request.QueryString["bg"] == "1");
        string error = "", ret_val = "", action = Request.QueryString["action"], inst = Request.QueryString["inst"];
        string mode = "multi", file = Request.QueryString["file"], type = Request.QueryString["type"];
        string orig_path = Request.QueryString["path"];
        string path = cleanPath(orig_path);
        string mgr = FileManagerService.GetManagerName();

        if (string.IsNullOrEmpty(inst)) inst = "none";
        string json = "", cache_key = "";
        //check for cache, only if no action and we have both path & type
        if (!debug && string.IsNullOrEmpty(action) && !string.IsNullOrEmpty(mgr) && !string.IsNullOrEmpty(path) && !string.IsNullOrEmpty(type))
        {
            cache_key = mgr + ":" + type + ":" + path;
            json = (string)Cache[cache_key];
            if (!string.IsNullOrEmpty(json))
            {
                Response.Write(json);
                return;
            }
        }

        try
        {
            switch (action)
            {
                case "save-copy":
                    if (!string.IsNullOrEmpty(file)) // 'file' should be raw, ImageHandler request
                    {
                        string filename = ImageHandlerUtil.GetFileNameFromRequest(file);
                        
                        //new name will be return val
                        if (filename != "")
                        {
                            ret_val = FileManagerService.NewCopyOfFileName(filename, Request.QueryString["prefix"]);
                            string result = FileManagerService.SaveImage(ret_val, ImageUtility.GetCroppedImage(file));
                            expire_cache = success = (bool)(result != "");
                            if (success) file = ret_val;
                            else ret_val = ""; //failed
                        }
                        else error = "Unable to parse filename from ImageHandler request";
                    }
                    else error = "ImageHandler request not passed";
                    break;

                case "delete":
                    file = path + file; //add path to front of file path
                    expire_cache = success = FileManagerService.DeleteFile(file);
                    if (success) ret_val = file;
                    else error = "file not deleted";
                    mode = "single";
                    break;

                case "add-new":
                    //nothing to do at the moment, just passing the action back in the xml
                    success = expire_cache = true;
                    break;

                case "detail": //just to pull single img & go directly to detail
                    success = true;
                    break;

                default:
                    if (string.IsNullOrEmpty(action))
                    {
                        action = "none";
                        set_cache = true;
                    }
                    else error = "action not recognized";
                    break;
            }


            if (error == "" && action != "delete") //no errors so far...
            {
                if (!string.IsNullOrEmpty(file))
                {
                    string[] paths = file.Split(new char[] { '|' }, StringSplitOptions.RemoveEmptyEntries);
                    files = new List<MFile>();
                    foreach (string p in paths)
                    {
                        files.Add(FileManagerService.LoadFile(p, true));
                    }

                    if (!files.TrueForAll(ValidMFile))
                    {
                        //error = "File" + (files.Count == 1 ? "" : "s") + " '" + file + "' not found!";
                        files.RemoveAll(InvalidMFile);
                        success = false;
                        path = "";
                    }
                    else if (files.Count > 0)
                    {
                        path = cleanPath(files[0].Path); //make sure we return path
                        if (string.IsNullOrEmpty(type)) type = files[0].IsImg ? "image" : "document";
                        if (files.Count == 1) mode = "single";
                        all_fields = true;
                    }
                }
                else if (!string.IsNullOrEmpty(orig_path))
                {
                    files = new List<MFile>(FileManagerService.LoadFiles(orig_path, type, all_fields));
                }
            }
        }
        catch (Exception ex)
        {
            error = "Caught Exception: " + ex.Message;
            //throw new Exception("Caught ex" + ex.Message, ex);
        }

        json = "{\"fm\":{";
        if (error != "") json += "\"e\":\"" + error + "\"";
        else
        {
            if (action != "none")
            {
                json += "\"a\":\"" + action + "\",";
                json += "\"s\":\"" + success.ToString().ToLower() + "\",";
                json += "\"r\":\"" + ret_val + "\",";
            }
            if (bg) json += "\"b\":\"1\",";
            if (inst != "none") json += "\"i\":\"" + inst + "\",";
            json += "\"m\":\"" + mode + "\",";
            json += "\"p\":\"" + path + "\""; //write path once, instead of duplicating in 'path' attr of files
        }
        json += "}";
        if (error == "" && files != null)
        {
            string filelistjson = "", filejson = "", attrjson = "";
            foreach (MFile f in files)
            {
				filejson = "";
                if (f.Name != "")
                {
					try
					{
	                    filejson += "{";
	                    filejson += "\"n\":\"" + f.Name + "\",";
	                    if (f.IsImg)
	                    {
	                        filejson += "\"w\":\"" + f.Width.ToString("#,#") + "\",";
	                        filejson += "\"h\":\"" + f.Height.ToString("#,#") + "\",";
	                    }
	                    filejson += "\"s\":\"" + f.FriendlySize + "\",";
	                    filejson += "\"m\":" + f.Milliseconds;

	                    if (f.Attribs != null && f.Attribs.Count > 0)
	                    {
							attrjson = "";
							foreach (string key in f.Attribs.Keys)
							{
			                    if (attrjson != "") attrjson += ",";
			                    attrjson += "\"" + key + "\":\"" + f.Attribs[key] + "\"";
							}
							if (attrjson != "") filejson += ",\"custom\":{" + attrjson + "}";
	                    }

	                    filejson += "}";
					}
					catch (Exception fileEx)
					{
						// ignore errors, continue without this file
						filejson = "";
					}
                }

                if (filejson != "")
				{
					if (filelistjson != "") filelistjson += ",";
					filelistjson += filejson;
				}
            }
            if (filelistjson != "") json += ",\"f\":[" + filelistjson + "]";
        }
        json += "}";

        if ((expire_cache || set_cache) && !string.IsNullOrEmpty(mgr) && !string.IsNullOrEmpty(path) && !string.IsNullOrEmpty(type))
        {   //rebuild key if needed
            if (cache_key == "") cache_key = mgr + ":" + type + ":" + path;
            if (expire_cache) Cache.Remove(cache_key);
            if (!bg && error == "" && set_cache) Cache[cache_key] = json; //only store cache if not a bg load and no errors
        }
        if (!debug) Response.Write(json); //output json string
    }


    private bool ValidMFile(MFile file) { return !InvalidMFile(file); }
    private bool InvalidMFile(MFile file)
    {
        if (file == null || string.IsNullOrEmpty(file.Name)) return true;
        return false;
    }

    private string cleanPath(string path)
    {
        if (!string.IsNullOrEmpty(path) && path.StartsWith("~")) path = path.Substring(1); //remove root ~ (want to return relative path)
        return path;
    }
</script>