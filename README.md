# ![npm-packer](http://imgh.us/npm-packer_1.svg)

A tool for producing zero-dependencies node modules.

Features:


- [x] Doesn't move around any files. It ensures backward-compatibility of packaged modules
- [x] Doesn't package optional dependencies, you can use them for native moduels
- [x] Doesn't package devDependencies
- [x] Can use Yarn instead of npm for reliable builds
- [x] Can package dependencies directy from npm
- [x] Properly handles bin paths
- [x] Easy to use 🌹

## Installation

```
$ npm install -g npm-packer
```

## Usage

```
npm-packer <source> <target> [--yarn]
```

- `<source>` can be either existing directory or npm package prefixed with `npm:`
- `<target>` must be non-existing directory
- if `--yarn` is used, packer uses yarn instead of npm for bundling

```
npm-packer . dist
npm-packer npm:jquery jquery-packed
npm-packer npm:jquery jquery-packed --yarn
```

## How it works?

1. Runs "npm pack" on <source> module and copies result to <target>
2. Performs "npm install --production" on <target>
3. Copies installed modules to "<target>/vendor/node_modules"
4. Rewrites all require(...) calls
5. Removes "dependencies" from package.json

The bundle in `<target>` should be ready for publication with `npm publish`

## License

MIT © [Adam Stankiewicz](https://sheerun.net)
