' send-path.vbs — Explorer context-menu bridge.
' Explorer invokes this with the selected file/folder path (%1); it POSTs the
' exact absolute path to the local dsh-send-path resolver, which pushes it into
' the open DeepSeek Harness dialog.
'
' Self-healing and silent:
'   1. Try the insert once (the normal, service-up path).
'   2. If the service is unreachable, start it hidden (start-resolver.vbs next
'      to this file), wait for /health to answer, then insert ONCE.
' Because the insert is sent only after the service is confirmed healthy, a
' wake-up never risks inserting the same path twice. No dialog is ever shown.
Dim p, fso, baseDir, launcher, attempt, done
If WScript.Arguments.Count = 0 Then WScript.Quit 1
p = WScript.Arguments(0)
If Len(p) = 0 Then WScript.Quit 1

Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = baseDir & "\start-resolver.vbs"

Function NewHttp()
  Dim http
  Set http = CreateObject("MSXML2.XMLHTTP")
  On Error Resume Next
  http.setProxy 1                        ' bypass any system proxy for loopback
  Err.Clear
  On Error GoTo 0
  Set NewHttp = http
End Function

Function InsertPath()
  Dim http
  InsertPath = False
  On Error Resume Next
  Set http = NewHttp()
  http.open "POST", "http://127.0.0.1:3081/insert", False
  http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
  Err.Clear
  http.send "{""path"":""" & Replace(p, "\", "\\") & """}"
  If Err.Number = 0 Then InsertPath = True
  Err.Clear
  On Error GoTo 0
End Function

Function ServiceHealthy()
  Dim http
  ServiceHealthy = False
  On Error Resume Next
  Set http = NewHttp()
  http.open "GET", "http://127.0.0.1:3081/health", False
  Err.Clear
  http.send
  If Err.Number = 0 Then
    If http.status = 200 Then ServiceHealthy = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

done = InsertPath()
If Not done Then
  ' Service is not running: start it hidden, wait until it answers, insert once.
  If fso.FileExists(launcher) Then
    CreateObject("WScript.Shell").Run """" & launcher & """", 0, False
    For attempt = 1 To 16                   ' up to ~8s (cold node start)
      WScript.Sleep 500
      If ServiceHealthy() Then
        done = InsertPath()
        Exit For
      End If
    Next
  End If
End If
WScript.Quit 0
