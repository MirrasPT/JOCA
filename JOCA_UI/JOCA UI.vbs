' JOCA UI — One-click launcher (Windows)
' Double-click to start JOCA UI silently and open browser.

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Run start.bat silently (window hidden)
WshShell.Run """" & scriptDir & "\start.bat""", 0, False
