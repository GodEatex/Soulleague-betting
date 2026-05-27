// src/utils/matchManager.js
const storage = require('./storage');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const STATUS = { PENDING: 'PENDING', OPEN: 'OPEN', LOCKED: 'LOCKED', FINISHED: 'FINISHED' };

function getMatchesKey(guildId) { return `matches_${guildId}`; }
function getAllMatches(guildId) { return storage.read(getMatchesKey(guildId)); }
async function saveAllMatches(guildId, matches) { await storage.write(getMatchesKey(guildId), matches); }

function createMatch(guildId, { teamA, teamB, format = '5v5', isSandbox = false, channelId = null }) {
  const sessionId = uuidv4();
  const match = {
    sessionId, guildId, channelId,
    teamA, teamB, format,
    status: STATUS.PENDING,
    poolA: 0, poolB: 0,
    bets: [],
    createdAt: Date.now(),
    openedAt: null, closedAt: null, finishedAt: null,
    winner: null, isSandbox,
    betMessageId: null, betChannelId: null,
  };
  const matches = getAllMatches(guildId);
  matches[sessionId] = match;
  return { match, sessionId };
}

async function saveMatch(guildId, match) {
  const matches = getAllMatches(guildId);
  matches[match.sessionId] = match;
  await saveAllMatches(guildId, matches);
}

function getMatch(guildId, sessionId) {
  return getAllMatches(guildId)[sessionId] || null;
}

function getActiveMatches(guildId) {
  return Object.values(getAllMatches(guildId)).filter(m => m.status === STATUS.OPEN || m.status === STATUS.PENDING);
}

function getLatestPendingMatch(guildId, channelId) {
  return Object.values(getAllMatches(guildId))
    .filter(m => m.status === STATUS.PENDING && (!channelId || m.channelId === channelId))
    .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

async function activateMatch(guildId, sessionId) {
  const matches = getAllMatches(guildId);
  const match = matches[sessionId];
  if (!match) return null;
  match.status = STATUS.OPEN;
  match.openedAt = Date.now();
  await saveAllMatches(guildId, matches);
  return match;
}

async function placeBet(guildId, sessionId, userId, team, amount) {
  const matches = getAllMatches(guildId);
  const match = matches[sessionId];
  if (!match) return { success: false, reason: 'Match not found.' };
  if (match.status !== STATUS.OPEN) return { success: false, reason: 'Betting is not open for this match.' };
  const existing = match.bets.find(b => b.userId === userId);
  if (existing) return { success: false, reason: `You already bet **${existing.amount}** on **${existing.team}**.` };
  if (!['A', 'B'].includes(team)) return { success: false, reason: 'Invalid team.' };
  if (amount < 1) return { success: false, reason: 'Minimum bet is 1.' };
  match.bets.push({ userId, team, amount, placedAt: Date.now() });
  if (team === 'A') match.poolA += amount;
  else match.poolB += amount;
  await saveAllMatches(guildId, matches);
  return { success: true, match };
}

async function resolveMatch(guildId, sessionId, winner) {
  const matches = getAllMatches(guildId);
  const match = matches[sessionId];
  if (!match || match.status === STATUS.FINISHED) return null;
  if (!['A', 'B'].includes(winner)) return null;

  match.status = STATUS.FINISHED;
  match.winner = winner;
  match.finishedAt = Date.now();

  const totalPool = match.poolA + match.poolB;
  const winningPool = winner === 'A' ? match.poolA : match.poolB;
  const winningBets = match.bets.filter(b => b.team === winner);

  const payouts = winningBets.map(bet => {
    const share = winningPool > 0 ? bet.amount / winningPool : 0;
    const payout = Math.floor(totalPool * share);
    return { userId: bet.userId, payout, originalBet: bet.amount };
  });

  match.payouts = payouts;
  match.totalPool = totalPool;
  await saveAllMatches(guildId, matches);
  return { match, payouts };
}

async function lockMatch(guildId, sessionId) {
  const matches = getAllMatches(guildId);
  const match = matches[sessionId];
  if (!match) return null;
  match.status = STATUS.LOCKED;
  match.closedAt = Date.now();
  await saveAllMatches(guildId, matches);
  return match;
}

async function cancelBet(guildId, sessionId, userId) {
  const matches = getAllMatches(guildId);
  const match = matches[sessionId];
  if (!match) return { success: false, reason: 'Match not found.' };
  if (match.status !== STATUS.OPEN) return { success: false, reason: 'Betting is already closed — bets are locked in.' };

  const betIndex = match.bets.findIndex(b => b.userId === userId);
  if (betIndex === -1) return { success: false, reason: 'You don\'t have a bet on this match.' };

  const bet = match.bets[betIndex];

  // Check 30-second window
  const age = Date.now() - bet.placedAt;
  if (age > 30_000) return { success: false, reason: 'The 30-second cancellation window has passed.' };

  // Remove bet and refund pool
  match.bets.splice(betIndex, 1);
  if (bet.team === 'A') match.poolA -= bet.amount;
  else match.poolB -= bet.amount;

  await saveAllMatches(guildId, matches);
  return { success: true, bet };
}

// Find an open match by both team names (for auto-detection)
function findOpenMatchByTeams(guildId, teamA, teamB) {
  const matches = getAllMatches(guildId);
  const lower = (s) => s.toLowerCase().trim();
  return Object.values(matches).find(m => {
    if (m.status !== STATUS.OPEN && m.status !== STATUS.LOCKED) return false;
    const mA = lower(m.teamA), mB = lower(m.teamB);
    const sA = lower(teamA), sB = lower(teamB);
    return (mA === sA && mB === sB) || (mA === sB && mB === sA) ||
      mA.includes(sA) || mA.includes(sB) || mB.includes(sA) || mB.includes(sB) ||
      sA.includes(mA) || sB.includes(mA) || sA.includes(mB) || sB.includes(mB);
  }) || null;
}

// Find open match where message content mentions both team names
function findMatchFromContent(guildId, content) {
  const matches = getAllMatches(guildId);
  const lower = content.toLowerCase();
  return Object.values(matches).find(m => {
    if (m.status !== STATUS.OPEN && m.status !== STATUS.LOCKED) return false;
    return lower.includes(m.teamA.toLowerCase()) && lower.includes(m.teamB.toLowerCase());
  }) || null;
}

function getStats(guildId) {
  const all = Object.values(getAllMatches(guildId));
  return {
    total: all.length,
    active: all.filter(m => m.status === STATUS.OPEN).length,
    pending: all.filter(m => m.status === STATUS.PENDING).length,
    finished: all.filter(m => m.status === STATUS.FINISHED).length,
    totalBets: all.reduce((acc, m) => acc + m.bets.length, 0),
    totalVolume: all.reduce((acc, m) => acc + m.poolA + m.poolB, 0),
  };
}

module.exports = {
  STATUS, createMatch, saveMatch, getMatch,
  getActiveMatches, getLatestPendingMatch, activateMatch,
  placeBet, cancelBet, resolveMatch, lockMatch,
  findMatchFromContent, findOpenMatchByTeams, getStats,
  getAllMatches,
};
