import isURL from 'is-url';
import isValidPath from 'is-valid-path';
import { isString } from 'lodash';
import URL from 'url';

export function getBaseUrl(source) {
  const { hostname, protocol } = URL.parse(source);

  return `${protocol}//${hostname}`;
}

export function isUrl(url) {
  return isString(url) && isURL(url);
}

export function isRelativeUrl(url) {
  return isString(url) && isValidPath(url);
}
