' dsh drop-resolver: hidden auto-start launcher (registered at HKCU Run).
' Restarts the loopback path-resolution helper after logon.
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\lvzhendong\.dsh\drop-resolver\resolver.mjs""", 0, False
