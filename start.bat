@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 936 >nul
cd /d "%~dp0"
title 青禾智慧农业 · 一键启动

rem ============================================================
rem  一键启动：MySQL -> 后端 :8080 -> 前端 :5181 -> 浏览器
rem  重复运行安全：已运行的服务会自动跳过。
rem
rem  可选环境变量（一般无需设置）：
rem    DB_USER      数据库账号，默认 root
rem    DB_PASSWORD  数据库密码，默认 123456
rem  数据库不存在时会自动创建并导入表结构与演示数据。
rem  密码不是 123456 时：先执行  set DB_PASSWORD=你的密码  再运行本脚本
rem ============================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "API_PORT=8080"
set "WEB_PORT=5181"
set "JAR=%ROOT%\server\target\agri-trace-server-0.1.0.jar"
set "MYSQL_BIN="
set "FAIL=0"
set "WAIT=%SystemRoot%\System32\ping.exe"
if not defined DB_USER set "DB_USER=root"
if not defined DB_PASSWORD set "DB_PASSWORD=123456"

echo.
echo  ============================================
echo     青禾智慧农业 · 一键启动
echo  ============================================
echo.

echo [1/4] 检查运行环境
where java >nul 2>nul
if errorlevel 1 (
  echo   [错误] 找不到 java，请安装 JDK 17 并加入 PATH。
  set "FAIL=1"
) else (
  for /f "tokens=3" %%v in ('java -version 2^>^&1 ^| findstr /i "version"') do set "JVER=%%v"
  set JVER=!JVER:"=!
  for /f "tokens=1 delims=." %%m in ("!JVER!") do set "JMAJOR=%%m"
  if not defined JMAJOR (
    echo   [错误] 无法识别 Java 版本。
    set "FAIL=1"
  ) else if !JMAJOR! LSS 17 (
    echo   [错误] 当前 Java !JVER!，需要 17 或更高版本。
    set "FAIL=1"
  ) else (
    echo   [OK] Java !JVER!
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo   [错误] 找不到 node，请安装 Node.js 18+。
  set "FAIL=1"
) else (
  for /f "delims=" %%v in ('node -v') do set "NVER=%%v"
  echo   [OK] Node !NVER!
)
where npm >nul 2>nul
if errorlevel 1 (
  echo   [错误] 找不到 npm。
  set "FAIL=1"
)

if not exist "%JAR%" (
  echo   [错误] 缺少后端 jar：%JAR%
  echo          请参考 README 使用 Maven 编译，或确认文件未被删除。
  set "FAIL=1"
) else (
  echo   [OK] 后端 jar 就绪
)

if not "%FAIL%"=="0" (
  echo.
  echo  环境检查未通过，已停止启动。
  pause
  exit /b 1
)

if not exist "%ROOT%\web\node_modules" (
  echo.
  echo  [..] 首次运行：安装前端依赖（需要几分钟）...
  pushd "%ROOT%\web"
  call npm install
  if errorlevel 1 (
    popd
    echo   [错误] npm install 失败。
    pause
    exit /b 1
  )
  popd
)

echo.
echo [2/4] 检查 MySQL
call :port_open 3306
if errorlevel 1 (
  echo   [..] MySQL 未运行，尝试启动服务 MySQL ...
  net start MySQL >nul 2>nul
  call :wait_port 3306 20
)
call :port_open 3306
if errorlevel 1 (
  echo   [错误] MySQL 未监听 3306，请先手动启动 MySQL 服务。
  pause
  exit /b 1
) else (
  echo   [OK] MySQL 已运行
)

where mysql >nul 2>nul && set "MYSQL_BIN=mysql"
if not defined MYSQL_BIN if exist "D:\mysql\bin\mysql.exe" set "MYSQL_BIN=D:\mysql\bin\mysql.exe"
if not defined MYSQL_BIN if exist "%ProgramFiles%\MySQL\MySQL Server 8.0\bin\mysql.exe" set "MYSQL_BIN=%ProgramFiles%\MySQL\MySQL Server 8.0\bin\mysql.exe"
if not defined MYSQL_BIN for /d %%d in ("%ProgramFiles%\MySQL\*") do if exist "%%d\bin\mysql.exe" set "MYSQL_BIN=%%d\bin\mysql.exe"

if not defined MYSQL_BIN (
  echo   [跳过] 未找到 mysql 客户端，跳过建库与演示日期刷新。
) else (
  set "MYSQL_PWD=!DB_PASSWORD!"
  "!MYSQL_BIN!" -u !DB_USER! -e "SELECT 1" >nul 2>nul
  if errorlevel 1 (
    echo   [错误] 无法使用账号 !DB_USER! 和密码 123456 连接 MySQL。
    echo          如密码不同：set DB_PASSWORD=你的密码  再运行本脚本。
    set "FAIL=1"
  ) else (
    echo   [OK] 已连接 MySQL（账号 !DB_USER!）
    call :prepare_db
    if errorlevel 1 set "FAIL=1"
  )
  set "MYSQL_PWD="
)

if not "%FAIL%"=="0" (
  echo.
  echo  数据库准备失败，已停止启动。
  pause
  exit /b 1
)

echo.
echo [3/4] 启动后端
call :port_open %API_PORT%
if not errorlevel 1 (
  echo   [OK] 后端已在运行：http://127.0.0.1:%API_PORT%
) else (
  echo   [..] 启动 Spring Boot（最小化窗口 agri-backend）...
  start "agri-backend" /min /d "%ROOT%\server" cmd /k "java -jar target\agri-trace-server-0.1.0.jar"
  call :wait_port %API_PORT% 90
  if errorlevel 1 (
    echo   [错误] 后端 90 秒内未就绪，请查看 agri-backend 窗口。
    pause
    exit /b 1
  ) else (
    echo   [OK] 后端已就绪：http://127.0.0.1:%API_PORT%
  )
)

echo.
echo [4/4] 启动前端
call :port_open %WEB_PORT%
if not errorlevel 1 (
  echo   [OK] 前端已在运行：http://localhost:%WEB_PORT%
) else (
  echo   [..] 启动 Vite（最小化窗口 agri-frontend）...
  start "agri-frontend" /min /d "%ROOT%\web" cmd /k "npm run dev"
  call :wait_port %WEB_PORT% 60
  if errorlevel 1 (
    echo   [错误] 前端 60 秒内未就绪，请查看 agri-frontend 窗口。
    pause
    exit /b 1
  ) else (
    echo   [OK] 前端已就绪：http://localhost:%WEB_PORT%
  )
)

echo.
echo  ============================================
echo   启动完成
echo   前端：http://localhost:%WEB_PORT%
echo   后端：http://127.0.0.1:%API_PORT%   Swagger：/swagger-ui.html
echo   演示账号：admin / 123456
echo   关闭服务：关闭 agri-backend 与 agri-frontend 窗口即可
echo  ============================================
start "" "http://localhost:%WEB_PORT%/dashboard"
"%WAIT%" -n 9 127.0.0.1 >nul
exit /b 0

:port_open
netstat -ano -p tcp | findstr /r /c:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

:wait_port
set /a _tries=0
:wait_loop
call :port_open %~1
if not errorlevel 1 exit /b 0
set /a _tries+=1
if !_tries! GEQ %~2 exit /b 1
"%WAIT%" -n 2 127.0.0.1 >nul
goto wait_loop

:prepare_db
set "DBU=root"
if defined DB_USER set "DBU=!DB_USER!"
"!MYSQL_BIN!" -u !DBU! -e "SELECT 1" >nul 2>nul
if errorlevel 1 (
  echo   [错误] 无法连接 MySQL，请检查 DB_USER / DB_PASSWORD。
  exit /b 1
)
"!MYSQL_BIN!" -u !DBU! -N -e "SELECT schema_name FROM information_schema.schemata WHERE schema_name='agri_trace_app'" 2>nul | findstr /i "agri_trace_app" >nul
if errorlevel 1 (
  echo   [..] 数据库 agri_trace_app 不存在，自动创建...
  "!MYSQL_BIN!" -u !DBU! -e "CREATE DATABASE agri_trace_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci" 2>nul
  if errorlevel 1 (
    echo   [错误] 自动创建数据库 agri_trace_app 失败，请确认账号有建库权限。
    exit /b 1
  )
)
"!MYSQL_BIN!" -u !DBU! -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='agri_trace_app' AND table_name='farm'" 2>nul | findstr /i "farm" >nul
if errorlevel 1 (
  echo   [..] 数据库为空，初始化建表与演示数据...
  "!MYSQL_BIN!" -u !DBU! --default-character-set=utf8mb4 < "%ROOT%\sql\01_schema.sql"
  if errorlevel 1 (
    echo   [错误] 01_schema.sql 导入失败。
    exit /b 1
  )
  "!MYSQL_BIN!" -u !DBU! --default-character-set=utf8mb4 < "%ROOT%\sql\02_seed.sql"
  if errorlevel 1 (
    echo   [错误] 02_seed.sql 导入失败。
    exit /b 1
  )
  echo   [OK] 数据库初始化完成
) else (
  echo   [OK] 数据库 agri_trace_app 已就绪
)
echo   [..] 把演示业务日期平移到今天...
"!MYSQL_BIN!" -u !DBU! --default-character-set=utf8mb4 < "%ROOT%\sql\04_shift_demo_dates.sql"
if errorlevel 1 (
  echo   [提示] 演示日期刷新失败（不影响正常启动）。
) else (
  echo   [OK] 演示日期已刷新
)
exit /b 0
