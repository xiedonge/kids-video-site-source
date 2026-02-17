const { getRecentDateStrings, getShanghaiDateString } = require('../utils/time');
const { getSummaryStats, getWatchSecondsForDate } = require('../db/database');

function buildSummary() {
  const today = getShanghaiDateString();
  const weekDates = getRecentDateStrings(7);
  const summary = getSummaryStats({ todayDate: today, weekDates });
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const dateString = getShanghaiDateString(cursor);
    if (getWatchSecondsForDate(dateString) > 0) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }
  return {
    todaySeconds: summary.todaySeconds,
    weekSeconds: summary.weekSeconds,
    streakDays: streak
  };
}

module.exports = { buildSummary };
