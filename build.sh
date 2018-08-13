echo "Create package for Chromium"
zip -r "netmarks.chromium.zip" * -x "*node_modules/*" -x "*.git*" -x "*/.DS_Store" -x "npm-debug.log" -x "*.sh" -x "*.md" -x "*.txt" ./chrome
