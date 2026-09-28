; Workshop's additions to the Windows installer (bundle > windows > nsis > installerHooks in tauri.conf.json).

; Always put a Workshop icon on the desktop. Tauri's installer only makes one when the
; box on its last page is left ticked, which is easy to miss. Updates and /NS installs
; (no shortcuts) are left alone, as the installer's own shortcut function decides.
!macro NSIS_HOOK_POSTINSTALL
  Call CreateOrUpdateDesktopShortcut
!macroend
