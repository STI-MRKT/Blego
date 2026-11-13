const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createBiographyCloseGate
} = require('../../electron/features/generator/biography-close.cjs');
test('normal close and Cmd+Q wait for flush; stale acknowledgements cannot close; failed save keeps window', () => {
  const sent = [],
    actions = [];
  const gate = createBiographyCloseGate({
    send: (token) => sent.push(token),
    close: () => actions.push('close'),
    quit: () => actions.push('quit')
  });
  let prevented = 0;
  const event = { preventDefault: () => prevented++ };
  gate.ready();
  gate.beforeQuit(event);
  assert.equal(prevented, 1);
  assert.equal(sent.length, 1);
  assert.deepEqual(actions, []);
  gate.acknowledge({ token: 'stale', saved: true });
  assert.deepEqual(actions, []);
  gate.acknowledge({ token: sent[0], saved: false });
  assert.deepEqual(actions, []);
  gate.onClose(event);
  assert.equal(sent.length, 2);
  gate.acknowledge({ token: sent[1], saved: true });
  assert.deepEqual(actions, ['close']);
  gate.onClose(event);
  assert.equal(prevented, 2);
});
test('successful quit flush reissues quit once; repeated close requests share the pending flush', () => {
  const sent = [],
    actions = [];
  const gate = createBiographyCloseGate({
    send: (t) => sent.push(t),
    close: () => actions.push('close'),
    quit: () => actions.push('quit')
  });
  gate.ready();
  const event = { preventDefault() {} };
  gate.beforeQuit(event);
  gate.onClose(event);
  assert.equal(sent.length, 1);
  gate.acknowledge({ token: sent[0], saved: true });
  assert.deepEqual(actions, ['quit']);
  gate.acknowledge({ token: sent[0], saved: true });
  assert.deepEqual(actions, ['quit']);
});
