/**
 * Copies the brewery 3D model from a local checkout of lolevbeer/hq, at one commit:
 *
 *   node scripts/sync-hq-model.mjs ../hq 3d7ac6b
 *
 * Writes lib/hq/lolev-model.js (the module hq builds as dist/lolev-model.js, with
 * a first line naming the commit) and public/3d/hq/*.webp (its photos, dist/tex/).
 * Both are read from the commit, not from the checkout's working files, so the
 * copy is exactly what hq committed. Commit the result; the homepage tour uses
 * this copy until the script is run again with a newer commit.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const [hq, rev] = process.argv.slice(2)
if (!hq || !rev) throw new Error('Usage: node scripts/sync-hq-model.mjs <hq checkout> <commit>')

/** Run git in the hq checkout; returns stdout as a Buffer (photos are binary). */
const git = (...args) => execFileSync('git', ['-C', hq, ...args], { maxBuffer: 64 * 1024 * 1024 })

const commit = git('rev-parse', '--verify', `${rev}^{commit}`).toString().trim()

mkdirSync('lib/hq', { recursive: true })
writeFileSync(
  'lib/hq/lolev-model.js',
  `// Copied from lolevbeer/hq@${commit} by scripts/sync-hq-model.mjs. Do not edit; re-run the script.\n` +
    git('show', `${commit}:dist/lolev-model.js`),
)

// Start from an empty folder so a photo hq dropped does not linger here.
rmSync('public/3d/hq', { recursive: true, force: true })
mkdirSync('public/3d/hq', { recursive: true })
const photos = git('ls-tree', '--name-only', `${commit}:dist/tex`).toString().trim().split('\n')
for (const name of photos) {
  writeFileSync(`public/3d/hq/${name}`, git('show', `${commit}:dist/tex/${name}`))
}

console.log(
  `lolevbeer/hq@${commit}: lib/hq/lolev-model.js and ${photos.length} photos in public/3d/hq/`,
)
