@echo off
echo ========================================
echo ERS Tech ISP 短接宝典 v1.1.0 自动发布脚本
echo ========================================
echo.

echo 1. 检查Git状态...
git status

echo.
echo 2. 添加所有修改...
git add .

echo.
echo 3. 提交更改...
git commit -m "v1.1.0: 添加Tauri自动更新签名验证、版本控制优化"

echo.
echo 4. 推送到GitHub...
git push origin main

echo.
echo 5. 创建并推送标签...
git tag v1.1.0
git push origin v1.1.0

echo.
echo 6. 构建安装包...
cd taiku
npm run tauri build

echo.
echo ========================================
echo 完成！请手动上传安装包到GitHub Release
echo 安装包位置：src-tauri/target/release/bundle/nsis/ERS Tech ISP 短接宝典_1.1.0_x64-setup.exe
echo ========================================
pause
