/* eslint-disable no-use-before-define */
import async from 'async';
import Debug from 'debug';
import {
  isString,
  isPlainObject,
  isArray,
  merge,
} from 'lodash';
import URL from 'url';

import { getBaseUrl, isRelativeUrl, isUrl } from './utils';

import { loadContent, getDataFromNode, getSelectorMatches } from './selector';

const debug = Debug('oh-scrap');

export function handleSelectorString(args, done) {
  const { content, selector, context } = args;

  const { attr, element, $ } = loadContent(content, selector);

  const count = element.length;

  debug(`handleSelectorString "${selector}" => ${count}`);

  if (count === 1) {
    const str = getDataFromNode(element, attr, context);

    done(null, str);
    return;
  }

  if (count > 1) {
    const arr = getSelectorMatches({ $, attr, element });

    done(null, arr);
    return;
  }

  done();
}

export function handleSelectorObject(args, done) {
  const { concurrency, selector } = args;

  async.mapValuesLimit(
    selector,
    concurrency,
    (value, key, next) => handleSelector(merge(args, { selector: value }), next),
    done,
  );
}

export async function handleSelectorArray(args, done) {
  const { concurrency, selector } = args;
  const [sourceSelector, targetSelector] = selector;

  debug(`handleSelectorArray: ${sourceSelector} => ${targetSelector}`);

  async.waterfall([
    next => handleSelectorString(merge(args, { selector: sourceSelector }), next),
    (result, next) => {
      if (isUrl(result) || isRelativeUrl(result)) {
        debug(`handleSelectorArray: result => url => ${result}`);

        crawl(merge(args, {
          selector: targetSelector,
          source: result,
        }), next);

        return;
      }

      if (isArray(result)) {
        debug(`handleSelectorArray: result => array => ${result.length}`, targetSelector);

        async.mapLimit(result, concurrency, (source, mapNext) => {
          const crawlArgs = merge(args, {
            selector: targetSelector,
            source,
          });

          crawl(crawlArgs, mapNext);
        }, next);
      }
    },
  ], done);
}

export function handleSelector(args, done) {
  const { selector } = args;

  debug('handleSelector', selector);

  if (isString(selector)) {
    handleSelectorString(args, done);
  } else if (isPlainObject(selector)) {
    handleSelectorObject(args, done);
  } else if (isArray(selector)) {
    handleSelectorArray(args, done);
  } else {
    done(new Error('selector type not valid'));
  }
}

export function crawl(args, done) {
  const {
    engine, retry, url, waitForSelector,
  } = args;
  const context = merge({}, args.context);

  let link;

  if (isUrl(url)) {
    context.url = url;
    context.baseUrl = getBaseUrl(url);

    debug(`crawl absolute link: ${url}`);

    link = url;
  } else if (isRelativeUrl(url)) {
    link = URL.resolve(context.baseUrl, url);

    context.url = link;

    debug(`crawl relative link: ${link}`);
  }

  let attempt = 0;

  const { interval, times } = retry;

  async.retry({
    interval,
    times,
  }, (callback) => {
    debug(`retrieveContent attempt ${attempt} => ${link}`);

    attempt += 1;

    engine.retrieveContent(link, waitForSelector)
      .then((content) => {
        if (!isString(content) || content.length < 100) {
          callback(new Error('invalid content'));
          return;
        }

        debug('content', content.length);

        handleSelector(merge(args, {
          content,
          context,
        }), callback);
      }, callback);
  }, (err, res) => done(null, res));
}
