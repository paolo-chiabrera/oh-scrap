import cheerio from 'cheerio';
import { isString, uniq } from 'lodash';

export function getDataFromNode(node, attr = false, context) {
  if (attr === 'HTML') {
    return node.parent().html();
  }

  if (attr === 'URL') {
    return context.url;
  }

  if (isString(attr)) {
    return node.attr(attr);
  }

  return node.text();
}

export function loadContent(content = '', selector = '') {
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

export function getSelectorMatches({ $, attr, element }) {
  const rawMatches = element
    .map((ind, node) => getDataFromNode($(node), attr))
    .get();

  const matches = uniq(rawMatches).filter(item => item.length > 0);

  return matches.length > 1 ? matches : matches[0];
}
