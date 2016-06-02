# ![npm-packer](http://imgh.us/npm-packer.svg)

> Produces zero-dependencies node module

## Install

```
$ npm install --save npm-packer
```

## Usage

```js
npm-packer <source> <target>
```

- `<source>` can be either existing directory or npm package prefixed with `npm:`
- `<target>` must be non-existing directory 

```
npm-packer . dist
npm-packer npm:jquery 
```

## How it works?

1. Runs "npm pack" on <source> module and copies result to <target>
2. Performs "npm install --production --no-optional" on <target>
3. Copies installed modules to "<target>/vendor/node_modules"
4. Rewrites all require(...) calls
5. Removes "dependencies" from package.json

The bundle in `<target>` should be ready for publication with `npm publish`

## License

MIT © [Adam Stankiewicz](https://sheerun.net)
