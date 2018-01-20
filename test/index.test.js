import os from 'os';
import puppeteer from 'puppeteer';
import { isArray } from 'lodash';
import Engine from '../src/engine';
import OhScrap from '../src/index';

const PAGE_1_URL = 'http://page1.com/';
const PAGE_2_URL = 'http://page2.com/';
const PAGE_3_URL = 'http://page3.com/';

const PAGE_1 = `
  <body>
    <h1>TITLE PAGE 1</h1>
    <a id="next-page" href="http://page2.com/">next page</a>
    <ul>
      <li class="item" data-test="test1">item1</li>
      <li class="item" data-test="test2">item2</li>
    </ul>
  </body>
`;

const PAGE_2 = `
  <body>
    <h1>TITLE PAGE 2</h1>
    <ul>
      <li class="item2">item1</li>
      <li class="item2">item2</li>
      <li class="item2">item3</li>
    </ul>
  </body>
`;

const PAGE_3 = `
  <body>
    <h1>TITLE PAGE 3</h1>
    <ul>no items</ul>
    <p>something else to reach 100 characters</p>
  </body>
`;

describe('given an OhScrap class', () => {
  let ohscrap;
  let sandbox;
  let retrieveContentStub;

  before(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(puppeteer, 'launch').resolves({
      close: sandbox.stub().resolves(),
    });

    retrieveContentStub = sandbox.stub(Engine.prototype, 'retrieveContent');

    retrieveContentStub.withArgs(PAGE_1_URL).resolves(PAGE_1);
    retrieveContentStub.withArgs(PAGE_2_URL).resolves(PAGE_2);
    retrieveContentStub.withArgs(PAGE_3_URL).resolves(PAGE_3);
    retrieveContentStub.rejects(new Error('wrong page'));
  });

  after(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.resetHistory();
    ohscrap = new OhScrap();
  });

  describe('when passing concurrency to the constructor', () => {
    const CONCURRENCY = 2;

    beforeEach(() => {
      ohscrap = new OhScrap({ concurrency: CONCURRENCY });
    });

    it('should use the custom settings', () => {
      expect(ohscrap.concurrency).to.equal(CONCURRENCY);
    });
  });

  describe('when NOT passing concurrency to the constructor', () => {
    const CONCURRENCY = os.cpus().length;

    it('should use the default settings', () => {
      expect(ohscrap.concurrency).to.equal(CONCURRENCY);
    });
  });

  describe('when the selector is a string', () => {
    const selector = 'h1';

    it('should return a string result', (done) => {
      ohscrap.start({ url: PAGE_1_URL, selector }, (err, result) => {
        expect(result).to.equal('TITLE PAGE 1');
        done();
      });
    });
  });

  describe('when the selector is an object', () => {
    describe('and it looks for attributes', () => {
      const selector = {
        title: 'h1',
        items: '.item@data-test',
      };

      it('should return the same object structure populated with results', (done) => {
        ohscrap.start({ url: PAGE_1_URL, selector }, (err, result) => {
          expect(result).to.deep.equal({
            title: 'TITLE PAGE 1',
            items: [
              'test1',
              'test2',
            ],
          });
          done();
        });
      });
    });

    describe('and it does NOT contain deep links', () => {
      const selector = {
        title: 'h1',
        items: '.item',
      };

      it('should return the same object structure populated with results', (done) => {
        ohscrap.start({ url: PAGE_1_URL, selector }, (err, result) => {
          expect(result).to.deep.equal({
            title: 'TITLE PAGE 1',
            items: [
              'item1',
              'item2',
            ],
          });
          done();
        });
      });
    });

    describe.skip('and it does contain deep links', () => {
      const selector = {
        title: 'h1',
        items: '.item',
        page2: ['#next-page@href', {
          title: 'h1',
          items: '.item2',
        }],
      };

      let result;

      beforeEach((done) => {
        ohscrap.start({ url: PAGE_1_URL, selector }, (err, data) => {
          result = data;
          done();
        });
      });

      it('should call retrieveContentStub twice', () => {
        expect(retrieveContentStub)
          .to.be.calledTwice
          .and.to.be.calledWith(PAGE_1_URL)
          .and.to.be.calledWith(PAGE_2_URL);
      });

      it('should return the same object structure populated with results', () => {
        expect(result).to.deep.equal({
          title: 'TITLE PAGE 1',
          items: [
            'item1',
            'item2',
          ],
          page2: {
            title: 'TITLE PAGE 2',
            items: [
              'item1',
              'item2',
              'item3',
            ],
          },
        });
      });
    });
  });

  describe('when invoking until()', () => {
    const selector = {
      items: 'ul li',
    };
    const getUrl = count => `http://page${count + 1}.com/`;
    const keepGoing = ({ result }) => {
      const flag = isArray(result.items) && result.items.length > 0;

      return Promise.resolve(flag);
    };

    let emitStub;
    let totalCount;

    beforeEach((done) => {
      emitStub = sandbox.stub();

      ohscrap.on('data', emitStub);

      ohscrap.until({ getUrl, selector, keepGoing }, (err, res) => {
        totalCount = res;
        done();
      });
    });

    it('should call retrieveContentStub 3 times', () => {
      expect(retrieveContentStub).to.be.calledThrice;
    });

    it('should call emitStub 2 times', () => {
      expect(emitStub).to.be.calledTwice;
    });

    it('should return the total count', () => {
      expect(totalCount).to.equal(2);
    });
  });
});
