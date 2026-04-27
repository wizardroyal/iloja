import { AuditService } from './audit.service';

function makeFakePrisma() {
  type Row = {
    id: string;
    actorUserId: string;
    entity: string;
    entityId: string;
    action: string;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  };
  const rows: Row[] = [];
  let id = 1;
  return {
    rows,
    auditLog: {
      create: async ({ data }: { data: Omit<Row, 'id' | 'createdAt'> }) => {
        const row: Row = { ...data, id: `a${id++}`, createdAt: new Date() };
        rows.unshift(row);
        return row;
      },
      findMany: async ({
        where,
      }: {
        where: { entity?: string; entityId?: string; actorUserId?: string };
      }) =>
        rows.filter(
          (r) =>
            (where.entity === undefined || r.entity === where.entity) &&
            (where.entityId === undefined || r.entityId === where.entityId) &&
            (where.actorUserId === undefined || r.actorUserId === where.actorUserId),
        ),
    },
  };
}

describe('AuditService', () => {
  it('appends a row with the supplied action and metadata', async () => {
    const prisma = makeFakePrisma();
    const svc = new AuditService(prisma as never);
    await svc.record({
      actorUserId: 'admin-1',
      entity: 'listing_flag',
      entityId: 'flag-1',
      action: 'resolve_flag',
      metadata: { valid: true },
    });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]!.action).toBe('resolve_flag');
    expect(prisma.rows[0]!.metadata).toEqual({ valid: true });
  });

  it('listForEntity filters by entity + entityId', async () => {
    const prisma = makeFakePrisma();
    const svc = new AuditService(prisma as never);
    await svc.record({
      actorUserId: 'a1',
      entity: 'dispute',
      entityId: 'd1',
      action: 'decide_dispute',
    });
    await svc.record({
      actorUserId: 'a2',
      entity: 'dispute',
      entityId: 'd2',
      action: 'decide_dispute',
    });
    const rows = await svc.listForEntity('dispute', 'd1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorUserId).toBe('a1');
  });

  it('listForActor filters by actor', async () => {
    const prisma = makeFakePrisma();
    const svc = new AuditService(prisma as never);
    await svc.record({
      actorUserId: 'a1',
      entity: 'dispute',
      entityId: 'd1',
      action: 'decide_dispute',
    });
    await svc.record({
      actorUserId: 'a1',
      entity: 'listing_flag',
      entityId: 'f1',
      action: 'resolve_flag',
    });
    await svc.record({
      actorUserId: 'a2',
      entity: 'dispute',
      entityId: 'd2',
      action: 'decide_dispute',
    });
    const rows = await svc.listForActor('a1');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.actorUserId === 'a1')).toBe(true);
  });
});
