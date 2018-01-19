import puppeteer from 'puppeteer';

export default class Engine {
  constructor() {
    this.browser = null;
    this.gotoOptions = {
      waitUntil: 'load',
    };
    this.launchOptions = {
      headless: true,
      ignoreHTTPSErrors: true,
    };
    this.viewportOptions = {
      height: 720,
      isLandscape: true,
      width: 1280,
    };
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
