/* eslint-disable no-use-before-define */
import { mapLimit, mapValuesLimit, waterfall } from 'async';
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

  done(new Error('no element found'));
}

export function handleSelectorObject(args, done) {
  const { selector } = args;

  mapValuesLimit(
    selector,
    1,
    (value, key, next) => handleSelector(merge(args, { selector: value }), next),
    done,
  );
}

export async function handleSelectorArray(args, done) {
  const { concurrency, selector } = args;
  const [sourceSelector, targetSelector] = selector;

  debug(`handleSelectorArray: ${sourceSelector} => ${targetSelector}`);

  waterfall([
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

        mapLimit(result, concurrency, (source, mapNext) => {
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
  const { engine, source } = args;
  const context = merge({}, args.context);

  let link;

  if (isUrl(source)) {
    context.url = source;
    context.baseUrl = getBaseUrl(source);

    debug(`crawl absolute link: ${source}`);

    link = source;
  } else if (isRelativeUrl(source)) {
    link = URL.resolve(context.baseUrl, source);

    context.url = link;

    debug(`crawl relative link: ${link}`);
  }

  engine.retrieveContent(link)
    .catch(done)
    .then((content) => {
      handleSelector(merge(args, {
        content,
        context,
      }), done);
    });
}
