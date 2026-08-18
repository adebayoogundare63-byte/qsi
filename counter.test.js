const test = require('node:test');
const assert = require('node:assert/strict');

const { getNextAdmissionNumber, getNextClassCode, getClassSequenceIndex } = require('./counter-logic.js');

test('admission numbers never reuse deleted values', () => {
  const seen = new Set();
  const nextValue = (current) => getNextAdmissionNumber(current, seen);

  let current = 5299;
  assert.equal(nextValue(current), 5300);
  seen.add(5300);

  current = 5300;
  assert.equal(nextValue(current), 5301);
  seen.add(5301);

  current = 5301;
  assert.equal(nextValue(current), 5302);
  seen.add(5302);

  // emulate a deleted value still not reused
  seen.add(5302);
  current = 5302;
  assert.equal(nextValue(current), 5303);
});

test('class sequence continues without restarting after deletion', () => {
  const classes = ['JSS1Q', 'JSS1S', 'JSS1I', 'JSS1Y', 'JSS1N'];

  assert.equal(getNextClassCode(0, classes), 'JSS1Q');
  assert.equal(getNextClassCode(1, classes), 'JSS1S');
  assert.equal(getNextClassCode(5, classes), 'JSS1Q');
  assert.equal(getNextClassCode(9, classes), 'JSS1N');
  assert.equal(getNextClassCode(10, classes), 'JSS1Q');
});

test('sequence index wraps correctly', () => {
  assert.equal(getClassSequenceIndex(0), 0);
  assert.equal(getClassSequenceIndex(5), 0);
  assert.equal(getClassSequenceIndex(9), 4);
  assert.equal(getClassSequenceIndex(10), 0);
});
