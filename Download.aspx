<%@ Page Language="C#" Trace="false" Buffer="false" %>
<%@ Import Namespace="Webitects.Components" %>
<script runat="server">
	protected void Page_Load(object sender, EventArgs e)
	{
		Response.Clear();
        try
        {
            string path = Request.QueryString["path"];
            if (!string.IsNullOrEmpty(path))
            {
                MFile f = FileManagerService.LoadFile(path, true);
                if (f.File != null && f.Name != "")
                {
                    Response.ContentType = "application/octet-stream";
                    Response.AddHeader("Content-Disposition", "attachment; filename=\"" + f.Name + "\"");
                    Response.Flush();
                    if (Response.IsClientConnected) Response.BinaryWrite(f.File);
                }
            }
        }
        catch (Exception ex) { }
		Response.Close();
	}
</script>