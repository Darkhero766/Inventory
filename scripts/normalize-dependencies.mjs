import fs from 'node:fs';

const file = 'package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

// Keep the build deterministic when an earlier patch accidentally writes
// unreleased Radix major versions. These are the latest published stable
// versions known to the project registry at build time.
const stable = {
  '@radix-ui/react-collapsible': '^1.1.20',
  '@radix-ui/react-menubar': '^1.1.24',
  '@radix-ui/react-toast': '^1.2.23',
  '@radix-ui/react-hover-card': '^1.1.23',
};

let changed = false;
for (const [name, version] of Object.entries(stable)) {
  if (pkg.dependencies?.[name] && pkg.dependencies[name] !== version) {
    pkg.dependencies[name] = version;
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log('Dependency versions normalized to published stable Radix releases.');
} else {
  console.log('Dependency versions already normalized.');
}
