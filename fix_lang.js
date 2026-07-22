const fs = require('fs');

const hsPath = 'frontend/src/screens/HomeScreen.js';
let hs = fs.readFileSync(hsPath, 'utf8');

// Match all setPlayerData objects in HomeScreen and inject lang
hs = hs.replace(/setPlayerData\(\{\s*name:\s*displayName,\s*avatar:\s*profileData\?\.avatar \|\| 'alien',\s*frame:\s*profileData\?\.active_frame \|\| 'none',\s*mode\s*\}\)/g, 
"setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien', frame: profileData?.active_frame || 'none', mode, lang: (i18n.language || 'en').substring(0, 2) })");

hs = hs.replace(/const playerData = \{ name: displayName, avatar: profileData\?\.avatar, level: profileData\?\.level \|\| 1, frame: profileData\?\.active_frame \|\| 'none' \};/g, 
"const playerData = { name: displayName, avatar: profileData?.avatar, level: profileData?.level || 1, frame: profileData?.active_frame || 'none', lang: (i18n.language || 'en').substring(0, 2) };");

hs = hs.replace(/setPlayerData\(\{\s*name:\s*displayName,\s*avatar:\s*profileData\?\.avatar \|\| 'alien',\s*frame:\s*profileData\?\.active_frame \|\| 'none'\s*\}\)/g, 
"setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien', frame: profileData?.active_frame || 'none', lang: (i18n.language || 'en').substring(0, 2) })");

fs.writeFileSync(hsPath, hs);

const lbPath = 'frontend/src/screens/LobbyBrowserScreen.js';
let lb = fs.readFileSync(lbPath, 'utf8');

lb = lb.replace(/const playerData = \{ name: displayName, avatar: profileData\?\.avatar, level: profileData\?\.level \|\| 1 \};/g, 
"const playerData = { name: displayName, avatar: profileData?.avatar, level: profileData?.level || 1, lang: (i18n.language || 'en').substring(0, 2) };");

// Also add i18n to LobbyBrowserScreen useTranslation
lb = lb.replace(/const \{ t \} = useTranslation\(\);/g, "const { t, i18n } = useTranslation();");

fs.writeFileSync(lbPath, lb);

console.log("Done");
