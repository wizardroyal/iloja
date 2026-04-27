import { DocumentsService } from './documents.service';

/**
 * Two documents with the same logical content but different key order /
 * whitespace must produce the same hash. The on-chain trust property
 * depends on this — if a re-render hashed differently we'd lose the
 * tamper-evidence guarantee.
 */
describe('DocumentsService.writeReceipt canonicalization', () => {
  function fakePrismaCapturing() {
    const docs: { id: string; hash: string; type: string; uri: string }[] = [];
    let id = 1;
    return {
      docs,
      document: {
        findUnique: async ({ where }: { where: { hash: string } }) =>
          docs.find((d) => d.hash === where.hash) ?? null,
        create: async ({
          data,
        }: {
          data: { type: string; hash: string; uri: string; contextRef: string };
        }) => {
          const row = { id: `d${id++}`, ...data };
          docs.push(row);
          return row;
        },
      },
    };
  }

  it('produces stable hashes regardless of key order', async () => {
    const a = fakePrismaCapturing();
    const svc = new DocumentsService(a as never);
    await svc.writeReceipt({
      type: 'escrow_receipt',
      body: { foo: 1, bar: 'two', nested: { z: 3, a: 1 } },
      contextRef: 'esc1',
    });

    const b = fakePrismaCapturing();
    const svc2 = new DocumentsService(b as never);
    await svc2.writeReceipt({
      type: 'escrow_receipt',
      // same content, different key order
      body: { nested: { a: 1, z: 3 }, bar: 'two', foo: 1 },
      contextRef: 'esc1',
    });

    expect(a.docs[0]!.hash).toBe(b.docs[0]!.hash);
  });

  it('dedupes on hash within a single service', async () => {
    const a = fakePrismaCapturing();
    const svc = new DocumentsService(a as never);
    const first = await svc.writeReceipt({
      type: 'escrow_receipt',
      body: { x: 1 },
      contextRef: 'esc1',
    });
    const second = await svc.writeReceipt({
      type: 'escrow_receipt',
      body: { x: 1 },
      contextRef: 'esc1',
    });
    expect(first.id).toBe(second.id);
    expect(a.docs).toHaveLength(1);
  });
});
