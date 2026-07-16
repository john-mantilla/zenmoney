function calculateOccurrenceDatesOld(start, end, rule) {
  const dates = [];
  const current = new Date(start);

  // Ajustar zona horaria local
  current.setUTCHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setUTCHours(0, 0, 0, 0);

  while (current <= limit) {
    dates.push(current.toISOString().split('T')[0]);

    if (rule.frequency === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (rule.frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1);
      if (rule.dayOfMonth) {
        current.setDate(rule.dayOfMonth);
      }
    } else {
      break;
    }
  }
  return dates;
}

function calculateOccurrenceDatesNew(start, end, rule) {
  const dates = [];
  const current = new Date(start);

  // Use UTC methods throughout
  current.setUTCHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setUTCHours(0, 0, 0, 0);

  while (current <= limit) {
    dates.push(current.toISOString().split('T')[0]);

    if (rule.frequency === 'daily') {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (rule.frequency === 'monthly') {
      current.setUTCMonth(current.getUTCMonth() + 1);
      if (rule.dayOfMonth) {
        current.setUTCDate(rule.dayOfMonth);
      }
    } else {
      break;
    }
  }
  return dates;
}

// Simulating Colombia Timezone (GMT-5)
console.log('Testing date timezone shift...');
const startStr = '2026-07-10';
const endStr = '2026-07-12';
const rule = { frequency: 'daily' };

console.log('Old calculation:', calculateOccurrenceDatesOld(startStr, endStr, rule));
console.log('New calculation (UTC):', calculateOccurrenceDatesNew(startStr, endStr, rule));
