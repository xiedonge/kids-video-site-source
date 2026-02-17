function getShanghaiDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

function getRecentDateStrings(days) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(getShanghaiDateString(d));
  }
  return dates;
}

module.exports = { getShanghaiDateString, getRecentDateStrings };
