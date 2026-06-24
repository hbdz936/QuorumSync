import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from '../socket/rooms';
import { Criteria, Voter, QuorumRule } from '@quorumsync/core';

export const sessionsRouter = Router();

interface CreateSessionBody {
  title: string;
  creatorId: string;
  criteria: Criteria[];
  voters: Voter[];
  quorumRule: QuorumRule;
  itemLabels: string[];
}

sessionsRouter.post('/', (req: Request, res: Response) => {
  const body = req.body as CreateSessionBody;

  if (!body.title || !body.creatorId || !body.criteria?.length || !body.voters?.length || !body.itemLabels?.length) {
    return res.status(400).json({
      error: 'title, creatorId, criteria, voters, and itemLabels are all required',
    });
  }

  const sessionId = uuidv4();
  const itemIds = body.itemLabels.map((_, i) => `item-${i}-${uuidv4().slice(0, 6)}`);

  const room = roomManager.createRoom({
    sessionId,
    title: body.title,
    creatorId: body.creatorId,
    criteria: body.criteria,
    voters: body.voters,
    quorumRule: body.quorumRule,
    itemIds,
  });

  res.status(201).json({
    sessionId,
    items: itemIds.map((id, i) => ({ id, label: body.itemLabels[i] })),
    config: room.config,
  });
});

sessionsRouter.get('/:sessionId', (req: Request, res: Response) => {
  const room = roomManager.getRoom(req.params.sessionId);
  if (!room) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({
    config: room.config,
    items: room.getAllItemsSnapshot(),
  });
});