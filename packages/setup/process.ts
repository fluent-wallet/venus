// to fix  "readable-stream",  "version": "2.3.8", var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
// this code use process.version but react native don't have it, so we add a string to fix it
// @ts-expect-error
global.process.version = 'v21.7.1';
