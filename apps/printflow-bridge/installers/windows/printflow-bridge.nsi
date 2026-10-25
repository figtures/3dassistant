; PrintFlow Bridge — tek tık Windows kurulum (NSIS)
!include "MUI2.nsh"

!define APP_NAME "PrintFlow Bridge"
!define COMPANY "PrintFlow"
!define VERSION "${PRINTFLOW_BRIDGE_VERSION}"

Name "${APP_NAME}"
OutFile "..\..\dist\printflow-bridge_${VERSION}_windows_amd64-setup.exe"
InstallDir "$PROGRAMFILES64\PrintFlow Bridge"
RequestExecutionLevel admin

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Turkish"

Section "Install"
  SetOutPath "$INSTDIR"
  File "..\..\dist\printflow-bridge_${VERSION}_windows_amd64.exe"
  Rename "$INSTDIR\printflow-bridge_${VERSION}_windows_amd64.exe" "$INSTDIR\printflow-bridge.exe"

  WriteRegStr HKLM "Software\Classes\printflow" "" "URL:PrintFlow Protocol"
  WriteRegStr HKLM "Software\Classes\printflow" "URL Protocol" ""
  WriteRegStr HKLM "Software\Classes\printflow\shell\open\command" "" '"$INSTDIR\printflow-bridge.exe" open-url "%1"'

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintFlowBridge" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintFlowBridge" "UninstallString" "$INSTDIR\Uninstall.exe"

  ; Görev Zamanlayıcı: oturum açılışında arka plan
  nsExec::ExecToLog 'schtasks /Create /F /TN "PrintFlow Bridge" /TR "\"$INSTDIR\printflow-bridge.exe\" run" /SC ONLOGON /RL LIMITED'
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\printflow-bridge.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "Software\Classes\printflow"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PrintFlowBridge"
  nsExec::ExecToLog 'schtasks /Delete /F /TN "PrintFlow Bridge"'
SectionEnd
