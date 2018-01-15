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

  async retrieveContent(url, selector = 'body') {
    const page = await this.browser.newPage();

    await page.setViewport(this.viewportOptions);

    await page.goto(url, this.gotoOptions);

    await page.waitFor(selector);

    const content = await page.evaluate((sel) => {
      const element = document.querySelector(sel); // eslint-disable-line no-undef

      return element ? element.innerHTML : null;
    }, selector);

    await page.close();

    return content;
  }

  async init() {
    this.browser = await puppeteer.launch(this.launchOptions);

    return this.browser;
  }

  teardown() {
    return this.browser.close();
  }
}
