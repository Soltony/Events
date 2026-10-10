/**
 * Self-checks for security-critical helpers (VA-003 / VA-013 / VA-020 remediation).
 * Run: npx tsx scripts/verify-security-fixes.ts
 * Pure unit checks — no database or network access.
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { verifyHs256Jwt } from '../src/lib/jwt-edge';
import { signJwt, verifyJwt } from '../src/lib/jwt';
import { centsToAmountString, OrderError, parseOrderLines, priceOrder, toCents } from '../src/lib/orders';
import { matchPromoCode } from '../src/lib/promo';
import { safeErrorMessage } from '../src/lib/safe-error';

const SECRET = 'test-secret-for-unit-checks';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

let passed = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

async function main() {
  console.log('JWT (VA-013)');
  const good = signJwt({ userId: 'u1', type: 'access' }, SECRET, { expiresIn: 60 });
  const [h, p, sig] = good.split('.');

  await check('edge: valid HS256 token accepted', async () => {
    assert.equal((await verifyHs256Jwt(good, SECRET))?.userId, 'u1');
  });
  await check('edge: signature stripped ("h.p.") rejected', async () => {
    assert.equal(await verifyHs256Jwt(`${h}.${p}.`, SECRET), null);
  });
  await check('edge: two-part token ("h.p") rejected', async () => {
    assert.equal(await verifyHs256Jwt(`${h}.${p}`, SECRET), null);
  });
  await check('edge: alg "none" rejected', async () => {
    assert.equal(await verifyHs256Jwt(`${b64({ alg: 'none', typ: 'JWT' })}.${p}.`, SECRET), null);
  });
  await check('edge: tampered payload rejected', async () => {
    assert.equal(await verifyHs256Jwt(`${h}.${b64({ userId: 'admin', type: 'access' })}.${sig}`, SECRET), null);
  });
  await check('edge: wrong secret rejected', async () => {
    assert.equal(await verifyHs256Jwt(good, 'other-secret'), null);
  });
  await check('edge: expired token rejected', async () => {
    const expired = jwt.sign({ userId: 'u1', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    assert.equal(await verifyHs256Jwt(expired, SECRET), null);
  });
  await check('edge: HS512 token rejected (algorithm pinned)', async () => {
    assert.equal(await verifyHs256Jwt(jwt.sign({ userId: 'u1' }, SECRET, { algorithm: 'HS512' }), SECRET), null);
  });
  await check('node: signature stripped / alg none / HS512 rejected', () => {
    for (const t of [`${h}.${p}.`, `${b64({ alg: 'none' })}.${p}.`, jwt.sign({ userId: 'u1' }, SECRET, { algorithm: 'HS512' })]) {
      assert.throws(() => verifyJwt(t, SECRET));
    }
    assert.equal(verifyJwt<{ userId: string }>(good, SECRET).userId, 'u1');
  });

  console.log('Order pricing (VA-003)');
  await check('rejects negative / zero / fractional / non-numeric quantities and ids', () => {
    for (const bad of [[], null, 'x', [{ id: 1, quantity: -1 }], [{ id: 1, quantity: 0 }], [{ id: 1, quantity: 1.5 }], [{ id: 'a', quantity: 1 }], [{ id: 1, quantity: 101 }]]) {
      assert.throws(() => parseOrderLines(bad), OrderError);
    }
  });
  await check('merges duplicate lines and ignores client-supplied price fields', () => {
    assert.deepEqual(parseOrderLines([{ id: 2, quantity: 1, price: 0 }, { id: 2, quantity: 2, price: 0 }]), [{ id: 2, quantity: 3 }]);
  });
  await check('cents conversion and gateway amount format are stable', () => {
    assert.equal(toCents('150.00'), 15000);
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(centsToAmountString(15000), '150');
    assert.equal(centsToAmountString(8910), '89.1');
  });

  const tt = (id: number, name: string, price: string) =>
    ({ id, name, basePrice: new Prisma.Decimal(price), total: 100, sold: 0, eventId: 7, description: null, locationPrices: null }) as any;
  const promos = [
    { id: 1, code: 'TEN', type: 'PERCENTAGE', value: new Prisma.Decimal('10'), uses: 0, maxUses: 5, eventId: 7 },
    { id: 2, code: 'LOCATION:Adama:LOC50', type: 'FIXED', value: new Prisma.Decimal('50'), uses: 0, maxUses: 5, eventId: 7 },
    { id: 3, code: 'BIG', type: 'FIXED', value: new Prisma.Decimal('100000'), uses: 0, maxUses: 5, eventId: 7 },
  ];
  const fakeDb = (types: any[]) =>
    ({
      ticketType: { findMany: async ({ where }: any) => types.filter((t) => where.id.in.includes(t.id) && t.eventId === where.eventId) },
      promoCode: { findMany: async () => promos },
    }) as any;
  const db = fakeDb([tt(1, 'VIP - Addis Ababa', '150.00'), tt(2, 'Regular - Adama', '75.50'), tt(9, 'Other', '1.00')]);

  await check('total is computed from DB prices', async () => {
    const r = await priceOrder(db, { eventId: 7, lines: [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }] });
    assert.equal(r.totalCents, 37550);
  });
  await check('ticket types from another event are rejected', async () => {
    const other = fakeDb([tt(1, 'VIP', '150.00'), { ...tt(5, 'Elsewhere', '1.00'), eventId: 8 }]);
    await assert.rejects(priceOrder(other, { eventId: 7, lines: [{ id: 5, quantity: 1 }] }), OrderError);
  });
  await check('percentage promo matches client math (150 x 2 - 10%)', async () => {
    const r = await priceOrder(db, { eventId: 7, lines: [{ id: 1, quantity: 2 }], promoCode: 'TEN' });
    assert.equal(r.totalCents, 27000);
  });
  await check('location promo uses the location of the ordered tickets only', async () => {
    assert.equal((await priceOrder(db, { eventId: 7, lines: [{ id: 2, quantity: 1 }], promoCode: 'LOC50' })).totalCents, 2550);
    await assert.rejects(priceOrder(db, { eventId: 7, lines: [{ id: 1, quantity: 1 }], promoCode: 'LOC50' }), OrderError);
  });
  await check('fixed discount never makes the total negative', async () => {
    assert.equal((await priceOrder(db, { eventId: 7, lines: [{ id: 1, quantity: 1 }], promoCode: 'BIG' })).totalCents, 0);
  });
  await check('unknown promo code is rejected', async () => {
    await assert.rejects(priceOrder(db, { eventId: 7, lines: [{ id: 1, quantity: 1 }], promoCode: 'NOPE' }), OrderError);
  });
  await check('promo matcher: plain, TICKET-scoped and LOCATION-scoped codes', () => {
    const list = [{ code: 'A' }, { code: 'TICKET:VIP - Addis Ababa:B' }, { code: 'LOCATION:Adama:C' }];
    assert.equal(matchPromoCode(list, 'A', null, [])?.code, 'A');
    assert.equal(matchPromoCode(list, 'B', null, [{ name: 'VIP - Addis Ababa' }])?.code, 'TICKET:VIP - Addis Ababa:B');
    assert.equal(matchPromoCode(list, 'B', null, [{ name: 'Regular' }]), null);
    assert.equal(matchPromoCode(list, 'C', 'Adama', [])?.code, 'LOCATION:Adama:C');
    assert.equal(matchPromoCode(list, 'C', 'Addis Ababa', []), null);
  });

  console.log('Error sanitisation (VA-020)');
  await check('Prisma errors never reach the client verbatim', () => {
    const unknown = new Prisma.PrismaClientUnknownRequestError(
      'Invalid `prisma.district.findMany()` invocation: ConnectorError ... PostgresError { code: "22021", message: "invalid byte sequence for encoding \\"UTF8\\": 0x00" }',
      { clientVersion: 'x' },
    );
    assert.equal(safeErrorMessage(unknown, 'Generic.'), 'Generic.');
    const known = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`name`)', { code: 'P2002', clientVersion: 'x' });
    assert.equal(safeErrorMessage(known, 'Generic.'), 'A record with that value already exists.');
    assert.equal(safeErrorMessage(new TypeError("Cannot read properties of undefined (reading 'x')"), 'Generic.'), 'Generic.');
    assert.equal(safeErrorMessage(new Error('Permission denied.'), 'Generic.'), 'Permission denied.');
  });

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error('\nCHECK FAILED:', err);
  process.exit(1);
});
