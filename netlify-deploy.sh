#!/bin/bash

echo "=== Cleaning build directories ==="
rm -rf .next
rm -rf out

echo "=== Installing dependencies ==="
npm ci

echo "=== Building application for Netlify ==="
npm run netlify:build

echo "=== Project is ready for Netlify deployment ==="
echo "You can now commit and push your changes to GitHub for Netlify deployment"
