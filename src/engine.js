import { get, merge } from 'lodash';
import puppeteer from 'puppeteer';

export default class Engine {
  constructor(options) {
    this.browser = null;

    this.gotoOptions = merge({
      waitUntil: 'load',
    }, get(options, 'gotoOptions'));

    this.launchOptions = merge({
      headless: true,
      ignoreHTTPSErrors: true,
    }, get(options, 'launchOptions'));

    this.viewportOptions = merge({
      height: 720,
      isLandscape: true,
      width: 1280,
    }, get(options, 'viewportOptions'));
  }

  async retrieveContent(url, waitForSelector = 'body') {
    try {
      const page = await this.browser.newPage();

      await page.setViewport(this.viewportOptions);

      await page.goto(url, this.gotoOptions);

      await page.waitForSelector(waitForSelector);

      const content = await page.content();

      await page.close();

      return content;
    } catch (e) {
      return e;
    }
  }

  async init() {
    try {
      this.browser = await puppeteer.launch(this.launchOptions);

      return this.browser;
    } catch (e) {
      return e;
    }
  }

  teardown() {
    return this.browser.close();
  }
}
