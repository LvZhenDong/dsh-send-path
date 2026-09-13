' send-path.vbs — Explorer context-menu bridge.
' Explorer invokes this with the selected file/folder path (%1); it POSTs the
' exact absolute path to the local dsh-send-path resolver, which pushes it into
' the open DeepSeek Harness dialog.
'
' Self-healing and silent: if the resolver is not running it is started hidden
' and the request is retried a few times. No dialog is ever shown (an earlier
' version popped a "Windows Script Host" error when the service was down).
Dim p, fso, baseDir, launcher, attempt
If WScript.Arguments.Count = 0 Then WScript.Quit 1
p = WScript.Arguments(0)
If Len(p) = 0 Then WScript.Quit 1

Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = baseDir & "\start-resolver.vbs"

Function TrySend()
  Dim http
  TrySend = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.setProxy 1                        ' bypass any system proxy for loopback
  Err.Clear
  http.open "POST", "http://127.0.0.1:3081/insert", False
  http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
  Err.Clear
  http.send "{""path"":""" & Replace(p, "\", "\\") & """}"
  If Err.Number = 0 Then TrySend = True
  Err.Clear
  On Error GoTo 0
End Function

If Not TrySend() Then
  ' Resolver is not running: start it hidden, then retry (node needs a moment).
  If fso.FileExists(launcher) Then
    CreateObject("WScript.Shell").Run """" & launcher & """", 0, False
    For attempt = 1 To 6
      WScript.Sleep 500
      If TrySend() Then Exit For
    Next
  End If
End If
WScript.Quit 0
