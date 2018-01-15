/* eslint-disable class-methods-use-this */
import 'babel-polyfill';

import Promise from 'bluebird';
import cheerio from 'cheerio';
import Debug from 'debug';
import EventEmitter from 'events';
import isUrl from 'is-url';
import {
  isArray,
  isPlainObject,
  isString,
  uniq,
} from 'lodash';
import os from 'os';
import isValidPath from 'is-valid-path';
import URL from 'url';

import Engine from './engine';

const debug = Debug('oh-scrap');

class OhScrap extends EventEmitter {
  constructor(concurrency = os.cpus().length, strict = false) {
    super();

    this.concurrency = concurrency;
    this.engine = new Engine();
    this.metrics = {
      end: 0,
      start: 0,
    };
    this.strict = strict;
  }

  async init() {
    debug('init');

    this.metrics.start = Date.now();

    await this.engine.init();

    this.emit('start');
  }

  async teardown() {
    this.metrics.end = Date.now();

    debug(`finished in ${(this.metrics.end - this.metrics.start) / 1000}s`);

    await this.engine.teardown();

    this.emit('end');

    debug('teardown');
  }

  isUrl(url) {
    return isString(url) && isUrl(url);
  }

  isRelativeUrl(url) {
    return isString(url) && isValidPath(url);
  }

  getDataFromNode(node, attr = false) {
    if (attr) {
      return attr === 'HTML' ? node.parent().html() : node.attr(attr);
    }

    return node.text();
  }

  loadContent(content = '', selector = '') {
    const parts = selector.split('@');
    const xpath = parts[0];
    const attr = parts[1];

    const $ = cheerio.load(content);

    return {
      attr,
      element: $(xpath),
      xpath,
      $,
    };
  }

  getSelectorMatches({ $, attr, element }) {
    const rawMatches = element
      .map((ind, node) => this.getDataFromNode($(node), attr))
      .get();

    const matches = uniq(rawMatches).filter(item => item.length > 0);

    debug(`filtered matches: ${rawMatches.length !== matches.length}`);

    return matches.length > 1 ? matches : matches[0];
  }

  handleSelectorString(content = '', selector = '') {
    return new Promise((resolve, reject) => {
      const {
        attr,
        element,
        $,
      } = this.loadContent(content, selector);

      const count = element.length;

      debug(`handleSelectorString "${selector}" => ${count}`);

      if (count === 1) {
        return resolve(this.getDataFromNode(element, attr));
      }

      if (count > 1) {
        return resolve(this.getSelectorMatches({ $, attr, element }));
      }

      return this.strict ? reject(new Error('no element found')) : resolve(false);
    });
  }

  handleSelectorObject(content = '', selector) {
    return new Promise(async (resolve, reject) => {
      const newObject = {};

      try {
        /* eslint-disable no-await-in-loop, no-restricted-syntax */
        for (const [key, value] of Object.entries(selector)) {
          newObject[key] = await this.handleSelector(content, value);
        }
        /* eslint-enable no-await-in-loop, no-restricted-syntax */
      } catch (e) {
        reject(e);
        return;
      }

      resolve(newObject);
    });
  }

  async handleSelectorArray(content = '', [sourceSelector, targetSelector]) {
    debug(`handleSelectorArray: ${sourceSelector} => ${targetSelector}`);

    const result = await this.handleSelectorString(content, sourceSelector);

    if (this.isUrl(result) || this.isRelativeUrl(result)) {
      debug(`handleSelectorArray: result => url => ${result}`);

      return this.crawl(result, targetSelector);
    }

    if (isArray(result)) {
      debug(`handleSelectorArray: result => array => ${result.length}`, targetSelector);

      return Promise.map(result, source => this.crawl(source, targetSelector), {
        concurrency: this.concurrency,
      });
    }

    if (this.strict) {
      return Promise.reject(new Error(`no result found: ${sourceSelector}`));
    }

    return Promise.resolve(false);
  }

  handleSelector(content = '', selector) {
    debug('handleSelector', selector);

    return new Promise((resolve, reject) => {
      if (isString(selector)) {
        resolve(this.handleSelectorString(content, selector));
      } else if (isPlainObject(selector)) {
        resolve(this.handleSelectorObject(content, selector));
      } else if (isArray(selector)) {
        resolve(this.handleSelectorArray(content, selector));
      } else {
        reject(new Error('selector type not valid'));
      }
    });
  }

  setBaseUrl(source) {
    const { hostname, protocol } = URL.parse(source);

    this.baseUrl = `${protocol}//${hostname}`;

    debug(`setBaseUrl: ${this.baseUrl}`);

    return this.baseUrl;
  }

  async crawl(source, selector) {
    let content = source;

    if (this.isUrl(source)) {
      debug(`crawl absolute link: ${source}`);

      this.setBaseUrl(source);

      content = await this.engine.retrieveContent(source);
    } else if (this.isRelativeUrl(source)) {
      const link = URL.resolve(this.baseUrl, source);

      debug(`crawl relative link: ${link}`);

      content = await this.engine.retrieveContent(link);
    }

    return this.handleSelector(content, selector);
  }

  async until(getSource, selector, keepGoing = () => Promise.resolve(false)) {
    let count = 0;

    await this.init();

    debug('started');

    /* eslint-disable no-await-in-loop, no-constant-condition */
    while (true) {
      const source = getSource(count);
      let result;

      try {
        result = await this.crawl(source, selector);

        this.emit('data', { count, result, source });

        if (!await keepGoing(count, result)) {
          break;
        }

        count += 1;
      } catch (e) {
        this.emit('error', e);
        break;
      }
    }
    /* eslint-enable no-await-in-loop */

    await this.teardown();

    return count;
  }

  async start(source, selector) {
    await this.init();

    debug('started');


    const result = await this.crawl(source, selector);

    await this.teardown();

    return result;
  }
}

module.exports = OhScrap;
