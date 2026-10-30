@echo off
chcp 65001 > nul
echo ==============================================================
echo   DEWAYS RESTORAN VIDEOSINI PAPKAGA KO'CHIRISH
echo ==============================================================
echo.
echo Video nusxalanmoqda...
copy /Y "C:\Users\normi\.gemini\antigravity\brain\f0ed627f-48fc-474a-a5cb-20c2067a883f\.user_uploaded\media_1793349934035_46fed3f4.mp4" "%~dp0deways-intro.mp4"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [MUVAFFAQIYATLI] "deways-intro.mp4" muvaffaqiyatli loyiha papkasiga tushdi!
    echo.
    echo Endi GitHub Desktop yoki terminal orqali "deways-intro.mp4" faylini
    echo GitHub-ga Push qilsangiz, saytingizda video darhol ishlaydi!
) else (
    echo.
    echo [XATOLIK] Nusxalashda muammo yuz berdi.
)
echo.
echo ==============================================================
pause
