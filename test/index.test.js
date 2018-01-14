import puppeteer from 'puppeteer';
import OhScrap from '../src/index';

const PAGE_1_URL = 'http://page1.com/';
const PAGE_2_URL = 'http://page2.com/';

const PAGE_1 = `
  <body>
    <h1>TITLE PAGE 1</h1>
    <a id="next-page" href="http://page2.com/">next page</a>
    <ul>
      <li class="item">item1</li>
      <li class="item">item2</li>
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

describe('given an OhScrap class', () => {
  let ohscrap;
  let sandbox;
  let retrieveContentStub;

  before(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(puppeteer, 'launch').resolves({
      close: sandbox.stub().resolves(),
    });

    retrieveContentStub = sandbox.stub(OhScrap.prototype, 'retrieveContent');

    retrieveContentStub.withArgs(PAGE_1_URL).resolves(PAGE_1);
    retrieveContentStub.resolves(PAGE_2);

    ohscrap = new OhScrap();
  });

  after(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    sandbox.resetHistory();
  });

  describe('when the selector is a string', () => {
    const selector = 'h1';

    it('should return a string result', async () => {
      const result = await ohscrap.start(PAGE_1_URL, selector);

      expect(result).to.equal('TITLE PAGE 1');
    });
  });

  describe('when the selector is an object', () => {
    describe('and it does NOT contain deep links', () => {
      const selector = {
        title: 'h1',
        items: '.item',
      };

      it('should return the same object structure populated with results', async () => {
        const result = await ohscrap.start(PAGE_1_URL, selector);

        expect(result).to.deep.equal({
          title: 'TITLE PAGE 1',
          items: [
            'item1',
            'item2',
          ],
        });
      });
    });

    describe('and it does contain deep links', () => {
      const selector = {
        title: 'h1',
        items: '.item',
        page2: ['#next-page@href', {
          title: 'h1',
          items: '.item2',
        }],
      };

      let result;

      beforeEach(async () => {
        result = await ohscrap.start(PAGE_1_URL, selector);
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
});
