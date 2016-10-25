# ![npm-packer](http://imgh.us/npm-packer_1.svg)

> Produces zero-dependencies node modules

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
