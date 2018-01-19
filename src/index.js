import 'babel-polyfill';

import { forever } from 'async';
import Debug from 'debug';
import EventEmitter from 'events';
import os from 'os';

import Engine from './engine';

import { crawl } from './crawl';

const debug = Debug('oh-scrap');

class OhScrap extends EventEmitter {
  constructor(concurrency = os.cpus().length, retry) {
    super();

    this.concurrency = concurrency;
    this.engine = new Engine();
    this.metrics = {
      end: 0,
      start: 0,
    };
    this.retry = retry || {
      interval: 1500,
      times: 5,
    };
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

  async until(args, done) {
    const {
      getUrl,
      selector,
      keepGoing = () => false,
      waitForSelector,
    } = args;

    try {
      await this.init();
    } catch (e) {
      done(e);
      return;
    }

    debug('until');

    let count = 0;

    forever((next) => {
      debug(`count ${count}`);

      const url = getUrl(count);

      this.start({
        selector,
        url,
        waitForSelector,
      }, async (err, result) => {
        if (err) {
          next(err);
          return;
        }

        const flag = await keepGoing({ count, result, url });

        debug('keepGoing', flag);

        if (flag !== true) {
          next(true);
          return;
        }

        this.emit('data', { count, result, url });
        count += 1;
        next();
      });
    }, async () => {
      try {
        await this.teardown();
      } catch (e) {
        done(e);
        return;
      }

      done(null, count);
    });
  }

  async start(args, done) {
    const { selector, url, waitForSelector = 'body' } = args;

    try {
      await this.init();
    } catch (e) {
      done(e);
      return;
    }

    debug('started');

    crawl({
      concurrency: this.concurrency,
      engine: this.engine,
      retry: this.retry,
      selector,
      url,
      waitForSelector,
    }, async (err, res) => {
      try {
        await this.teardown();
      } catch (e) {
        done(e);
        return;
      }

      if (err) {
        done(err);
        return;
      }

      done(null, res);
    });
  }
}

module.exports = OhScrap;
