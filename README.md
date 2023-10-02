# AEM-LIB PLUGIN SYSTEM
Add on for AEM Edge Delivery Services, which introduces a plugin system.

## Usage
TODO: get the information from Julien's PR

## Installation
###### SSH

```bash
git subtree add --squash --prefix plugins/system git@github.com:chicharr/aem-lib-plugin-system.git main
```

###### HTTPS

```bash
git subtree add --squash --prefix plugins/system git@github.com:chicharr/aem-lib-plugin-system.git main
```

You can then later update it from the source again via:

###### SSH

```bash
git subtree pull --squash --prefix plugins/system git@github.com:chicharr/aem-lib-plugin-system.git main
```

###### HTTPS

```bash
git subtree pull --squash --prefix plugins/system git@github.com:chicharr/aem-lib-plugin-system.git main
```

## Instrumentation
To instrument your project to use the plugin system you need to follow the steps below:

##### init the plugin system
Incude at the begining of your `scripts.js` the following line:
```
await import('../plugins/system/src/aem-lib-plugins.js').then((p) => p.init());
```

##### notify load phases
Before each phase of the page load invoke the plugin system, invoking `window.hlx.plugins.load(<phase>)` , e.g.:

```
async function loadPage() {
  await window.hlx.plugins.load('eager');
  await loadEager(document);
  await window.hlx.plugins.load('lazy');
  await loadLazy(document);
  loadDelayed();
}
```

##### notify run phases

Before each phase of the page load invoke the plugin system, invoking `window.hlx.plugins.run(<phase>)`

Eager:
in `loadEager()` method of your `scripts.js`, add just before the call to `decorateMain` the code `  await window.hlx.plugins.run('loadEager');`
e.g.


```
  ...
  const main = doc.querySelector('main');

  await window.hlx.plugins.run('loadEager');

  if (main) {
    decorateMain(main);
    await waitForLCP(LCP_BLOCKS);
  }
  ...
```


Lazy:
in `loadLazy()` method of your `scripts.js`, add just before the end of the function the code `window.hlx.plugins.run('loadLazy');`


Delayed:
Since delayed happens asynchronously inside a `setTimeout` function, you should invoke there both `window.hlx.plugins.load('delayed');` and `window.hlx.plugins.run('loadDelayed');`
e.g.

```
/**
 * loads everything that happens a lot later, without impacting
 * the user experience.
 */
function loadDelayed() {
  window.setTimeout(() => {
    window.hlx.plugins.load('delayed');
    import('./delayed.js');
    window.hlx.plugins.run('loadDelayed');
  }, 3000);
}
```