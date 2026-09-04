' dsh-send-path: hidden autostart launcher for the resolver (registered at HKCU Run).
' Fully portable: derives its own folder (so resolver.mjs sits right next to it)
' and locates node.exe at runtime via the Node.js registry key, common install
' locations, and finally the PATH. No machine-specific paths are baked in.
Dim sh, fso, baseDir, resolver, node, i
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
resolver = baseDir & "\resolver.mjs"

node = ""
On Error Resume Next
node = sh.RegRead("HKLM\SOFTWARE\Node.js\InstallPath")
If node <> "" Then node = Trim(node)
If node <> "" Then If Not fso.FileExists(node & "\node.exe") Then node = ""
If node = "" Then
  node = sh.RegRead("HKLM\SOFTWARE\WOW6432Node\Node.js\InstallPath")
  If node <> "" Then node = Trim(node)
  If node <> "" Then If Not fso.FileExists(node & "\node.exe") Then node = ""
End If
On Error GoTo 0

If node = "" Then
  Dim candidates
  candidates = Array( _
    sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Programs\nodejs\node.exe" _
  )
  For i = 0 To UBound(candidates)
    If fso.FileExists(candidates(i)) Then node = candidates(i) : Exit For
  Next
End If

If node = "" Then node = "node"   ' last resort: rely on the PATH lookup of ShellExecute
sh.Run """" & node & """ """ & resolver & """", 0, False
