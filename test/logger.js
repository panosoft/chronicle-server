const bunyan = require('bunyan');
const expect = require('chai').expect;
const logger = require('../lib/logger');

const ringbuffer = new bunyan.RingBuffer();
const bunyanLogger = bunyan.createLogger({
  name: 'test',
  streams: [{ type: 'raw', stream: ringbuffer }]
});

describe('logger', () => {
  it('curried', () => {
    const log = logger(bunyanLogger);
    expect(log).to.be.a('function');
    const msg = 'Test';
    log('info', msg);
    expect(ringbuffer.records.pop()).to.be.an('object')
      .and.to.have.property('msg').that.equals(msg);
  });
  it('noop if log undefined', () => {
    const log = logger(null);
    const msg = 'Test';
    log('info', msg);
  });
  it('write if log defined', () => {
    const log = logger(bunyanLogger);
    expect(log).to.be.a('function');
    const msg = 'Test';
    log('info', msg);
    const record = ringbuffer.records.pop();
    expect(record).to.be.an('object')
      .and.to.have.property('level').that.equals(bunyan.INFO)
    expect(record).to.be.an('object')
      .and.to.have.property('msg').that.equals(msg);
  });
});
