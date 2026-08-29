' send-path.vbs — Explorer context-menu bridge.
' Windows Explorer invokes this with the selected file/folder path (%1); it
' POSTs the exact absolute path to the dsh drop-resolver, which pushes it into
' the open DeepSeek Harness dialog via its SSE /events channel.
If WScript.Arguments.Count = 0 Then WScript.Quit 1
Dim p
p = WScript.Arguments(0)
If Len(p) = 0 Then WScript.Quit 1
Dim http
Set http = CreateObject("MSXML2.XMLHTTP")
http.open "POST", "http://127.0.0.1:3081/insert", False
http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
http.send "{""path"":""" & Replace(p, "\", "\\") & """}"
WScript.Quit 0
