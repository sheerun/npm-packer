#!/usr/bin/env node
// @flow

const fetch = require('fetch-file')
const babel = require('babel-core')
const tmp = require('tmp')
const pify = require('pify')
const meow = require('meow')
const exec = require('child-process-promise').exec
const fs = require('fs-extra-promise')
const Spinner = require('cli-spinner').Spinner
const path = require('path')
const targz = require('tar.gz')
const find = pify(require('enfsfind').find)
const babylon = require('babylon')
const semver = require('semver')

Spinner.setDefaultSpinnerString(19)
Spinner.setDefaultSpinnerDelay(100)

const cli = meow([
  'Specifically it:',
  '  1. Runs "npm pack" on <source> module and copies result to <target>',
  '  2. Performs "npm install --production" on <target>',
  '  3. Copies installed modules to "<target>/vendor/node_modules"',
  '  4. Rewrites all require(...) calls',
  '  5. Removes "dependencies" from package.json',
  '',
  'The bundle in <target> should be ready for publication with "npm publish"',
  '',
  'Usage',
  '  $ bundle-package <source> <target>',
  '',
  'Options',
  '  --yarn  Use yarn instead of npm',
  '',
  'Examples',
  '  $ npm-packer . dist',
  '  $ npm-packer npm:jquery jquery-packed',
  ' '
])

if (cli.input.length === 0) {
  console.error(cli.help)
  process.exit(0)
}

let stopSpinner

function step(message, callback) {
  const spinner = new Spinner(`%s ${message}`)

  spinner.start()

  stopSpinner = function () {
    if (spinner.isSpinning()) {
      spinner.stop(true)
      process.stderr.write(`* ${message}\n`)
    }
  }

  try {
    return callback()
  } finally {
    stopSpinner()
  }
}

function terminate(message) {
  if (stopSpinner) {
    stopSpinner()
  }
  message = message || cli.help
  message = typeof message === 'string' ? message : message.join('\n')
  message = `\n${message}\n\n`
  process.stderr.write(message)
  process.exit(1)
}

async function tryExec(command, options) {
  try {
    return await exec(command, options)
  } catch (e) {
    const message = [e.message]

    if (e.stderr) {
      message.push('\nSTDERR:')
      message.push(e.stderr)
    }

    if (e.stdout) {
      message.push('\nSTDOUT:')
      message.push(e.stdout)
    }

    terminate(message)

    // To make flow happy
    return { stdout: '', stderr: '' }
  }
}

async function main() {
  const src = cli.input[0]
  const dst = cli.input[1]

  if (!src) {
    terminate('You need to provide source location')
  }

  if (!dst) {
    terminate('You need to provide target location')
  }

  await step('Running checks...', async () => {
    if (cli.flags.yarn) {
      try {
        const { stdout } = await exec('yarn --version')

        if (!semver.valid(stdout.replace(/^\s+|\s+$/g, ''))) {
          throw new Error('yarn not installed')
        }
      } catch (err) {
        terminate(['Please install yarn globally first'])
      }
    } else {
      const { stdout } = await exec('npm version --json')

      const npmVersion = JSON.parse(stdout).npm.split('.')
      const npmMajor = parseInt(npmVersion[0], 10)

      if (npmMajor < 3) {
        terminate([
          'You need to use at least npm 3.',
          'Previous versions produce too long paths that Windows cannot handle.',
          'Please upgrade it: npm install -g npm'
        ])
      }
    }
  })

  const target = path.isAbsolute(dst) ? dst : path.resolve(process.cwd(), dst)

  let source = src

  if (fs.existsSync(target)) {
    terminate('[target] location cannot exist yet')
  }

  const tmpDir = tmp.dirSync().name

  if (source.indexOf('npm:') === 0) {
    const pkgName = source.split('npm:')[1]
    const { stdout } = await exec(`npm info ${pkgName} --json`)
    const tarball = JSON.parse(stdout).dist.tarball
    const pkgPath = path.join(tmpDir, 'package.tgz')
    await pify(fetch)(tarball, pkgPath)
    await targz().extract(pkgPath, tmpDir)
    await fs.removeAsync(pkgPath)
    await fs.moveAsync(path.join(tmpDir, 'package'), target)
  } else {
    source = path.isAbsolute(src) ? src : path.resolve(process.cwd(), src)

    if (!fs.existsSync(source)) {
      terminate('[source] needs to be a directory')
    }

    async function pack() {
      if (cli.flags.yarn) {
        // yarn pack is broken now... it packages all files
        return await tryExec('npm pack', { cwd: src })
      } else {
        return await tryExec('npm pack', { cwd: src })
      }
    }

    await step('Copying package source...', async () => {
      const dir = `${tmpDir}/package`
      const { stdout } = await pack();
      const pkgPath = path.resolve(source, stdout.trim())
      await targz().extract(pkgPath, tmpDir)
      await fs.removeAsync(pkgPath)
      await fs.moveAsync(dir, target)
    })
  }

  const json = JSON.parse(fs.readFileSync(path.join(target, 'package.json')))

  await step('Transforming js files with babel...', async () => {
    const mappings = []

    for (const dependency of Object.keys(json.dependencies)) {
      mappings.push({ src: path.resolve(target, `./vendor/node_modules/${dependency}`), expose: dependency })
    }

    async function processFile(file) {
      const source = await fs.readFileAsync(file, 'utf-8')
      const firstLine = source.substr(0, source.indexOf('\n'))
      const ast = babylon.parse(source, {
        sourceType: 'module',
        allowReturnOutsideFunction: true
      })
      let { code } = babel.transformFromAst(ast, source, {
        babelrc: false,
        retainLines: true,
        sourceRoot: target,
        filename: file,
        comments: false,
        plugins: [
          [require.resolve('babel-plugin-module-alias'), mappings]
        ]
      })

      if (firstLine.indexOf('#!') === 0) {
        code = code.replace(/^.*\n/, `${firstLine}\n`)
      }

      await fs.writeFileAsync(file, code)
    }

    const files = []

    const found = await find(target, { filter: /\.js$/ })

    found.forEach(file => files.push(file.path))

    if (typeof json.bin === 'string') {
      if (files.indexOf(path.join(target, json.bin)) === -1) {
        files.push(path.join(target, json.bin))
      }
    } else if (typeof json.bin === 'object') {
      for (const key in json.bin) {
        if (files.indexOf(path.join(target, json.bin[key])) === -1) {
          files.push(path.join(target, json.bin[key]))
        }
      }
    }

    for (const file of files) {
      await processFile(file)
    }
  })

  if (cli.flags.yarn) {
    await step('Running "yarn install --production"...', async () => {
      await tryExec('yarn install --production --ignore-scripts --pure-lockfile --modules-folder vendor/node_modules --ignore-engines', { cwd: target })
    })
  } else {
    await step('Running "npm install --production"...', async () => {
      await tryExec('npm install --production --ignore-scripts', { cwd: target })
    })

    await step('Moving node_modules to vendor directory"...', async () => {
      await fs.moveAsync(path.join(target, 'node_modules'), path.join(target, 'vendor', 'node_modules'))
    })
  }

  await step('Overwriting package.json...', async () => {
    if (json.files) {
      json.files.push('vendor')
    }

    if (json.dependencies) {
      delete json.dependencies
    }

    if (json.optionalDependencies) {
      delete json.optionalDependencies
    }

    if (!json.keywords) {
      json.keywords = []
    }

    json.keywords.push('npm-packer')

    await fs.writeJson(path.resolve(target, 'package.json'), json)
  })
}

main()
