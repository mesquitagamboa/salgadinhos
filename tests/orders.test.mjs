import test from 'node:test';
import assert from 'node:assert/strict';
import {cartTotal,nextStatus,validPhone,normalizePhone,todayStart} from '../src/lib/order.mjs';
test('money uses integer cents and handles an empty cart',()=>{assert.equal(cartTotal([]),0);assert.equal(cartTotal([{produto:{preco:24.9},quantidade:3},{produto:{preco:10},quantidade:2}]),94.7);});
test('only forward kitchen steps exist',()=>{assert.equal(nextStatus('pendente'),'preparando');assert.equal(nextStatus('pronto'),'finalizado');assert.equal(nextStatus('finalizado'),null);});
test('phone requires DDD and 10 or 11 digits',()=>{assert.equal(normalizePhone('(85) 99999-9999'),'85999999999');assert.ok(validPhone('(85) 99999-9999'));assert.ok(!validPhone('99999999'));});
test('daily analytics uses Fortaleza even after UTC midnight',()=>{assert.equal(todayStart(new Date('2026-10-24T01:30:00Z')),'2026-10-23T03:00:00.000Z');});
