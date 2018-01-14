/* eslint-disable class-methods-use-this */
import puppeteer from 'puppeteer';
import isUrl from 'is-url';
import cheerio from 'cheerio';
import Promise from 'bluebird';
import os from 'os';
import {
  isArray,
  isPlainObject,
  isString,
} from 'lodash';

import Debug from 'debug';

const debug = Debug('OhScrap');

export default class OhScrap {
  constructor(concurrency = os.cpus().length, strict = false) {
    this.browser = null;
    this.concurrency = concurrency;
    this.strict = strict;
  }

  async retrieveContent(url, selector = 'body') {
    const page = await this.browser.newPage();

    await page.setViewport({
      height: 720,
      isLandscape: true,
      width: 1280,
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
    });

    await page.waitFor(selector);

    const content = await page.evaluate((sel) => {
      const element = document.querySelector(sel); // eslint-disable-line no-undef

      return element ? element.innerHTML : null;
    }, selector);

    await page.close();

    return content;
  }

  getDataFromNode(node, attr = false) {
    return attr ? node.attr(attr) : node.text();
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
        return resolve(element.map((ind, node) => this.getDataFromNode($(node), attr)).get());
      }

      return this.strict ? reject(new Error('no element found')) : resolve();
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
    const result = await this.handleSelectorString(content, sourceSelector);

    debug('handleSelectorArray', sourceSelector, targetSelector, result);

    if (isUrl(result)) {
      return this.crawl(result, targetSelector);
    }

    if (isArray(result)) {
      return Promise.map(result, source => this.crawl(source, targetSelector), {
        concurrency: this.concurrency,
      });
    }

    if (this.strict) {
      return Promise.reject(new Error(`no result found: ${sourceSelector} => ${targetSelector}`));
    }

    return Promise.resolve();
  }

  handleSelector(content = '', selector) {
    debug('handleSelector', selector, content);

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

  async crawl(source, selector) {
    let content = source.toString();

    if (isUrl(source)) {
      debug(`crawl link: ${source}`);
      content = await this.retrieveContent(source);
    }

    return this.handleSelector(content, selector);
  }

  async start(source, selector) {
    const START = Date.now();

    debug('started');

    this.browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const result = await this.crawl(source, selector);

    await this.browser.close();

    const END = Date.now();

    debug(`finished in ${(END - START) / 1000}s`);

    return result;
  }
}
