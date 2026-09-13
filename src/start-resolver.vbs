' dsh-send-path: hidden autostart launcher for the resolver (registered at HKCU Run).
' Fully portable: derives its own folder (resolver.mjs sits right next to it) and
' locates node.exe at runtime via the Node.js registry key, common install
' locations, and finally the PATH. No machine-specific paths are baked in.
'
' Note: the registry InstallPath value ends with a backslash; it is normalized
' away, because a path ending in "\" before a closing quote escapes that quote
' and breaks the command line.
Dim sh, fso, baseDir, resolver, node, i, candidates, probe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
resolver = baseDir & "\resolver.mjs"

Function NormalizeDir(value)
  Dim v
  v = Trim(value)
  Do While Len(v) > 0 And Right(v, 1) = "\"
    v = Left(v, Len(v) - 1)
  Loop
  NormalizeDir = v
End Function

node = ""
On Error Resume Next
probe = NormalizeDir(sh.RegRead("HKLM\SOFTWARE\Node.js\InstallPath"))
If probe <> "" Then
  If fso.FileExists(probe & "\node.exe") Then node = probe & "\node.exe"
End If
If node = "" Then
  probe = NormalizeDir(sh.RegRead("HKLM\SOFTWARE\WOW6432Node\Node.js\InstallPath"))
  If probe <> "" Then
    If fso.FileExists(probe & "\node.exe") Then node = probe & "\node.exe"
  End If
End If
On Error GoTo 0

If node = "" Then
  candidates = Array( _
    sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Programs\nodejs\node.exe" _
  )
  For i = 0 To UBound(candidates)
    If fso.FileExists(candidates(i)) Then
      node = candidates(i)
      Exit For
    End If
  Next
End If

If node = "" Then node = "node"   ' last resort: rely on the PATH lookup of ShellExecute
sh.Run """" & node & """ """ & resolver & """", 0, False
