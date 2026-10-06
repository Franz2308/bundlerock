#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetVersion = process.argv[2];

if (!targetVersion) {
  console.error('Error: Version argument missing.');
  console.error('Usage: npm run bump <new-version> (e.g. npm run bump 0.2.4)');
  process.exit(1);
}

// Basic semver regex validation (e.g. 1.2.3 or 1.2.3-alpha.1)
const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const cleanVersion = targetVersion.startsWith('v') ? targetVersion.slice(1) : targetVersion;

if (!semverRegex.test(cleanVersion)) {
  console.error(`Error: Invalid semver format "${targetVersion}". Expected format like "0.2.4".`);
  process.exit(1);
}

console.log(`Bumping BundleRock version to: ${cleanVersion}`);

// 1. package.json
const packageJsonPath = path.join(rootDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = cleanVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  [OK] package.json: ${oldVersion} -> ${cleanVersion}`);
}

// 2. src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  const oldVersion = tauriConf.version;
  tauriConf.version = cleanVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
  console.log(`  [OK] src-tauri/tauri.conf.json: ${oldVersion} -> ${cleanVersion}`);
}

// 3. src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  const cargoVersionRegex = /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m;
  if (cargoVersionRegex.test(cargoContent)) {
    cargoContent = cargoContent.replace(cargoVersionRegex, `$1${cleanVersion}$2`);
    fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
    console.log(`  [OK] src-tauri/Cargo.toml: version = "${cleanVersion}"`);
  } else {
    console.warn('  [WARN] Could not find package.version in src-tauri/Cargo.toml');
  }
}

// 4. browser-extension/manifest.json
const manifestPath = path.join(rootDir, 'browser-extension', 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const oldVersion = manifest.version;
  // manifest.json only allows numeric semver (no pre-release hyphens)
  const numericVersion = cleanVersion.split('-')[0];
  manifest.version = numericVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`  [OK] browser-extension/manifest.json: ${oldVersion} -> ${numericVersion}`);
}

console.log('\nVersion bump completed successfully.');
console.log(`Suggested git commands:`);
console.log(`  git commit -am "chore: release v${cleanVersion}"`);
console.log(`  git tag v${cleanVersion}`);
console.log(`  git push origin main --tags`);
