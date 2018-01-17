import 'babel-polyfill';

import { forever } from 'async';
import Debug from 'debug';
import EventEmitter from 'events';
import os from 'os';

import Engine from './engine';

import { crawl } from './crawl';

const debug = Debug('oh-scrap');

class OhScrap extends EventEmitter {
  constructor(concurrency = os.cpus().length) {
    super();

    this.concurrency = concurrency;
    this.engine = new Engine();
    this.metrics = {
      end: 0,
      start: 0,
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

  async until(getSource, selector, keepGoing = () => false) {
    let count = 0;

    await this.init();

    debug('started');

    return new Promise((resolve) => {
      forever((next) => {
        const source = getSource(count);

        crawl({
          engine: this.engine,
          selector,
          source,
        }, async (err, result) => {
          if (err) {
            next(err);
            return;
          }

          this.emit('data', { count, result, source });

          const flag = await keepGoing({ count, result, source });

          if (flag) {
            count += 1;

            next();
          } else {
            next(count);
          }
        });
      }, async () => {
        await this.teardown();

        resolve(count);
      });
    });
  }

  async start(source, selector) {
    await this.init();

    debug('started');

    return new Promise((resolve, reject) => {
      crawl({
        concurrency: this.concurrency,
        engine: this.engine,
        selector,
        source,
      }, async (err, res) => {
        await this.teardown();

        if (err) {
          reject(err);
          return;
        }

        resolve(res);
      });
    });
  }
}

module.exports = OhScrap;
