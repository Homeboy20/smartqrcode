@echo off
echo === Cleaning build directories ===
if exist .next rmdir /s /q .next
if exist out rmdir /s /q out

echo === Installing dependencies ===
npm ci

echo === Building application for Netlify ===
npm run netlify:build

echo === Project is ready for Netlify deployment ===
echo You can now commit and push your changes to GitHub for Netlify deployment
