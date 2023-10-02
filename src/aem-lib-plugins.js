/* eslint-disable max-classes-per-file */
import {
  createOptimizedPicture,
  getMetadata,
  decorateBlock,
  decorateButtons,
  decorateIcons,
  loadBlock,
  loadCSS,
  loadScript,
  sampleRUM,
  toCamelCase,
  toClassName,
  getPlaceholderOrDefault,
} from '/scripts/lib-franklin.js';
// TODO we should support both 'lib-franklin.js' and the new name 'aem.js'

export function init() {
  // eslint-disable-next-line no-use-before-define
  window.hlx.plugins = new PluginsRegistry();
  // eslint-disable-next-line no-use-before-define
  window.hlx.templates = new TemplatesRegistry();
}

function runFunctionWithContext(fn, args, context) {
  return fn.toString().startsWith('function')
    ? fn.call(context, ...args, context)
    : fn(...args, context);
}

/**
 * Loads the specified module with its JS and CSS files and returns the JS API if applicable.
 * @param {String} name The module name
 * @param {String} cssPath A path to the CSS file to load, or null
 * @param {String} jsPath A path to the JS file to load, or null
 * @param {...any} args Arguments to use to call the default export on the JS file
 * @returns a promsie that the module was loaded, and that returns the JS API is any
 */
async function loadPlugin(name, cssPath, jsPath, ...args) {
  const cssLoaded = cssPath ? loadCSS(cssPath) : Promise.resolve();
  const decorationComplete = jsPath
    ? new Promise((resolve) => {
      (async () => {
        let mod;
        try {
          mod = await import(jsPath);
          if (mod.default) {
            // eslint-disable-next-line no-use-before-define
            await runFunctionWithContext(mod.default, args, executionContext);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(`failed to load module for ${name}`, error);
        }
        resolve(mod);
      })();
    })
    : Promise.resolve();
  return Promise.all([cssLoaded, decorationComplete])
    .then(([, api]) => api);
}

// Define an execution context for plugins
export const executionContext = {
  createOptimizedPicture,
  getMetadata,
  decorateBlock,
  decorateButtons,
  decorateIcons,
  loadBlock,
  loadCSS,
  loadScript,
  sampleRUM,
  toCamelCase,
  toClassName,
  getPlaceholderOrDefault,
};

/**
 * Parses the plugin id and config paramters and returns a proper config
 *
 * @param {String} id A string that idenfies the plugin, or a path to it
 * @param {String|Object} [config] A string representing the path to the plugin, or a config object
 * @returns an object returning the the plugin id and its config
 */
function parsePluginParams(id, config) {
  const pluginId = !config
    ? id.split('/').splice(id.endsWith('/') ? -2 : -1, 1)[0].replace(/\.js/, '')
    : id;
  const pluginConfig = typeof config === 'string' || !config
    ? { load: 'eager', url: (config || id).replace(/\/$/, '') }
    : { load: 'eager', ...config };
  pluginConfig.options ||= {};
  return { id: toClassName(pluginId), config: pluginConfig };
}

class PluginsRegistry {
  #plugins;

  constructor() {
    this.#plugins = new Map();
  }

  // Register a new plugin
  add(id, config) {
    const { id: pluginId, config: pluginConfig } = parsePluginParams(id, config);
    this.#plugins.set(pluginId, pluginConfig);
  }

  // Get the plugin
  get(id) { return this.#plugins.get(id); }

  // Check if the plugin exists
  includes(id) { return !!this.#plugins.has(id); }

  // Load all plugins that are referenced by URL, and update their configuration with the
  // actual API they expose
  async load(phase) {
    [...this.#plugins.entries()]
      .filter(([, plugin]) => plugin.condition
        && !runFunctionWithContext(plugin.condition, [document, plugin.options], executionContext))
      .map(([id]) => this.#plugins.delete(id));
    return Promise.all([...this.#plugins.entries()]
      // Filter plugins that don't match the execution conditions
      .filter(([, plugin]) => (
        (!plugin.condition
          || runFunctionWithContext(plugin.condition, [document, plugin.options], executionContext))
        && phase === plugin.load && plugin.url
      ))
      .map(async ([key, plugin]) => {
        try {
          const isJsUrl = plugin.url.endsWith('.js');
          // If the plugin has a default export, it will be executed immediately
          const pluginApi = (await loadPlugin(
            key,
            !isJsUrl ? `${plugin.url}/${key}.css` : null,
            !isJsUrl ? `${plugin.url}/${key}.js` : plugin.url,
            document,
            plugin.options,
            executionContext,
          )) || {};
          this.#plugins.set(key, { ...plugin, ...pluginApi });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Could not load specified plugin', key);
        }
      }));
  }

  // Run a specific method in the plugin
  // Methods follow the loadEager/loadLazy/loadDelayed phases
  async run(phase) {
    return [...this.#plugins.values()]
      .reduce((promise, plugin) => ( // Using reduce to execute plugins sequencially
        plugin[phase] && (!plugin.condition
          || runFunctionWithContext(plugin.condition, [document, plugin.options], executionContext))
          ? promise.then(() => runFunctionWithContext(
            plugin[phase],
            [document, plugin.options],
            executionContext,
          ))
          : promise
      ), Promise.resolve())
      .catch((err) => {
        // Gracefully catch possible errors in the plugins to avoid bubbling up issues
        // eslint-disable-next-line no-console
        console.error('Error in plugin', err);
      });
  }
}

class TemplatesRegistry {
  // Register a new template
  // eslint-disable-next-line class-methods-use-this
  add(id, url) {
    const { id: templateId, config: templateConfig } = parsePluginParams(id, url);
    templateConfig.condition = () => toClassName(getMetadata('template')) === templateId;
    window.hlx.plugins.add(templateId, templateConfig);
  }

  // Get the template
  // eslint-disable-next-line class-methods-use-this
  get(id) { return window.hlx.plugins.get(id); }

  // Check if the template exists
  // eslint-disable-next-line class-methods-use-this
  includes(id) { return window.hlx.plugins.includes(id); }
}
