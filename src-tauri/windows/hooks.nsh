; BundleRock NSIS Lifecycle Hooks
; Ensures running processes (BundleRock, yt-dlp, ffmpeg) are terminated
; and data directories and registry entries are completely wiped on uninstall.

!macro NSIS_HOOK_PREINSTALL
  ; Terminate any running instances before installation or update
  nsExec::Exec 'taskkill /F /IM BundleRock.exe /T'
  nsExec::Exec 'taskkill /F /IM yt-dlp.exe /T'
  nsExec::Exec 'taskkill /F /IM ffmpeg.exe /T'
  Sleep 300
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Terminate running processes to release file locks
  nsExec::Exec 'taskkill /F /IM BundleRock.exe /T'
  nsExec::Exec 'taskkill /F /IM yt-dlp.exe /T'
  nsExec::Exec 'taskkill /F /IM ffmpeg.exe /T'
  Sleep 500
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Completely remove user data directories, download history, and managed binaries
  RMDir /r "$APPDATA\BundleRock"
  RMDir /r "$LOCALAPPDATA\com.bundlerock.app"
  RMDir /r "$LOCALAPPDATA\BundleRock"

  ; Clean up bundlerock:// custom protocol registration from user registry
  DeleteRegKey HKCU "Software\Classes\bundlerock"
!macroend
