@echo off
REM 刷新环境变量
set "PATH=%PATH%;C:\Program Files\nodejs"

REM 运行开发服务器
echo Starting Next.js development server...
npm run dev
