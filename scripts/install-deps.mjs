import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const root = process.cwd()
const cache = path.join(root, '.install-cache')
fs.mkdirSync(cache, { recursive: true })

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json()
}

function pkgPath(name) {
  return path.join(root, 'node_modules', ...name.split('/'), 'package.json')
}

function isInstalled(name) {
  return fs.existsSync(pkgPath(name))
}

function readPkg(name) {
  if (!isInstalled(name)) return null
  return JSON.parse(fs.readFileSync(pkgPath(name), 'utf8'))
}

function registryUrl(name) {
  return `https://registry.npmjs.org/${name.includes('/') ? name.replace('/', '%2F') : name}/latest`
}

async function install(name) {
  if (isInstalled(name)) return readPkg(name)
  console.log('install', name)
  const meta = await getJson(registryUrl(name))
  const safe = name.replace('@', '').replace('/', '-')
  const tgz = path.join(cache, `${safe}-${meta.version}.tgz`)
  const res = await fetch(meta.dist.tarball)
  if (!res.ok) throw new Error(`tarball ${name} ${res.status}`)
  fs.writeFileSync(tgz, Buffer.from(await res.arrayBuffer()))
  const tmp = path.join(cache, `${safe}-tmp`)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  execFileSync('tar', ['-xzf', tgz, '-C', tmp], { stdio: 'ignore' })
  const target = path.join(root, 'node_modules', ...name.split('/'))
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.renameSync(path.join(tmp, 'package'), target)
  return JSON.parse(fs.readFileSync(pkgPath(name), 'utf8'))
}

async function main() {
  const queue = ['@supabase/supabase-js', '@supabase/ssr']
  const seen = new Set()

  while (queue.length) {
    const name = queue.shift()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const pkg = await install(name)
    for (const dep of Object.keys(pkg?.dependencies || {})) {
      if (!seen.has(dep)) queue.push(dep)
    }
  }

  console.log(`Installed ${seen.size} packages`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
